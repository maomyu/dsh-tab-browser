import assert from 'node:assert/strict'
import { test } from 'node:test'
import { browserAddress, previewMessage, usesDesktopPage } from '../src/browser-navigation.js'

test('only known public sites use the embedded desktop page', () => {
  const url = browserAddress(' www.xiaohongshu.com/explore?foo=bar ')
  assert.equal(url, 'https://www.xiaohongshu.com/explore?foo=bar')
  assert.ok(usesDesktopPage(url))
  assert.ok(usesDesktopPage('https://rednote.com/'))
  assert.ok(!usesDesktopPage('https://xiaohongshu.com.example.test/'))
  assert.ok(!usesDesktopPage('https://www.xiaohongshu.com@danger.test/'))
  assert.ok(!usesDesktopPage('https://www.douyin.com/'))
  assert.equal(browserAddress('localhost:4173/test'), 'http://localhost:4173/test')
  assert.equal(browserAddress('localhost:4173/test', 'http://localhost:4173'), undefined)
  assert.equal(browserAddress('javascript:alert(1)'), undefined)
})

test('the Chrome preview accepts only well-formed messages', () => {
  const packet = message => ({type: 'dsh-native-chrome', message})
  assert.deepEqual(previewMessage(packet({type: 'status', mode: 'browser', url: '', title: ''})),
    {type: 'status', mode: 'browser', url: '', title: ''})
  assert.equal(previewMessage(packet({type: 'status', mode: 'invalid', url: '', title: ''})), undefined)
  assert.equal(previewMessage(packet({type: 'status', mode: 'browser', url: 'file:///tmp', title: ''})), undefined)
  assert.equal(previewMessage(packet({type: 'popup', url: 'https://example.test', token: 'invalid'})), undefined)
  assert.equal(previewMessage({type: 'dsh-native-chrome'}), undefined)
})
