import { pairingAddress } from './protocol.js'

const form = document.querySelector('#pair')
const code = document.querySelector('#code')
const stop = document.querySelector('#stop')
const status = document.querySelector('#status')
const pending = form.querySelector('button')

function show(active) {
  form.hidden = active
  stop.hidden = !active
  status.textContent = active ? '正在与 DSH 共享一个网页。' : ''
}

const current = await chrome.runtime.sendMessage({type: 'status'})
show(current?.active === true)

form.addEventListener('submit', async event => {
  event.preventDefault()
  const address = pairingAddress(code.value)
  if (!address) { status.textContent = '连接码无效。请从 DSH 浏览器 Tab 重新复制。'; return }
  pending.disabled = true
  status.textContent = '正在连接…'
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true})
    const reply = await chrome.runtime.sendMessage({type: 'share', address, tabId: tab?.id})
    if (reply?.error) throw new Error(reply.error)
    code.value = ''
    show(true)
  } catch (error) {
    status.textContent = error.message
  } finally {
    pending.disabled = false
  }
})

stop.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({type: 'stop'})
  show(false)
})
