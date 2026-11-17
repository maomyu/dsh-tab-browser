import { EventEmitter, once } from 'node:events'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

export class ChromePipe extends EventEmitter {
  constructor(executable, directory, headless) {
    super()
    this.next = 0
    this.pending = new Map()
    this.child = spawn(executable, [
      '--remote-debugging-pipe', `--user-data-dir=${directory}`, '--no-first-run', '--no-default-browser-check',
      '--disable-search-engine-choice-screen', '--no-service-autorun',
      ...(headless ? ['--headless', '--window-size=1280,900', 'about:blank'] : []),
    ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] })
    this.child.stdio[4].setEncoding('utf8')
    let partial = ''
    this.child.stdio[4].on('data', chunk => {
      const records = (partial + chunk).split('\0')
      partial = records.pop()
      for (const record of records) {
        let message
        try { message = JSON.parse(record) } catch { continue }
        const request = this.pending.get(message.id)
        if (request) {
          this.pending.delete(message.id)
          clearTimeout(request.timeout)
          if (message.error) request.reject(new Error(message.error.message))
          else request.resolve(message.result)
        } else if (message.method) this.emit(message.method, message.params, message.sessionId)
      }
    })
    const end = () => {
      if (this.ended) return
      this.ended = true
      for (const request of this.pending.values()) {
        clearTimeout(request.timeout)
        request.reject(new Error('Chrome 连接已结束。'))
      }
      this.pending.clear()
      this.emit('stopped')
    }
    this.child.once('error', end)
    this.child.once('exit', end)
    this.child.stdio[3].on('error', end)
    this.child.stdio[4].on('error', end)
  }

  send(method, params = {}, sessionId, timeoutMs = 10_000) {
    if (this.ended) return Promise.reject(new Error('Chrome 连接已结束。'))
    const id = ++this.next
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`Chrome ${method} 响应超时。`))
      }, timeoutMs)
      this.pending.set(id, {resolve, reject, timeout})
      this.child.stdio[3].write(JSON.stringify({id, method, params, sessionId}) + '\0')
    })
  }

  async close() {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return
    const exited = once(this.child, 'exit').catch(() => {})
    const request = this.send('Browser.close').catch(() => {})
    await Promise.race([exited, delay(10_000, undefined, { ref: false })])
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill('SIGTERM')
      await Promise.race([exited, delay(3000, undefined, { ref: false })])
    }
    if (this.child.exitCode === null && this.child.signalCode === null) {
      throw new Error('请先结束扩展管理窗口，再返回 DSH。')
    }
    await request
  }
}
