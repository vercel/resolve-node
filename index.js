const yn = require('yn')
const { run } = require('micro')
const { parse } = require('url')
const fetch = require('node-fetch')
const { compare, maxSatisfying } = require('semver')

const INDEX = 'https://nodejs.org/dist/index.json'
const UNOFFICIAL =
  'https://unofficial-builds.nodejs.org/download/release/index.json'

async function getJson(url, unofficial) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Received ${res.status} from ${url}: ${await res.text()}`)
  }
  const body = await res.json()
  for (const b of body) {
    b.unofficial = unofficial
  }
  return body
}

async function resolveVersion(tag, opts) {
  const [dist, unofficial] = await Promise.all([
    getJson(INDEX, false),
    getJson(UNOFFICIAL, true),
  ])

  let body = [...dist, ...unofficial]
  body.sort((a, b) => {
    const c = compare(a.version, b.version)
    if (c !== 0) {
      return c * -1
    }
    if (a.unofficial && !b.unofficial) {
      return -1
    }
    if (!a.unofficial && b.unofficial) {
      return 1
    }
    return 0
  })

  const ltsParts = tag.match(/^lts(?:\/([a-z]+))?$/)
  const isLts = ltsParts !== null
  if (isLts) {
    const codename = ltsParts[1]
    body = body.filter(
      (b) => b.lts && (codename ? b.lts.toLowerCase() === codename : true)
    )
  }

  if (opts.security) {
    body = body.filter((b) => b.security)
  }

  if (opts.platform && opts.arch) {
    body = body.filter((b) => b.files.includes(`${opts.platform}-${opts.arch}`))
  }
  //console.log(body);

  const data = new Map(body.map((b) => [b.version, b]))
  const versions = new Set(body.map((b) => b.version))
  const matchTag = isLts ? '*' : tag
  const version = maxSatisfying(Array.from(versions), matchTag)
  if (!version) {
    return null
  }
  const match = data.get(version)
  let url = undefined
  if (opts.platform && opts.arch) {
    const urlBase = match.unofficial
      ? 'https://unofficial-builds.nodejs.org/download/release'
      : 'https://nodejs.org/dist'
    url = `${urlBase}/${match.version}/node-${match.version}-${opts.platform}-${opts.arch}.tar.gz`
  }
  return Object.assign({ tag, url }, match)
}

async function handler(req, res) {
  const { pathname, query } = parse(req.url, true)
  const tag = (
    query.tag ||
    decodeURIComponent(pathname.substr(1)) ||
    '*'
  ).toLowerCase()

  query.security = yn(query.security)
  console.log({ query })

  const match = await resolveVersion(tag, query)
  console.log({ match })

  if (!match) {
    res.statusCode = 404
    return {
      tag,
      query,
      error: 'No match found',
    }
  }

  if (/json/.test(req.headers.accept)) {
    return match
  } else {
    res.setHeader('Content-Type', 'text/plain')
    return match.version
  }
}

module.exports = (req, res) => run(req, res, handler)
