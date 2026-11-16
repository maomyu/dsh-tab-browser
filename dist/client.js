window.__ModuleLoader__.load({ id: 'dsh-tab-browser', factory(require) {
const module = { exports: {} };
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.jsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react2 = require("react");

// src/local-chrome.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function endpoint() {
  return new URL("api/dsh-tab-browser/local", document.baseURI);
}
function localRequest(body, signal) {
  return fetch(endpoint(), {
    method: "POST",
    headers: { "X-DSH-Chrome": "1", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
}
var handled = /* @__PURE__ */ new WeakMap();
function LocalChrome({ tab, t, parseViewer: parseViewer2 }) {
  const [room, setRoom] = (0, import_react.useState)(null);
  const [state, setState] = (0, import_react.useState)("waiting");
  const [error, setError] = (0, import_react.useState)("");
  const [copied, setCopied] = (0, import_react.useState)(false);
  const [loading, setLoading] = (0, import_react.useState)(false);
  const iframe = (0, import_react.useRef)(null);
  const input = (0, import_react.useRef)(null);
  const request = (0, import_react.useRef)(null);
  const { revision, params } = tab.navigation;
  const target = typeof params?.url === "string" ? params.url : void 0;
  async function load(action, url) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setCopied(false);
    setError("");
    try {
      const response = await localRequest({ action, url }, controller.signal);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("localFailed"));
      if (controller.signal.aborted) return;
      setRoom({ url: parseViewer2(result.url), code: typeof result.code === "string" ? result.code : "" });
      setState(result.linked ? "ready" : "waiting");
    } catch (error2) {
      if (!controller.signal.aborted) setError(error2.message || t("localFailed"));
    } finally {
      if (request.current === controller) setLoading(false);
    }
  }
  (0, import_react.useEffect)(() => {
    if (!tab.visible) return;
    const navigated = handled.get(tab.signal) !== revision;
    handled.set(tab.signal, revision);
    void load("open", navigated ? target : void 0);
    return () => request.current?.abort();
  }, [tab.visible, tab.signal, revision, target]);
  (0, import_react.useEffect)(() => {
    const stop2 = () => {
      void localRequest({ action: "stop" }).catch(() => {
      });
    };
    tab.signal.addEventListener("abort", stop2, { once: true });
    return () => tab.signal.removeEventListener("abort", stop2);
  }, [tab.signal]);
  (0, import_react.useEffect)(() => {
    if (!room) return;
    const onMessage = (event) => {
      if (event.source !== iframe.current?.contentWindow || event.origin !== room.url.origin || event.data?.type !== "dsh-local-chrome") return;
      if (event.data.state === "ready") setState("ready");
      if (event.data.state === "ended") setState("ended");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [room]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
    } catch {
      input.current?.select();
    }
  }
  async function stop() {
    try {
      const response = await localRequest({ action: "stop" });
      if (!response.ok) throw new Error();
      setState("ended");
    } catch {
      setError(t("localFailed"));
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-local-chrome", children: [
    state === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-local-tools", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("localConnected") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: stop, children: t("stopSharing") })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-local-setup", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("localMode") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t("localInstructions") }),
      state === "waiting" && room?.code && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-chrome-code", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { ref: input, readOnly: true, spellCheck: false, "aria-label": t("pairCode"), value: room.code }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: copy, children: t(copied ? "copiedCode" : "copyCode") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => load("renew"), disabled: loading, children: t(loading ? "pairing" : "renewCode") })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", className: "dsh-local-error", children: error }),
    tab.visible && room && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "iframe",
      {
        title: t("localMode"),
        src: room.url.href,
        ref: iframe,
        sandbox: "allow-scripts allow-same-origin",
        referrerPolicy: "no-referrer"
      }
    )
  ] });
}

// src/client.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var ID = "dsh-tab-browser";
var SLOT = "sidebar.right.pane.tab";
var lastViewer;
var navigations = /* @__PURE__ */ new WeakMap();
var messages = {
  zh: {
    browser: "\u6D4F\u89C8\u5668",
    title: "Google Chrome",
    description: "\u5728\u4FA7\u680F\u6D4F\u89C8\u7F51\u9875",
    start: "\u542F\u52A8 Chrome",
    retry: "\u91CD\u8BD5",
    waiting: "\u6B63\u5728\u542F\u52A8 Chrome\u2026",
    firstRun: "\u9996\u6B21\u542F\u52A8\u9700\u8981\u4E0B\u8F7D\u6D4F\u89C8\u5668\u3002Chrome \u4F7F\u7528\u72EC\u7ACB\u7684\u6D4F\u89C8\u5668\u8D44\u6599\u3002",
    local: "\u8BF7\u5728\u672C\u673A DSH \u684C\u9762\u7248\u6216\u672C\u673A Web \u754C\u9762\u6253\u5F00\u3002",
    failed: "Chrome \u542F\u52A8\u5931\u8D25\u3002",
    localMode: "\u672C\u673A Chrome",
    isolatedMode: "\u72EC\u7ACB Chrome",
    browserMode: "\u6D4F\u89C8\u5668\u6765\u6E90",
    localInstructions: "\u5728\u5E73\u65F6\u7528\u7684 Chrome \u91CC\u9009\u4E2D\u5DF2\u767B\u5F55\u7684\u7F51\u9875\uFF0C\u6253\u5F00\u300CDSH \u672C\u673A Chrome\u300D\u6269\u5C55\uFF0C\u7C98\u8D34\u8FDE\u63A5\u7801\u5E76\u70B9\u300C\u5171\u4EAB\u5F53\u524D\u7F51\u9875\u300D\u3002",
    localConnected: "\u6B63\u5728\u5171\u4EAB\u672C\u673A Chrome \u7F51\u9875",
    stopSharing: "\u7ED3\u675F\u5171\u4EAB",
    pairCode: "\u8FDE\u63A5\u7801",
    copyCode: "\u590D\u5236\u8FDE\u63A5\u7801",
    copiedCode: "\u5DF2\u590D\u5236",
    renewCode: "\u91CD\u65B0\u751F\u6210\u8FDE\u63A5\u7801",
    pairing: "\u6B63\u5728\u751F\u6210\u8FDE\u63A5\u7801\u2026",
    localFailed: "\u672C\u673A Chrome \u8FDE\u63A5\u5931\u8D25\u3002"
  },
  en: {
    browser: "Browser",
    title: "Google Chrome",
    description: "Browse the web in the sidebar",
    start: "Start Chrome",
    retry: "Try again",
    waiting: "Starting Chrome\u2026",
    firstRun: "The first launch downloads Chrome. This browser uses its own profile.",
    local: "Open this tab in the local DSH desktop app or a local DSH web session.",
    failed: "Chrome could not start.",
    localMode: "Local Chrome",
    isolatedMode: "Separate Chrome",
    browserMode: "Browser source",
    localInstructions: "Select a signed-in page in Chrome. Open the DSH Local Chrome extension, paste the code and share the current page.",
    localConnected: "Sharing a page from local Chrome",
    stopSharing: "Stop sharing",
    pairCode: "Connection code",
    copyCode: "Copy code",
    copiedCode: "Copied",
    renewCode: "Get a new code",
    pairing: "Generating a connection code\u2026",
    localFailed: "Local Chrome could not connect."
  }
};
function localClient() {
  return window.dshDesktop?.protocolVersion === 1 || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}
function parseViewer(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || !/^\/[A-Za-z0-9_-]{43}\/$/u.test(url.pathname) || url.search || url.hash) throw new Error();
  return url;
}
function ChromeTab({ tab, t }) {
  const { revision, params } = tab.navigation;
  const url = params?.url;
  const [viewer, setViewer] = (0, import_react2.useState)(lastViewer);
  const [error, setError] = (0, import_react2.useState)("");
  const [starting, setStarting] = (0, import_react2.useState)(false);
  const frame = (0, import_react2.useRef)(null);
  const request = (0, import_react2.useRef)(null);
  const local = localClient();
  async function connect({ target, newPage = false, reconnect = false } = {}) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (reconnect) setViewer(null);
    setStarting(true);
    setError("");
    try {
      const response = await fetch(new URL("api/dsh-tab-browser/connect", document.baseURI), {
        method: "POST",
        headers: { "X-DSH-Chrome": "1", "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, newPage }),
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : t("failed"));
      if (controller.signal.aborted) return;
      const next = parseViewer(result.url);
      if (reconnect || lastViewer?.url.href !== next.href) {
        lastViewer = { url: next, generation: (lastViewer?.generation ?? 0) + 1 };
      }
      setViewer(lastViewer);
    } catch (error2) {
      if (!controller.signal.aborted) {
        setViewer(null);
        lastViewer = void 0;
        setError(error2?.message || t("failed"));
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setStarting(false);
      }
    }
  }
  (0, import_react2.useEffect)(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);
  (0, import_react2.useEffect)(() => {
    if (!local || !tab.visible) return;
    const previous = navigations.get(tab.signal);
    if (previous === revision && (lastViewer || request.current)) return;
    navigations.set(tab.signal, revision);
    if (typeof url === "string" && previous !== revision) void connect({ target: url });
    else if (lastViewer && previous !== void 0 && previous !== revision) void connect({ newPage: true });
    else if (!lastViewer) void connect();
  }, [local, tab.visible, tab.signal, revision, url]);
  (0, import_react2.useEffect)(() => {
    if (!viewer) return;
    const reconnect = (event) => {
      if (event.source === frame.current?.contentWindow && event.origin === viewer.url.origin && event.data?.type === "dsh-chrome-reconnect") void connect({ reconnect: true });
    };
    window.addEventListener("message", reconnect);
    return () => window.removeEventListener("message", reconnect);
  }, [viewer]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { "data-dsh-tab-chrome": "", children: viewer ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "iframe",
    {
      ref: frame,
      title: "Google Chrome",
      src: viewer.url.href,
      sandbox: "allow-scripts allow-same-origin",
      referrerPolicy: "no-referrer"
    },
    viewer.generation
  ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "chrome-start", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("title") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t(local ? "description" : "local") }),
    local && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: () => connect({ target: url }), disabled: starting, children: t(starting ? "waiting" : error ? "retry" : "start") }),
      error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", children: error }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "chrome-note", children: t("firstRun") })
    ] })
  ] }) });
}
var modeKey = "dsh-tab-browser.mode";
function BrowserTab({ useTabInfo, t }) {
  const { tab } = useTabInfo();
  const [mode, setMode] = (0, import_react2.useState)(() => {
    try {
      return localStorage.getItem(modeKey) === "isolated" ? "isolated" : "local";
    } catch {
      return "local";
    }
  });
  function select(next) {
    setMode(next);
    try {
      localStorage.setItem(modeKey, next);
    } catch {
    }
  }
  if (!localClient()) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChromeTab, { tab, t });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { "data-dsh-chrome-mode": "", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-chrome-modes", role: "group", "aria-label": t("browserMode"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", "aria-pressed": mode === "local", onClick: () => select("local"), children: t("localMode") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", "aria-pressed": mode === "isolated", onClick: () => select("isolated"), children: t("isolatedMode") })
    ] }),
    mode === "local" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(LocalChrome, { tab, t, parseViewer }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChromeTab, { tab, t })
  ] });
}
var css = `
[data-dsh-tab-chrome]{display:flex;flex:1;width:100%;height:100%;min-height:0;min-width:0;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
[data-dsh-tab-chrome] iframe{display:block;flex:1;width:100%;height:100%;min-width:0;min-height:0;border:0}
[data-dsh-tab-chrome] .chrome-start{margin:auto;display:grid;gap:10px;justify-items:start;padding:24px;max-width:360px;white-space:normal}
[data-dsh-tab-chrome] h2{font-size:25px;line-height:1.2;font-weight:600;margin:0 0 3px}
[data-dsh-tab-chrome] p{margin:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
[data-dsh-tab-chrome] .chrome-note{color:var(--dsw-alias-label-secondary);font-size:12px}
[data-dsh-tab-chrome] button{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;font:inherit;font-size:13px;padding:8px 14px;cursor:pointer}
[data-dsh-tab-chrome] button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
[data-dsh-tab-chrome] button:disabled{cursor:wait;opacity:.65}
[data-dsh-chrome-mode],.dsh-local-chrome{display:flex;flex-direction:column;flex:1;width:100%;height:100%;min-height:0;min-width:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
[data-dsh-chrome-mode] button{cursor:pointer;padding:5px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:12px}
[data-dsh-chrome-mode] button[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);font-weight:600}
[data-dsh-chrome-mode] button:disabled{cursor:wait;opacity:.65}
.dsh-chrome-modes,.dsh-local-tools{display:flex;align-items:center;gap:6px;padding:6px 8px;flex:none;font-size:12px}
.dsh-local-tools{justify-content:space-between;padding-top:0;color:var(--dsw-alias-label-secondary)}
.dsh-local-setup{flex:none;padding:10px 14px 14px;white-space:normal;max-width:540px}
.dsh-local-setup h2{margin:0 0 8px;font-size:17px}
.dsh-local-setup p,.dsh-local-error{margin:0 0 10px;font-size:13px;line-height:1.5}
.dsh-local-error{padding:0 14px}
.dsh-chrome-code{display:flex;gap:6px;margin:0 0 8px}
.dsh-chrome-code input{flex:1;min-width:0;padding:5px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:inherit;font-size:12px}
.dsh-chrome-code button{flex:none}
.dsh-local-chrome iframe{display:block;flex:1;width:100%;min-width:0;min-height:0;border:0}
`;
var inject = ["sidebarRightTabs", "slots", "locale"];
function apply(ctx) {
  const namespace = "dshChromeTab";
  const t = ctx.locale.bind(namespace);
  ctx.effect(() => ctx.locale.register(namespace, messages), `${ID}: copy`);
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: ID,
    kind: "browser",
    priority: "extension",
    title: () => t("browser"),
    guide: [{ id: "new", commandId: "browser.new", order: 30, title: () => t("browser"), description: () => t("description") }]
  }), `${ID}: tab`);
  ctx.effect(() => ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT, key: ID, locale: namespace }, BrowserTab)), `${ID}: body`);
  ctx.effect(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    return () => {
      style.remove();
      lastViewer = void 0;
      navigations = /* @__PURE__ */ new WeakMap();
    };
  }, `${ID}: styles`);
}

return module.exports;
} });
