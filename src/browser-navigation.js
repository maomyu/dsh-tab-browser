import { webAddress } from './page-input.js'

export function browserAddress(value, applicationOrigin) {
  const input = value.trim()
  if (!input) return undefined
  let candidate = input
  if (/^[\w.-]+:\d+(?:[/?#]|$)/u.test(input)) candidate = 'http://' + input
  else if (!/^[a-z][a-z\d+.-]*:/iu.test(input)) candidate = 'https://' + input
  const address = webAddress(candidate)
  if (address && new URL(address).origin !== applicationOrigin) return address
}

export function usesDesktopPage(value) {
  const address = webAddress(value)
  if (!address) return false
  const host = new URL(address).hostname
  return ['xiaohongshu.com', 'www.xiaohongshu.com', 'rednote.com', 'www.rednote.com'].includes(host)
}

export function previewMessage(data) {
  const message = data?.type === 'dsh-native-chrome' ? data.message : undefined
  if (message?.type === 'offline' || message?.type === 'ready') return {type: message.type}
  if (message?.type === 'status' && ['browser', 'starting', 'manage'].includes(message.mode)) {
    const url = message.url === '' ? '' : webAddress(message.url)
    if (url === undefined || typeof message.title !== 'string') return undefined
    return {type: 'status', mode: message.mode, url, title: message.title.slice(0, 512)}
  }
  if (message?.type === 'popup') {
    const url = webAddress(message.url)
    if (url && typeof message.token === 'string' && /^[a-f0-9-]{36}$/u.test(message.token)) {
      return {type: 'popup', token: message.token, url}
    }
  }
}
