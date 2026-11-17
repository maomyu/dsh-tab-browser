import { useEffect, useRef, useState } from 'react'
import { NativeTab } from './native-tab.jsx'
import { MAX_COOKIE_FILE, prepareCookieImport } from './cookie-import.js'

const ID = 'dsh-tab-browser'
const SLOT = 'sidebar.right.pane.tab'
let lastViewer
let navigations = new WeakMap()
const messages = {
  zh: {
    back: '后退', forward: '前进', reload: '刷新', address: '输入网址', openPage: '打开网页',
    manage: '管理扩展', resume: '返回浏览', openWindow: '在 Chrome 窗口打开', disconnected: '网页连接已结束。',
    browser: '浏览器', title: 'Google Chrome', description: '在侧栏浏览网页',
    start: '启动 Chrome', retry: '重试', waiting: '正在启动 Chrome…',
    firstRun: '首次启动需要下载浏览器。Chrome 使用独立的浏览器资料。',
    local: '请在本机 DSH 桌面版或本机 Web 界面打开。',
    failed: 'Chrome 启动失败。',
    importCookies: '导入网站 Cookie', importConfirm: '导入并打开', cancel: '取消', importing: '正在导入…',
    invalidFile: '请选择有效的单站点 Cookie JSON 文件。', importFailed: 'Cookie 导入失败，请重试。',
    imported: 'Cookie 已导入。请在网页确认登录状态。', manualOpen: 'Cookie 已导入。请在 Chrome 打开该网站。',
    keyring: '密钥环自动解锁', keyringHelp: '输入独立 Chrome 原有的密钥环密码。密码保存到本机 macOS 钥匙串。',
    keyringPassword: '密钥环密码', keyringSave: '保存并开启', keyringForget: '关闭自动解锁',
    keyringSaved: '已开启。下次启动会自动解锁。', keyringForgotten: '已关闭自动解锁。',
    invalidPassword: '密码未通过核对。请确认已创建密钥环，并输入原来设置的密码。',
    keyringFailed: '无法更新自动解锁设置，请重试。', keyringWorking: '正在处理…',
  },
  en: {
    back: 'Back', forward: 'Forward', reload: 'Reload', address: 'Enter a URL', openPage: 'Open page',
    manage: 'Manage extensions', resume: 'Return to browsing', openWindow: 'Open in a Chrome window', disconnected: 'The page disconnected.',
    browser: 'Browser', title: 'Google Chrome', description: 'Browse the web in the sidebar',
    start: 'Start Chrome', retry: 'Try again', waiting: 'Starting Chrome…',
    firstRun: 'The first launch downloads Chrome. This browser uses its own profile.',
    local: 'Open this tab in the local DSH desktop app or a local DSH web session.',
    failed: 'Chrome could not start.',
    importCookies: 'Import site cookies', importConfirm: 'Import and open', cancel: 'Cancel', importing: 'Importing…',
    invalidFile: 'Choose a valid single-site cookie JSON file.', importFailed: 'Cookie import failed. Please try again.',
    imported: 'Cookies imported. Check your sign-in status on the website.', manualOpen: 'Cookies imported. Open the website in Chrome.',
    keyring: 'Unlock keyring automatically', keyringHelp: 'Enter the separate Chrome keyring password. It will be saved to your Mac Keychain.',
    keyringPassword: 'Keyring password', keyringSave: 'Save and enable', keyringForget: 'Turn off automatic unlock',
    keyringSaved: 'Enabled. Chrome will unlock the keyring on its next launch.', keyringForgotten: 'Automatic unlock is off.',
    invalidPassword: 'Could not verify the password. Set up a keyring first and enter its existing password.',
    keyringFailed: 'Could not update automatic unlock. Please try again.', keyringWorking: 'Working…',
  },
}

function localClient() {
  return window.dshDesktop?.protocolVersion === 1 || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
}

function nativeClient() {
  return window.dshDesktop?.protocolVersion === 1 && navigator.userAgent.includes('Macintosh')
}

function parseViewer(value) {
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password ||
      !/^\/[A-Za-z0-9_-]{43}\/$/u.test(url.pathname) || url.search || url.hash) throw new Error()
  return url
}

function CookieImport({ t, applyImport }) {
  const picker = useRef(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  async function chooseFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setStatus(null)
    setSelected(null)
    try {
      if (file.size > MAX_COOKIE_FILE) throw new Error()
      const text = await file.text()
      const plan = prepareCookieImport(JSON.parse(text))
      setSelected({ text, origin: plan.origin })
    } catch {
      setStatus({ error: true, key: 'invalidFile' })
    }
  }

  async function submit() {
    setLoading(true)
    setStatus(null)
    try {
      let result
      if (applyImport) result = await applyImport(JSON.parse(selected.text))
      else {
        const response = await fetch(new URL('api/dsh-tab-browser/cookies', document.baseURI), {
          method: 'POST', headers: { 'X-DSH-Chrome': '1', 'Content-Type': 'application/json' },
          body: selected.text,
        })
        if (!response.ok) throw new Error()
        result = await response.json()
      }
      setSelected(null)
      setStatus({ key: result.opened ? 'imported' : 'manualOpen' })
    } catch {
      setStatus({ error: true, key: 'importFailed' })
    } finally {
      setLoading(false)
    }
  }

  return <div className="chrome-import">
    <input type="file" aria-label={t('importCookies')} accept=".json,application/json" ref={picker} onChange={chooseFile} hidden />
    {selected ? <>
      <p>{selected.origin}</p>
      <button type="button" disabled={loading} onClick={submit}>{t(loading ? 'importing' : 'importConfirm')}</button>
      <button type="button" disabled={loading} onClick={() => { setSelected(null); setStatus(null) }}>{t('cancel')}</button>
    </> : <button type="button" onClick={() => picker.current?.click()}>{t('importCookies')}</button>}
    {status && <p role={status.error ? 'alert' : 'status'}>{t(status.key)}</p>}
  </div>
}

function KeyringSettings({ t }) {
  const input = useRef(null)
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState(null)
  const endpoint = new URL('api/dsh-tab-browser/keyring', document.baseURI)
  const headers = { 'X-DSH-Chrome': '1' }

  async function toggle() {
    if (!open) {
      setMessage(null)
      try {
        const response = await fetch(endpoint, { headers })
        if (!response.ok) throw new Error()
        setEnabled((await response.json()).enabled)
      } catch {
        setMessage({ key: 'keyringFailed', error: true })
        return
      }
    }
    setOpen(!open)
  }

  async function change(method, body) {
    setWorking(true)
    setMessage(null)
    try {
      const response = await fetch(endpoint, { method, headers, body })
      const result = await response.json()
      if (!response.ok) {
        setMessage({ key: result.error === 'invalidPassword' ? 'invalidPassword' : 'keyringFailed', error: true })
        return
      }
      setEnabled(result.enabled)
      setMessage({ key: result.enabled ? 'keyringSaved' : 'keyringForgotten' })
    } catch {
      setMessage({ key: 'keyringFailed', error: true })
    } finally {
      setWorking(false)
    }
  }

  return <div className="chrome-import">
    <button type="button" aria-expanded={open} disabled={working} onClick={toggle}>{t('keyring')}</button>
    {open && <form className="chrome-keyring" onSubmit={event => {
      event.preventDefault()
      const password = input.current.value
      input.current.value = ''
      void change('POST', password)
    }}>
      <p>{t('keyringHelp')}</p>
      <input type="password" ref={input} required autoComplete="off" aria-label={t('keyringPassword')} maxLength={1024} />
      <button type="submit" disabled={working}>{t(working ? 'keyringWorking' : 'keyringSave')}</button>
      {enabled && <button type="button" disabled={working} onClick={() => change('DELETE')}>{t('keyringForget')}</button>}
    </form>}
    {message && <p role={message.error ? 'alert' : 'status'}>{t(message.key)}</p>}
  </div>
}

function ChromeTab({ tab, t }) {
  const { revision, params } = tab.navigation
  const url = params?.url
  const [viewer, setViewer] = useState(lastViewer)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const frame = useRef(null)
  const request = useRef(null)
  const local = localClient()

  async function connect({ target, newPage = false, reconnect = false } = {}) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    if (reconnect) setViewer(null)
    setStarting(true)
    setError('')
    try {
      const response = await fetch(new URL('api/dsh-tab-browser/connect', document.baseURI), {
        method: 'POST', headers: { 'X-DSH-Chrome': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, newPage }), signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : t('failed'))
      if (controller.signal.aborted) return
      const next = parseViewer(result.url)
      if (reconnect || lastViewer?.url.href !== next.href) {
        lastViewer = { url: next, generation: (lastViewer?.generation ?? 0) + 1 }
      }
      setViewer(lastViewer)
    } catch (error) {
      if (!controller.signal.aborted) {
        setViewer(null)
        lastViewer = undefined
        setError(error?.message || t('failed'))
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setStarting(false)
      }
    }
  }

  useEffect(() => () => {
    request.current?.abort()
    request.current = null
  }, [])
  useEffect(() => {
    if (!local || !tab.visible) return
    const previous = navigations.get(tab.signal)
    if (previous === revision && (lastViewer || request.current)) return
    navigations.set(tab.signal, revision)
    if (typeof url === 'string' && previous !== revision) void connect({ target: url })
    else if (lastViewer && previous !== undefined && previous !== revision) void connect({ newPage: true })
    else if (!lastViewer) void connect()
  }, [local, tab.visible, tab.signal, revision, url])
  useEffect(() => {
    if (!viewer) return
    const reconnect = event => {
      if (event.source === frame.current?.contentWindow && event.origin === viewer.url.origin &&
          event.data?.type === 'dsh-chrome-reconnect') void connect({ reconnect: true })
    }
    window.addEventListener('message', reconnect)
    return () => window.removeEventListener('message', reconnect)
  }, [viewer])

  return <div data-dsh-tab-chrome="">
    {viewer && local && <div className="chrome-tools">
      <CookieImport t={t} />
      {window.dshDesktop?.protocolVersion === 1 && navigator.userAgent.includes('Macintosh') && <KeyringSettings t={t} />}
    </div>}
    {viewer ? (tab.visible && <iframe key={viewer.generation} ref={frame} title="Google Chrome" src={viewer.url.href}
      sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />) :
      <section className="chrome-start">
        <h2>{t('title')}</h2>
        <p>{t(local ? 'description' : 'local')}</p>
        {local && <>
          <button type="button" onClick={() => connect({ target: url })} disabled={starting}>{t(starting ? 'waiting' : error ? 'retry' : 'start')}</button>
          {error ? <p role="alert">{error}</p> : <p className="chrome-note">{t('firstRun')}</p>}
        </>}
      </section>}
  </div>
}

function BrowserTab({ useTabInfo, t }) {
  const { tab } = useTabInfo()
  if (nativeClient()) {
    return <NativeTab tab={tab} t={t} CookieImport={CookieImport} parseViewer={parseViewer} />
  }
  return <ChromeTab tab={tab} t={t} />
}

const css = `
[data-dsh-tab-chrome]{display:flex;flex-direction:column;flex:1;width:100%;height:100%;min-height:0;min-width:0;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
[data-dsh-tab-chrome] iframe{display:block;flex:1;width:100%;height:100%;min-width:0;min-height:0;border:0}
[data-dsh-tab-chrome] .chrome-start{margin:auto;display:grid;gap:10px;justify-items:start;padding:24px;max-width:360px;white-space:normal}
[data-dsh-tab-chrome] h2{font-size:25px;line-height:1.2;font-weight:600;margin:0 0 3px}
[data-dsh-tab-chrome] p{margin:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
[data-dsh-tab-chrome] .chrome-note{color:var(--dsw-alias-label-secondary);font-size:12px}
[data-dsh-tab-chrome] button{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;font:inherit;font-size:13px;padding:8px 14px;cursor:pointer}
[data-dsh-tab-chrome] button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
[data-dsh-tab-chrome] button:disabled{cursor:wait;opacity:.65}
[data-dsh-tab-chrome] .chrome-import{display:flex;flex:none;flex-wrap:wrap;align-items:center;gap:6px;padding:5px 8px}
[data-dsh-tab-chrome] .chrome-import button{font-size:12px;padding:3px 8px}
[data-dsh-tab-chrome] .chrome-import p{min-width:0;font-size:12px}
[data-dsh-tab-chrome] .chrome-tools,[data-dsh-tab-chrome] .chrome-keyring{display:flex;align-items:center;flex-wrap:wrap;gap:4px}
[data-dsh-tab-chrome] .chrome-keyring input{min-width:0;max-width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit;padding:3px 8px}
[data-dsh-tab-chrome] .chrome-address{display:flex;align-items:center;gap:4px;padding:6px 8px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l2)}
[data-dsh-tab-chrome] .chrome-address input{flex:1;min-width:0;height:29px;box-sizing:border-box;padding:0 8px;font:inherit;font-size:13px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit}
[data-dsh-tab-chrome] .chrome-address button,[data-dsh-tab-chrome] .chrome-alert button{padding:4px 7px;white-space:nowrap}
[data-dsh-tab-chrome] .chrome-address button[hidden]{display:none}
[data-dsh-tab-chrome] .chrome-native-tools{display:flex;align-items:center;flex:none;flex-wrap:wrap}
[data-dsh-tab-chrome] .chrome-native-tools>button{font-size:12px;padding:3px 8px;margin:0 8px}
[data-dsh-tab-chrome] .chrome-alert{display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:12px}
`

export const inject = ['sidebarRightTabs', 'slots', 'locale']

export function apply(ctx) {
  const namespace = 'dshChromeTab'
  const t = ctx.locale.bind(namespace)
  ctx.effect(() => ctx.locale.register(namespace, messages), `${ID}: copy`)
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: ID, kind: 'browser', priority: 'extension', multiple: nativeClient(), keepMounted: nativeClient(), title: () => t('browser'),
    guide: [{ id: 'new', commandId: 'browser.new', order: 30, title: () => t('browser'), description: () => t('description') }],
  }), `${ID}: tab`)
  ctx.effect(() => ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT, key: ID, locale: namespace }, BrowserTab)), `${ID}: body`)
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
    return () => {
      style.remove()
      lastViewer = undefined
      navigations = new WeakMap()
    }
  }, `${ID}: styles`)
}
