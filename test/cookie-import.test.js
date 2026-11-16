import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepareCookieImport } from '../src/cookie-import.js'

const origin = 'https://www.example.com'
const firstParty = { name: 'fixture', value: 'fake-value', domain: '.example.com', path: '/account',
  hostOnly: false, secure: true, httpOnly: true, sameSite: 'lax', expirationDate: 2000 }

test('cookie import preserves scope and attributes and skips expired and partitioned cookies', () => {
  const own = { ...firstParty, domain: 'www.example.com', hostOnly: true, session: true }
  const prepared = prepareCookieImport({ origin, cookies: [
    firstParty, own, { ...own, expirationDate: 80 }, { ...own, partitionKey: { topLevelSite: origin } },
  ] }, 100)
  assert.deepEqual(prepared, { origin, cookies: [
    { name: 'fixture', value: 'fake-value', url: origin, path: '/account', secure: true, httpOnly: true, sameSite: 'Lax', domain: '.example.com', expires: 2000 },
    { name: 'fixture', value: 'fake-value', url: origin, path: '/account', secure: true, httpOnly: true, sameSite: 'Lax' },
  ] })
})

test('a single-site import rejects unrelated domains and host-only cookies for a different hostname', () => {
  for (const record of [
    { ...firstParty, domain: '.other.test' },
    { ...firstParty, domain: 'example.com', hostOnly: true },
    { ...firstParty, domain: 'sibling.example.com' },
  ]) {
    assert.throws(() => prepareCookieImport({ origin, cookies: [firstParty, record] }, 100))
  }
  for (const unsafe of ['file:///Users/demo', 'https://www.example.com/path', 'http://www.example.com']) {
    assert.throws(() => prepareCookieImport({ origin: unsafe, cookies: [firstParty] }, 100))
  }
})
