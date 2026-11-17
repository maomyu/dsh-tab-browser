export function webAddress(value) {
  if (typeof value !== 'string' || value.length > 16_384) return undefined
  try {
    const url = new URL(value)
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href
  } catch { /* Invalid navigation input. */ }
}

function limit(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max
}

export function inputMessage(value) {
  if (!value || typeof value !== 'object') return undefined
  if (value.type === 'text') {
    if (typeof value.text === 'string' && value.text.length > 0 && value.text.length <= 4096) return {type: 'text', text: value.text}
    return undefined
  }
  if (value.type === 'size') {
    const {width, height} = value
    if (Number.isInteger(width) && Number.isInteger(height) && limit(width, 320, 1440) && limit(height, 240, 1000)) {
      return {type: 'size', width, height}
    }
    return undefined
  }
  const { modifiers } = value
  if (!Number.isInteger(modifiers) || !limit(modifiers, 0, 15)) return undefined
  if (value.type === 'key') {
    const { down, key, code, repeat, keyCode } = value
    if (typeof down !== 'boolean' || typeof key !== 'string' || !limit(key.length, 1, 32) || typeof code !== 'string' ||
        !/^[a-zA-Z0-9]{0,40}$/u.test(code) || !Number.isInteger(keyCode) || !limit(keyCode, 0, 255)) return undefined
    return {type: 'key', down, key, code, repeat: repeat === true, keyCode, modifiers}
  }
  if (value.type === 'pointer') {
    const { action, x, y, button, buttons } = value
    if (!['press', 'release', 'move', 'wheel'].includes(action) || !limit(x, 0, 1) || !limit(y, 0, 1) ||
        !Number.isInteger(buttons) || !limit(buttons, 0, 7) || !['none', 'left', 'middle', 'right'].includes(button)) return undefined
    const result = {type: 'pointer', action, x, y, button, buttons, modifiers}
    if (action === 'wheel') {
      if (!limit(value.dx, -4000, 4000) || !limit(value.dy, -4000, 4000)) return undefined
      result.dx = value.dx
      result.dy = value.dy
    } else if (action === 'press' || action === 'release') {
      result.clickCount = value.clickCount === 2 ? 2 : 1
    }
    return result
  }
}
