import { useEffect, useId, useRef, useState } from 'react'
import { browserAddress } from './browser-navigation.js'

export function BrowserToolbar({t, url, title, locked, canBack, canForward, canReload, onNavigate, onBack, onForward, onReload, children}) {
  const field = useRef(null)
  const id = useId()
  const [draft, setDraft] = useState(url)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (document.activeElement !== field.current) {
      setDraft(url)
      setInvalid(false)
    }
  }, [url])

  function submit(event) {
    event.preventDefault()
    if (!draft.trim()) return
    const target = browserAddress(draft, location.origin)
    if (!target) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    field.current?.blur()
    setDraft(target)
    onNavigate(target)
  }

  return <>
    <form className="chrome-address" aria-label={t('browser')} onSubmit={submit}>
      <button type="button" title={t('back')} aria-label={t('back')} disabled={!canBack} onClick={onBack}>‹</button>
      <button type="button" title={t('forward')} aria-label={t('forward')} disabled={!canForward} onClick={onForward}>›</button>
      <button type="button" title={t('reload')} aria-label={t('reload')} disabled={!canReload} onClick={onReload}>↻</button>
      <label className="chrome-sr-only" htmlFor={id}>{t('address')}</label>
      <input id={id} ref={field} type="text" inputMode="url" placeholder={t('address')} title={title || draft}
        value={draft} onChange={event => { setDraft(event.target.value); setInvalid(false) }}
        autoCapitalize="none" autoComplete="off" spellCheck={false}
        aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setDraft(url)
            setInvalid(false)
          }
        }} disabled={locked} />
      <button type="submit" hidden>{t('openPage')}</button>
      {children}
    </form>
    {invalid && <p id={`${id}-error`} className="chrome-alert" role="alert">{t('addressInvalid')}</p>}
  </>
}
