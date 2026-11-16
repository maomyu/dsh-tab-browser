export const MAX_COOKIE_FILE = 96 * 1024
const sameSites = new Map([['lax', 'Lax'], ['strict', 'Strict'], ['no_restriction', 'None'], ['none', 'None']])

export function prepareCookieImport(data, now = Date.now() / 1000) {
  const invalid = () => new Error('请选择一个有效的单站点 Cookie JSON 文件。')
  if (typeof data?.origin !== 'string' || !Array.isArray(data.cookies) || !data.cookies.length || data.cookies.length > 200) {
    throw invalid()
  }
  let target
  try { target = new URL(data.origin) } catch { throw invalid() }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  if ((target.protocol !== 'https:' && !(local && target.protocol === 'http:')) ||
      target.username || target.password || target.origin !== data.origin) throw invalid()

  const cookies = []
  for (const entry of data.cookies) {
    if (entry?.partitionKey || (typeof entry?.expirationDate === 'number' && entry.expirationDate <= now)) continue
    const domain = typeof entry?.domain === 'string' ? entry.domain.toLowerCase().replace(/^\./u, '') : ''
    const hostOnly = entry?.hostOnly ?? !entry?.domain?.startsWith?.('.')
    if (!domain || (domain !== target.hostname && (hostOnly || !target.hostname.endsWith('.' + domain))) ||
        typeof entry.name !== 'string' || !entry.name || typeof entry.value !== 'string' ||
        entry.name.length + entry.value.length > 4096 || /[\x00-\x1f\x7f;]/u.test(entry.name + entry.value) ||
        typeof entry.path !== 'string' || !entry.path.startsWith('/') || entry.path.length > 1024) throw invalid()

    const cookie = { name: entry.name, value: entry.value, url: target.origin, path: entry.path,
      secure: entry.secure === true, httpOnly: entry.httpOnly === true }
    if (!hostOnly) cookie.domain = '.' + domain
    const sameSite = sameSites.get(typeof entry.sameSite === 'string' ? entry.sameSite.toLowerCase() : '')
    if (sameSite) cookie.sameSite = sameSite
    if (Number.isFinite(entry.expirationDate) && entry.session !== true) cookie.expires = entry.expirationDate
    cookies.push(cookie)
  }
  if (!cookies.length) throw new Error('文件中没有可导入的 Cookie。')
  if (new TextEncoder().encode(JSON.stringify(cookies)).length > 128 * 1024) throw invalid()
  return { origin: target.origin, cookies }
}
