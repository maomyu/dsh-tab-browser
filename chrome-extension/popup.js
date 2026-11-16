const grant = { permissions: ['cookies'], origins: ['https://*.douyin.com/*'] }
const button = document.querySelector('#save')
const status = document.querySelector('#status')

const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
const address = URL.canParse(active?.url) ? new URL(active.url) : null
if (address?.protocol === 'https:' && (address.hostname === 'douyin.com' || address.hostname.endsWith('.douyin.com'))) {
  button.disabled = false
  status.textContent = address.hostname
}

button.addEventListener('click', async () => {
  button.disabled = true
  let granted = false
  try {
    granted = await chrome.permissions.request(grant)
    if (!granted) {
      status.textContent = '需要你批准读取抖音 Cookie 才能导出。'
      return
    }
    const [current] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (current?.id !== active.id || new URL(current.url).origin !== address.origin) {
      status.textContent = '请切回已登录的抖音标签页并重新打开扩展。'
      return
    }
    const store = (await chrome.cookies.getAllCookieStores()).find(candidate => candidate.tabIds.includes(active.id))
    if (!store) throw new Error()
    const cookies = (await chrome.cookies.getAll({ domain: 'douyin.com', storeId: store.id })).filter(cookie => {
      const domain = cookie.domain.replace(/^\./u, '')
      return !cookie.partitionKey && (address.hostname === domain || (!cookie.hostOnly && address.hostname.endsWith('.' + domain)))
    })
    if (!cookies.length) {
      status.textContent = '当前抖音站点没有可导出的 Cookie。'
      return
    }
    const body = new Blob([JSON.stringify({ origin: address.origin, cookies })], { type: 'application/json' })
    if (body.size > 96 * 1024 || cookies.length > 200) throw new Error()
    const url = URL.createObjectURL(body)
    const download = document.createElement('a')
    download.href = url
    download.download = 'dsh-douyin-cookies.json'
    download.click()
    status.textContent = '在 DSH「浏览器」Tab 导入下载的 JSON 文件。'
  } catch {
    status.textContent = '导出失败，请重新打开扩展后重试。'
  } finally {
    if (granted) await chrome.permissions.remove(grant).catch(() => {})
    button.disabled = false
  }
})
