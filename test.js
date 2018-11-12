'use strict'

const fetch = require('node-fetch')
const fetchMock = require('fetch-mock')
const listen = require('test-listen')
const proxyquire = require('proxyquire')
const micro = require('micro')
const { test } = require('ava')

const mockedFetch = fetchMock
  .sandbox()
  .mock('https://nodejs.org/dist/index.json', [
    { version: 'v11.1.0', lts: false },
    { version: 'v10.13.0', lts: 'Dubnium' },
    { version: 'v8.12.0', lts: 'Carbon' },
    { version: 'v8.11.4', lts: 'Carbon' }
  ])

const api = proxyquire('.', {
  'node-fetch': mockedFetch
})

test.beforeEach(async t => {
  const service = (t.context.service = micro(api))
  t.context.url = await listen(service)
})

test.afterEach.always(async t => {
  await t.context.service.close()
})

test('should prefer `text/plain`', async t => {
  const { headers } = await fetch(t.context.url)
  t.is(headers.get('content-type'), 'text/plain')
})

test('should honor `application/json`', async t => {
  const { headers } = await fetch(t.context.url, {
    headers: { accept: 'application/json' }
  })
  t.regex(headers.get('content-type'), /application\/json/)
})

test('/', async t => {
  const res = await fetch(t.context.url)
  t.is(await res.text(), 'v11.1.0')
})

test('/lts', async t => {
  const res = await fetch(`${t.context.url}/lts`)
  t.is(await res.text(), 'v10.13.0')
})

test('/8.x', async t => {
  const res = await fetch(`${t.context.url}/8.x`)
  t.is(await res.text(), 'v8.12.0')
})

test('/?tag=lts', async t => {
  const res = await fetch(`${t.context.url}/?tag=lts`)
  t.is(await res.text(), 'v10.13.0')
})

test('/?tag=8.11.x', async t => {
  const res = await fetch(`${t.context.url}/?tag=8.11.x`)
  t.is(await res.text(), 'v8.11.4')
})
