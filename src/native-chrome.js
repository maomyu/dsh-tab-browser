import { createHash, randomUUID } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { ChromePipe } from './chrome-pipe.js'
import { webAddress } from './page-input.js'

const pointerTypes = {press: 'mousePressed', release: 'mouseReleased', move: 'mouseMoved', wheel: 'mouseWheel'}
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export class NativeChrome {
  constructor(profile = 'desktop') {
    const configured = resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh'))
    const home = existsSync(configured) ? realpathSync(configured) : configured
    const id = createHash('sha256').update(`${home}\0${profile}`).digest('hex').slice(0, 20)
    this.directory = join(home, 'browser-data', `dsh-chrome-${id}`)
    this.tabs = new Map()
    this.popups = new Map()
    this.claimed = new Set()
    this.sessions = new Map()
    this.mode = 'browser'
  }

  async start(mode = 'browser', managerUrl = 'chrome://extensions/') {
    if (this.pipe && !this.pipe.ended) return
    if (this.pipe) await this.closePipe()
    const executable = [chromePath, join(homedir(), chromePath.slice(1))].find(existsSync)
    if (!executable) throw new Error('请先安装 Google Chrome。')
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const pipe = new ChromePipe(executable, this.directory, mode === 'browser')
    this.pipe = pipe
    pipe.on('stopped', () => {
      if (this.pipe !== pipe) return
      const managing = this.mode === 'manage'
      this.clearPages()
      this.mode = 'browser'
      for (const tab of this.tabs.values()) {
        tab.notify?.(this.status(tab))
        tab.notify?.({type: 'offline'})
      }
      if (managing) void this.onManagerClosed?.()
    })
    pipe.on('Target.targetCreated', ({targetInfo}) => this.targetChanged(targetInfo))
    pipe.on('Target.targetInfoChanged', ({targetInfo}) => this.targetChanged(targetInfo))
    pipe.on('Page.loadEventFired', (_params, session) => {
      const targetId = this.sessions.get(session)?.target
      if (targetId) void pipe.send('Target.getTargetInfo', {targetId})
        .then(({targetInfo}) => this.targetChanged(targetInfo)).catch(() => {})
    })
    pipe.on('Target.targetDestroyed', ({targetId}) => {
      this.claimed.delete(targetId)
      for (const [token, id] of this.popups) if (id === targetId) this.popups.delete(token)
      for (const tab of this.tabs.values()) {
        if (tab.target !== targetId) continue
        this.sessions.delete(tab.session)
        tab.target = tab.session = undefined
        tab.casting = false
        tab.notify?.({type: 'offline'})
      }
    })
    pipe.on('Page.screencastFrame', (frame, session) => {
      void pipe.send('Page.screencastFrameAck', {sessionId: frame.sessionId}, session).catch(() => {})
      const tab = this.sessions.get(session)
      if (tab?.peers.size && this.mode === 'browser') {
        if (frame.metadata.deviceWidth > 0 && frame.metadata.deviceHeight > 0) {
          tab.viewport = {width: frame.metadata.deviceWidth, height: frame.metadata.deviceHeight}
        }
        tab.notify?.({type: 'frame', data: frame.data})
      }
    })
    try {
      await pipe.send('Browser.getVersion', {}, undefined, 25_000)
      if (mode === 'browser') await pipe.send('Target.setDiscoverTargets', {discover: true})
      else {
        const {targetId} = await pipe.send('Target.createTarget', {url: managerUrl})
        await pipe.send('Target.activateTarget', {targetId})
      }
    } catch (error) {
      await pipe.close().catch(() => {})
      throw error
    }
  }

  targetChanged(info) {
    if (this.mode !== 'browser' || info.type !== 'page') return
    for (const tab of this.tabs.values()) {
      if (tab.target === info.targetId) {
        if (webAddress(info.url)) tab.url = info.url
        tab.title = info.title
        tab.notify?.(this.status(tab))
        return
      }
    }
    if (!info.openerId || !webAddress(info.url) || this.claimed.has(info.targetId)) return
    const parent = [...this.tabs.values()].find(tab => tab.target === info.openerId)
    if (!parent) return
    this.claimed.add(info.targetId)
    const token = randomUUID()
    this.popups.set(token, info.targetId)
    parent.notify?.({type: 'popup', token, url: info.url})
  }

  status(tab) {
    return {type: 'status', mode: this.mode, url: tab.url, title: tab.title}
  }

  tab(key) {
    if (!this.tabs.has(key)) this.tabs.set(key, {
      key, peers: new Set(), url: '', title: '', width: 1280, height: 900,
      viewport: {width: 1280, height: 900}, loading: undefined, casting: false, watch: Promise.resolve(),
    })
    return this.tabs.get(key)
  }

  async page(tab, popup) {
    if (tab.session) return
    if (!tab.loading) {
      tab.loading = this.createPage(tab, popup).finally(() => { tab.loading = undefined })
    }
    await tab.loading
  }

  async createPage(tab, popup) {
    const fromPopup = this.popups.get(popup)
    if (fromPopup) this.popups.delete(popup)
    const target = fromPopup ?? (await this.pipe.send('Target.createTarget', {url: 'about:blank', background: true})).targetId
    try {
      const {sessionId} = await this.pipe.send('Target.attachToTarget', {targetId: target, flatten: true})
      tab.target = target
      tab.session = sessionId
      this.sessions.set(sessionId, tab)
      await this.pipe.send('Page.enable', {}, sessionId)
      await this.resize(tab)
      if (fromPopup) {
        const {targetInfo} = await this.pipe.send('Target.getTargetInfo', {targetId: target})
        this.targetChanged(targetInfo)
      } else if (tab.url) await this.navigate(tab, tab.url)
    } catch (error) {
      this.sessions.delete(tab.session)
      tab.session = tab.target = undefined
      await this.pipe.send('Target.closeTarget', {targetId: target}).catch(() => {})
      throw error
    }
  }

  resize(tab) {
    return this.pipe.send('Emulation.setDeviceMetricsOverride', {
      width: tab.width, height: tab.height, deviceScaleFactor: 1, mobile: false,
    }, tab.session)
  }

  async navigate(tab, url) {
    tab.url = url
    const result = await this.pipe.send('Page.navigate', {url}, tab.session)
    if (result.errorText && result.errorText !== 'net::ERR_ABORTED') throw new Error('Chrome 无法打开这个网页。')
    tab.notify?.(this.status(tab))
  }

  async history(tab, direction) {
    const {currentIndex, entries} = await this.pipe.send('Page.getNavigationHistory', {}, tab.session)
    const target = entries[currentIndex + direction]
    if (target && webAddress(target.url)) await this.pipe.send('Page.navigateToHistoryEntry', {entryId: target.id}, tab.session)
  }

  watching(tab) {
    tab.watch = tab.watch.catch(() => {}).then(async () => {
      if (this.mode !== 'browser' || !tab.session || this.pipe?.ended) return
      const visible = tab.peers.size > 0
      if (tab.casting === visible) return
      if (visible) {
        await this.pipe.send('Target.activateTarget', {targetId: tab.target})
        await this.pipe.send('Page.startScreencast', {format: 'jpeg', quality: 72, maxWidth: 1440, maxHeight: 1000}, tab.session)
      } else await this.pipe.send('Page.stopScreencast', {}, tab.session)
      tab.casting = visible
    }).catch(() => tab.notify?.({type: 'offline'}))
    return tab.watch
  }

  async input(tab, event) {
    if (this.mode !== 'browser' || !tab.session || !tab.peers.size) return
    const {action, x, y, button, buttons, modifiers, dx, dy, clickCount} = event
    if (event.type === 'size') {
      if (event.width === tab.width && event.height === tab.height) return
      tab.width = event.width
      tab.height = event.height
      await this.resize(tab)
    } else if (event.type === 'text') {
      await this.pipe.send('Input.insertText', {text: event.text}, tab.session)
    } else if (event.type === 'key') {
      const {down, key, code, keyCode, repeat} = event
      const text = down && (modifiers & 7) === 0 && [...key].length === 1 ? key : undefined
      await this.pipe.send('Input.dispatchKeyEvent', {
        type: down ? (text ? 'keyDown' : 'rawKeyDown') : 'keyUp', key, code, modifiers,
        windowsVirtualKeyCode: keyCode, autoRepeat: repeat, ...(text ? {text, unmodifiedText: text} : {}),
      }, tab.session)
    } else {
      await this.pipe.send('Input.dispatchMouseEvent', {
        type: pointerTypes[action], x: x * (tab.viewport.width - 1), y: y * (tab.viewport.height - 1),
        button, buttons, modifiers, clickCount, ...(action === 'wheel' ? {deltaX: dx, deltaY: dy} : {}),
      }, tab.session)
    }
  }

  async changeMode(mode, managerUrl) {
    if (this.mode === mode && this.pipe && !this.pipe.ended) return
    this.mode = 'starting'
    for (const tab of this.tabs.values()) tab.notify?.(this.status(tab))
    try {
      await this.closePipe()
      await this.start(mode, managerUrl)
      this.mode = mode
    } catch (error) {
      this.mode = 'browser'
      for (const tab of this.tabs.values()) {
        tab.notify?.(this.status(tab))
        tab.notify?.({type: 'offline'})
      }
      throw error
    }
    for (const tab of this.tabs.values()) {
      tab.notify?.(this.status(tab))
      if (mode === 'browser' && tab.peers.size) {
        await this.page(tab).catch(() => tab.notify?.({type: 'offline'}))
        await this.watching(tab)
      }
    }
  }

  async release(tab) {
    this.tabs.delete(tab.key)
    if (tab.loading) await tab.loading.catch(() => {})
    this.sessions.delete(tab.session)
    if (tab.target && this.mode === 'browser') {
      await this.pipe?.send('Target.closeTarget', {targetId: tab.target}).catch(() => {})
    }
  }

  clearPages() {
    for (const tab of this.tabs.values()) {
      tab.session = tab.target = undefined
      tab.casting = false
    }
    this.sessions.clear()
    this.popups.clear()
    this.claimed.clear()
  }

  async closePipe() {
    const pipe = this.pipe
    this.pipe = undefined
    this.clearPages()
    try { await pipe?.close() }
    catch (error) {
      this.pipe = pipe
      throw error
    }
  }
}
