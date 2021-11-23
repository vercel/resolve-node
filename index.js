const yn = require('yn');
const { run } = require('micro');
const { parse } = require('url');
const fetch = require('node-fetch');
const semver = require('semver');

const INDEX = 'https://nodejs.org/dist/index.json';
const UNOFFICIAL =
  'https://unofficial-builds.nodejs.org/download/release/index.json';

async function getJson(url, unofficial) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Received ${res.status} from ${url}: ${await res.text()}`);
  }
  const body = await res.json();
  for (const b of body) {
    b.unofficial = unofficial;
  }
  return body;
}

async function resolveVersion(tag, opts) {
  const [dist, unofficial] = await Promise.all([
    getJson(INDEX, false),
    getJson(UNOFFICIAL, true),
  ]);

  let body = [...dist, ...unofficial];
  body.sort((a, b) => {
    const c = semver.compare(a.version, b.version);
    if (c !== 0) {
      return c * -1;
    }
    if (a.unofficial && !b.unofficial) {
      return -1;
    }
    if (!a.unofficial && b.unofficial) {
      return 1;
    }
    return 0;
  });

  const ltsParts = tag.match(/^lts(?:\/([a-z]+))?$/);
  const isLts = ltsParts !== null;
  if (isLts) {
    const codename = ltsParts[1];
    body = body.filter(
      (b) => b.lts && (codename ? b.lts.toLowerCase() === codename : true)
    );
  }

  if (opts.security) {
    body = body.filter((b) => b.security);
  }

  const matchTag = isLts ? '*' : tag;

  const platform = getPlatform(opts.platform);
  let arch = getArch(opts.arch);
  if (platform && arch) {
    let suffix = '';
    if (platform === 'osx') {
      suffix = '-tar';

      // "darwin/arm64" is Apple M1, which supports x64 binaries via
      // Rosetta emulation. Since there's no arm64 binaries for
      // older Node.js versions, return the x64 download URL.
      try {
        if (arch === 'arm64' && semver.lt(semver.coerce(matchTag), '16.0.0')) {
          arch = 'x64';
        }
      } catch (_) {
        console.log(_);
        // ignore
      }
    } else if (platform === 'win') {
      suffix = '-zip';
    }
    body = body.filter((b) => b.files.includes(`${platform}-${arch}${suffix}`));
  }

  const data = new Map(body.map((b) => [b.version, b]));
  const versions = new Set(body.map((b) => b.version));
  const version = semver.maxSatisfying(Array.from(versions), matchTag);
  if (!version) {
    return null;
  }
  const match = data.get(version);
  let url = undefined;
  if (opts.platform && arch) {
    const urlBase = match.unofficial
      ? 'https://unofficial-builds.nodejs.org/download/release'
      : 'https://nodejs.org/dist';
    url = `${urlBase}/${match.version}/node-${match.version}-${opts.platform}-${arch}.tar.gz`;
  }
  return Object.assign({ tag, url }, match);
}

const PLATFORM_MAP = new Map([['darwin', 'osx']]);

function getPlatform(platform) {
  const p = String(platform || '').toLowerCase();
  return PLATFORM_MAP.get(p) || p;
}

const ARCH_MAP = new Map([['x86_64', 'x64']]);

function getArch(arch) {
  const a = String(arch || '').toLowerCase();
  return ARCH_MAP.get(a) || a;
}

function parseAccept(req) {
  return /json/.test(req.headers.accept) ? 'json' : 'text';
}

async function handler(req, res) {
  const { pathname, query } = parse(req.url, true);
  const format = query.format || parseAccept(req);
  let tag = (
    query.tag ||
    decodeURIComponent(pathname.substr(1)) ||
    '*'
  ).toLowerCase();

  if (tag === 'latest') {
    tag = '*';
  }

  query.security = yn(query.security);

  const match = await resolveVersion(tag, query);

  if (!match) {
    res.statusCode = 404;
    return {
      tag,
      query,
      error: 'No match found',
    };
  }

  if (match.url) {
    res.setHeader('X-Download-URL', match.url);
  }

  res.setHeader('X-Node-Version', match.version);

  if (format === 'json') {
    return match;
  } else if (format === 'text') {
    res.setHeader('Content-Type', 'text/plain; charset=utf8');
    return match.version;
  } else {
    throw new Error(`Unknown "format": ${format}`);
  }
}

module.exports = (req, res) => run(req, res, handler);
