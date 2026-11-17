import { useEffect, useRef, useState } from 'react'

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

function address(value) {
  const text = value.trim()
  if (!text) return undefined
  if (/^[\w.-]+:\d+(?:[/?#]|$)/u.test(text)) return 'http://' + text
  return /^[a-z][a-z\d+.-]*:/iu.test(text) ? text : 'https://' + text
}

export function NativeTab({tab, t, CookieImport, parseViewer}) {
  const key = tab.id
  const {revision, params} = tab.navigation
  const url = params?.url
  const popup = params?.chromePopup
  const frame = useRef(null)
  const locationField = useRef(null)
  const seen = useRef(null)
  const actual = useRef('')
  const [viewer, setViewer] = useState(null)
  const [generation, setGeneration] = useState(0)
  const [mode, setMode] = useState('browser')
  const [title, setTitle] = useState('')
  const [locationText, setLocationText] = useState(url ?? '')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState('')

  function accept(result) {
    setMode(result.mode)
    setTitle(result.title || '')
    actual.current = result.url || ''
    if (document.activeElement !== locationField.current) setLocationText(actual.current)
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
    return () => tab.signal.removeEventListener('abort', close)
  }, [key, tab.signal])

  useEffect(() => {
    if (!tab.visible || seen.current?.revision === revision && seen.current?.key === key) return
    seen.current = {revision, key}
    void run('attach', {url, popup})
  }, [tab.visible, revision, key, url, popup])

  useEffect(() => {
    if (!viewer) return
    const receive = event => {
      if (event.source !== frame.current?.contentWindow || event.origin !== viewer.origin ||
          event.data?.type !== 'dsh-native-chrome') return
      const message = event.data.message
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

  return <div data-dsh-tab-chrome="" className="chrome-native">
    <form className="chrome-address" onSubmit={event => {
      event.preventDefault()
      const url = address(locationText)
      if (!url) return
      locationField.current?.blur()
      void run('navigate', {url})
    }}>
      <button type="button" title={t('back')} aria-label={t('back')} disabled={busy || !viewer || mode !== 'browser'} onClick={() => run('back')}>‹</button>
      <button type="button" title={t('forward')} aria-label={t('forward')} disabled={busy || !viewer || mode !== 'browser'} onClick={() => run('forward')}>›</button>
      <button type="button" title={t('reload')} aria-label={t('reload')} disabled={busy || !viewer || mode !== 'browser'} onClick={() => run('reload')}>↻</button>
      <input ref={locationField} type="text" aria-label={t('address')} placeholder={t('address')} title={title || locationText}
        value={locationText} onChange={event => setLocationText(event.target.value)} spellCheck={false}
        onKeyDown={event => { if (event.key === 'Escape') setLocationText(actual.current) }}
        disabled={busy || mode !== 'browser'} />
      <button type="submit" hidden>{t('openPage')}</button>
      <button type="button" disabled={busy || mode === 'starting'} onClick={() => run(mode === 'manage' ? 'resume' : 'manage')}>
        {t(mode === 'manage' ? 'resume' : 'manage')}
      </button>
    </form>
    {viewer && mode === 'browser' && <div className="chrome-native-tools">
      <CookieImport t={t} applyImport={bundle => request(key, 'import', {bundle})} />
      {actual.current && <button type="button" disabled={busy} onClick={() => run('openWindow')}>{t('openWindow')}</button>}
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
