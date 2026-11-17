import { useEffect, useRef, useState } from 'react'
import { BrowserToolbar } from './browser-toolbar.jsx'
import { previewMessage } from './browser-navigation.js'

function request(key, action, data, keepalive = false) {
  return fetch(new URL('api/dsh-tab-browser/native', document.baseURI), {
    method: 'POST',
    headers: {'X-DSH-Chrome': '1', 'Content-Type': 'application/json'},
    body: JSON.stringify({key, action, ...data}),
    keepalive,
  }).then(async response => {
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    return result
  })
}

export function NativeTab({tab, t, navigation, CookieImport, parseViewer, onAddress}) {
  const [key] = useState(() => crypto.randomUUID())
  const {url, popup} = navigation
  const frame = useRef(null)
  const seen = useRef(null)
  const [viewer, setViewer] = useState(null)
  const [generation, setGeneration] = useState(0)
  const [mode, setMode] = useState('browser')
  const [title, setTitle] = useState('')
  const [address, setAddress] = useState(url ?? '')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState('')

  function accept(result) {
    setMode(result.mode)
    setTitle(result.title || '')
    setAddress(result.url || '')
  }

  async function run(action, data, reconnect = false) {
    setBusy(true)
    setError('')
    try {
      const result = await request(key, action, data)
      if (tab.signal.aborted) return
      if (result.viewer) {
        const next = parseViewer(result.viewer)
        setViewer(previous => previous?.href === next.href ? previous : next)
        if (reconnect) setGeneration(value => value + 1)
        accept(result)
      }
      setOffline(false)
      return result
    } catch (err) {
      if (!tab.signal.aborted) setError(err.message || t('failed'))
    } finally {
      if (!tab.signal.aborted) setBusy(false)
    }
  }

  useEffect(() => {
    const close = () => { void request(key, 'release', undefined, true).catch(() => {}) }
    tab.signal.addEventListener('abort', close, {once: true})
    return () => {
      tab.signal.removeEventListener('abort', close)
      if (!tab.signal.aborted) close()
    }
  }, [key, tab.signal])

  useEffect(() => {
    if (!tab.visible || seen.current === navigation) return
    seen.current = navigation
    if (!url && !popup && !viewer) return
    void run('attach', {url, popup})
  }, [tab.visible, navigation])

  useEffect(() => {
    if (!viewer) return
    const receive = event => {
      if (event.source !== frame.current?.contentWindow || event.origin !== viewer.origin) return
      const message = previewMessage(event.data)
      if (!message) return
      if (message.type === 'status') accept(message)
      if (message.type === 'offline') setOffline(true)
      if (message.type === 'ready') setOffline(false)
      if (message.type === 'popup') {
        tab.actions.openTab('browser', {params: {url: message.url, chromePopup: message.token}, revealIfOpened: false})
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [viewer, tab.actions])

  const canControl = !busy && viewer && mode === 'browser'
  return <div data-dsh-tab-chrome="" className="chrome-native">
    <BrowserToolbar t={t} url={address} title={title} locked={busy || mode !== 'browser'}
      canBack={canControl} canForward={canControl} canReload={canControl}
      onBack={() => run('back')} onForward={() => run('forward')} onReload={() => run('reload')}
      onNavigate={url => { if (!onAddress(url)) void run('navigate', {url}) }}>
      <button className="chrome-primary-tool" type="button" disabled={busy || mode === 'starting'}
        onClick={() => run(mode === 'manage' ? 'resume' : 'manage')}>
        {t(mode === 'manage' ? 'resume' : 'manage')}
      </button>
    </BrowserToolbar>
    {viewer && mode === 'browser' && <div className="chrome-native-tools">
      <CookieImport t={t} applyImport={bundle => request(key, 'import', {bundle})} />
      {address && <button type="button" disabled={busy} onClick={() => run('openWindow')}>{t('openWindow')}</button>}
    </div>}
    {(error || offline) && <div className="chrome-alert" role={error ? 'alert' : 'status'}>
      {error || t('disconnected')}
      <button type="button" disabled={busy} onClick={() => run('attach', viewer ? undefined : {url, popup}, true)}>{t('retry')}</button>
    </div>}
    {viewer && tab.visible && <iframe key={generation} ref={frame} title={title || 'Google Chrome'} src={viewer.href}
      sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />}
    {!viewer && busy && <p className="chrome-alert" role="status">{t('waiting')}</p>}
  </div>
}
