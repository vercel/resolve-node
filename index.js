const { run } = require('micro')
const { parse } = require('url')
const fetch = require('node-fetch')
const { maxSatisfying } = require('semver')

const INDEX = 'https://nodejs.org/dist/index.json'

async function resolveVersion(tag) {
  const res = await fetch(INDEX)

  if (!res.ok) {
    // TODO: handle error response
  }

  let body = await res.json()

  const ltsParts = tag.match(/^lts(?:\/([a-z]+))?$/)
  const isLts = ltsParts !== null
  if (isLts) {
    const codename = ltsParts[1]
    body = body.filter(b => b.lts && (codename ? b.lts.toLowerCase() === codename : true))
  }

  const data = new Map(body.map(b => [b.version, b]))
  const versions = body.map(b => b.version)
  const matchTag = isLts ? '*' : tag
  const version = maxSatisfying(versions, matchTag)
  if (!version) {
    return null
  }
  return Object.assign({ tag }, data.get(version))
}

async function handler (req, res) {
  const { pathname, query } = parse(req.url, true)
  const tag = (
    query.tag ||
    decodeURIComponent(pathname.substr(1)) ||
    '*'
  ).toLowerCase()
  const match = await resolveVersion(tag)

  if (!match) {
    res.statusCode = 404
    return {
      tag,
      error: 'No match found'
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
