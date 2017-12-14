const { parse } = require('url')
const fetch = require('node-fetch')
const { maxSatisfying } = require('semver')

const INDEX = 'http://nodejs.org/dist/index.json'

module.exports = async (req, res) => {
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

  if (/json/.test(req.headers.accepts)) {
    return match
  } else {
    res.setHeader('Content-Type', 'text/plain')
    return match.version
  }
}

async function resolveVersion(tag) {
  const lts = tag === 'lts'
  const res = await fetch(INDEX)

  if (!res.ok) {
    // TODO: handle error response
  }

  let body = await res.json()
  if (lts) {
    body = body.filter(b => b.lts)
  }
  const data = new Map(body.map(b => [b.version, b]))
  const versions = body.map(b => b.version)
  const matchTag = lts ? '*' : tag
  const version = maxSatisfying(versions, matchTag)
  if (!version) {
    return null
  }
  return Object.assign({ tag }, data.get(version))
}

/*
async function main() {
  console.log(await resolveVersion('4'))
  console.log(await resolveVersion('5'))
  console.log(await resolveVersion('6'))
  console.log(await resolveVersion('7'))
  console.log(await resolveVersion('8'))
  console.log(await resolveVersion('9'))
}
main()
*/
