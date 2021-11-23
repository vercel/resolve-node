'use strict'

const fs = require('fs')
const fetch = require('node-fetch')
const fetchMock = require('fetch-mock')
const listen = require('test-listen')
const proxyquire = require('proxyquire')
const micro = require('micro')
const { test } = require('ava')

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

const mockedFetch = fetchMock
  .sandbox()
  .mock(
    'https://nodejs.org/dist/index.json',
    readJson(`${__dirname}/fixtures/index.json`)
  )
  .mock(
    'https://unofficial-builds.nodejs.org/download/release/index.json',
    readJson(`${__dirname}/fixtures/unofficial.json`)
  )

const api = proxyquire('..', {
  'node-fetch': mockedFetch,
})

test.beforeEach(async (t) => {
  const service = (t.context.service = micro(api))
  t.context.url = await listen(service)
})

test.afterEach.always(async (t) => {
  await t.context.service.close()
})

test('should prefer `text/plain`', async (t) => {
  const { headers } = await fetch(t.context.url)
  t.is(headers.get('content-type'), 'text/plain; charset=utf8')
})

test('should honor `application/json`', async (t) => {
  const { headers } = await fetch(t.context.url, {
    headers: { accept: 'application/json' },
  })
  t.regex(headers.get('content-type'), /application\/json/)
})

test('should prefer query param over path segment', async (t) => {
  const res = await fetch(`${t.context.url}/lts/Dubnium?tag=6.x`)
  t.is(await res.text(), 'v6.17.1')
})

test('should 404 on empty codename (query param)', async (t) => {
  const { status } = await fetch(`${t.context.url}/?tag=lts/`)
  t.is(status, 404)
})

test('should 404 on empty codename (path segment)', async (t) => {
  const { status } = await fetch(`${t.context.url}/lts/`)
  t.is(status, 404)
})

test('/', async (t) => {
  const res = await fetch(t.context.url)
  t.is(await res.text(), 'v14.13.0')
})

test('/latest', async (t) => {
  const res = await fetch(t.context.url)
  t.is(await res.text(), 'v14.13.0')
})

test('/lts', async (t) => {
  const res = await fetch(`${t.context.url}/lts`)
  t.is(await res.text(), 'v12.18.4')
})

test('/lts/Carbon', async (t) => {
  const res = await fetch(`${t.context.url}/lts/Carbon`)
  t.is(await res.text(), 'v8.17.0')
})

test('/8.x', async (t) => {
  const res = await fetch(`${t.context.url}/8.x`)
  t.is(await res.text(), 'v8.17.0')
})

test('/?tag=lts', async (t) => {
  const res = await fetch(`${t.context.url}/?tag=lts`)
  t.is(await res.text(), 'v12.18.4')
})

test('/?tag=lts/Dubnium', async (t) => {
  const res = await fetch(`${t.context.url}/?tag=lts/Dubnium`)
  t.is(await res.text(), 'v10.22.1')
})

test('/?tag=8.11.x', async (t) => {
  const res = await fetch(`${t.context.url}/?tag=8.11.x`)
  t.is(await res.text(), 'v8.11.4')
})

test('/?security=true', async (t) => {
  const res = await fetch(`${t.context.url}/?security=true`)
  t.is(await res.text(), 'v14.11.0')
})

test('/lts?security=true', async (t) => {
  const res = await fetch(`${t.context.url}/lts?security=true`)
  t.is(await res.text(), 'v12.18.4')
})

test('/lts/Carbon?security=true', async (t) => {
  const res = await fetch(`${t.context.url}/lts/Carbon?security=true`)
  t.is(await res.text(), 'v8.17.0')
})

test('/6.x?security=true', async (t) => {
  const res = await fetch(`${t.context.url}/6.x?security=true`)
  t.is(await res.text(), 'v6.17.0')
})

test('/13.x?security=true', async (t) => {
  const res = await fetch(`${t.context.url}/13.x?security=true`)
  t.is(res.status, 200)
  t.is(await res.text(), 'v13.8.0')
})

test('/?platform=linux&arch=armv6l', async (t) => {
  const res = await fetch(`${t.context.url}/?platform=linux&arch=armv6l`, {
    headers: { accept: 'application/json' },
  })
  const body = await res.json()
  t.is(res.status, 200)
  t.is(body.version, 'v14.13.0')
  t.is(
    body.url,
    'https://unofficial-builds.nodejs.org/download/release/v14.13.0/node-v14.13.0-linux-armv6l.tar.gz'
  )
  t.is(body.unofficial, true)
  t.is(body.tag, '*')
})

test('/?platform=linux&arch=armv7l&tag=12&format=json', async (t) => {
  const res = await fetch(
    `${t.context.url}/?platform=linux&arch=armv7l&tag=12&format=json`
  )
  const body = await res.json()
  t.is(res.status, 200)
  t.is(body.version, 'v12.18.4')
  t.is(
    body.url,
    'https://nodejs.org/dist/v12.18.4/node-v12.18.4-linux-armv7l.tar.gz'
  )
  t.is(body.unofficial, false)
  t.is(body.tag, '12')
})

test('/?platform=linux&arch=x64', async (t) => {
  const res = await fetch(`${t.context.url}/?platform=linux&arch=x64`, {
    headers: { accept: 'application/json' },
  })
  const body = await res.json()
  t.is(res.status, 200)
  t.is(body.version, 'v14.13.0')
  t.is(
    body.url,
    'https://nodejs.org/dist/v14.13.0/node-v14.13.0-linux-x64.tar.gz'
  )
  t.is(body.unofficial, false)
  t.is(body.tag, '*')
})

test('/?platform=darwin&arch=x64&format=json', async (t) => {
  const res = await fetch(
    `${t.context.url}/?platform=darwin&arch=x64&format=json`
  )
  const url = 'https://nodejs.org/dist/v14.13.0/node-v14.13.0-darwin-x64.tar.gz'
  const body = await res.json()
  t.is(res.status, 200)
  t.is(res.headers.get('x-download-url'), url)
  t.is(res.headers.get('x-node-version'), 'v14.13.0')
  t.is(body.version, 'v14.13.0')
  t.is(body.url, url)
  t.is(body.unofficial, false)
  t.is(body.tag, '*')
})
