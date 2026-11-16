// src/local-chrome-viewer.js
var frame = document.querySelector("#frame");
var keyboard = document.querySelector("#keyboard");
var status = document.querySelector("#status");
var endpoint = new URL("input", location.href);
endpoint.protocol = "ws:";
var socket = new WebSocket(endpoint.href);
function send(message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
function report(state) {
  window.parent.postMessage({ type: "dsh-local-chrome", state }, "*");
}
function disconnected() {
  frame.hidden = true;
  frame.removeAttribute("src");
  status.hidden = false;
  status.textContent = "\u672C\u673A Chrome \u5171\u4EAB\u5DF2\u7ED3\u675F\u3002";
  report("ended");
}
socket.addEventListener("message", (event) => {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }
  if (message.type === "ready") {
    status.textContent = "\u6B63\u5728\u63A5\u6536\u672C\u673A Chrome \u7F51\u9875\u2026";
    report("ready");
  } else if (message.type === "frame") {
    frame.src = `data:image/jpeg;base64,${message.data}`;
    frame.hidden = false;
    status.hidden = true;
  } else if (message.type === "ended") disconnected();
});
socket.addEventListener("close", disconnected);
var mods = (event) => Number(event.altKey) | Number(event.ctrlKey) << 1 | Number(event.metaKey) << 2 | Number(event.shiftKey) << 3;
var buttons = ["left", "middle", "right"];
function pointer(action, event) {
  const box = frame.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const unit = (n) => Math.min(1, Math.max(0, n));
  const wheel = (n) => Math.min(4e3, Math.max(-4e3, n * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1)));
  send({
    type: "pointer",
    action,
    x: unit((event.clientX - box.left) / box.width),
    y: unit((event.clientY - box.top) / box.height),
    button: buttons[event.button] ?? "none",
    buttons: event.buttons & 7,
    modifiers: mods(event),
    clickCount: event.detail,
    ...action === "wheel" ? { dx: wheel(event.deltaX), dy: wheel(event.deltaY) } : {}
  });
}
frame.addEventListener("pointerdown", (event) => {
  if (event.button > 2) return;
  event.preventDefault();
  keyboard.focus({ preventScroll: true });
  frame.setPointerCapture(event.pointerId);
  pointer("press", event);
});
frame.addEventListener("pointerup", (event) => pointer("release", event));
frame.addEventListener("contextmenu", (event) => event.preventDefault());
frame.addEventListener("wheel", (event) => {
  event.preventDefault();
  pointer("wheel", event);
}, { passive: false });
var nextMove;
frame.addEventListener("pointermove", (event) => {
  if (!nextMove) requestAnimationFrame(() => {
    pointer("move", nextMove);
    nextMove = void 0;
  });
  nextMove = event;
});
function key(down, event) {
  if (event.isComposing || event.key === "Process" || event.key === "Dead") return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") return;
  event.preventDefault();
  send({ type: "key", down, key: event.key, code: event.code, repeat: event.repeat, keyCode: event.keyCode, modifiers: mods(event) });
}
keyboard.addEventListener("keydown", (event) => key(true, event));
keyboard.addEventListener("keyup", (event) => key(false, event));
keyboard.addEventListener("compositionend", (event) => {
  if (event.data) send({ type: "text", text: event.data.slice(0, 4096) });
  keyboard.value = "";
});
keyboard.addEventListener("paste", (event) => {
  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain");
  if (text) send({ type: "text", text: text.slice(0, 4096) });
});
