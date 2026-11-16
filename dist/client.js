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
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
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
    failed: "Chrome \u542F\u52A8\u5931\u8D25\u3002"
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
    failed: "Chrome could not start."
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
function ChromeTab({ useTabInfo, t }) {
  const { tab } = useTabInfo();
  const { revision, params } = tab.navigation;
  const url = params?.url;
  const [viewer, setViewer] = (0, import_react.useState)(lastViewer);
  const [error, setError] = (0, import_react.useState)("");
  const [starting, setStarting] = (0, import_react.useState)(false);
  const frame = (0, import_react.useRef)(null);
  const request = (0, import_react.useRef)(null);
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
  (0, import_react.useEffect)(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);
  (0, import_react.useEffect)(() => {
    if (!local || !tab.visible) return;
    const previous = navigations.get(tab.signal);
    if (previous === revision && (lastViewer || request.current)) return;
    navigations.set(tab.signal, revision);
    if (typeof url === "string" && previous !== revision) void connect({ target: url });
    else if (lastViewer && previous !== void 0 && previous !== revision) void connect({ newPage: true });
    else if (!lastViewer) void connect();
  }, [local, tab.visible, tab.signal, revision, url]);
  (0, import_react.useEffect)(() => {
    if (!viewer) return;
    const reconnect = (event) => {
      if (event.source === frame.current?.contentWindow && event.origin === viewer.url.origin && event.data?.type === "dsh-chrome-reconnect") void connect({ reconnect: true });
    };
    window.addEventListener("message", reconnect);
    return () => window.removeEventListener("message", reconnect);
  }, [viewer]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { "data-dsh-tab-chrome": "", children: viewer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "iframe",
    {
      ref: frame,
      title: "Google Chrome",
      src: viewer.url.href,
      sandbox: "allow-scripts allow-same-origin",
      referrerPolicy: "no-referrer"
    },
    viewer.generation
  ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "chrome-start", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("title") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t(local ? "description" : "local") }),
    local && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => connect({ target: url }), disabled: starting, children: t(starting ? "waiting" : error ? "retry" : "start") }),
      error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", children: error }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "chrome-note", children: t("firstRun") })
    ] })
  ] }) });
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
  ctx.effect(() => ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT, key: ID, locale: namespace }, ChromeTab)), `${ID}: body`);
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
