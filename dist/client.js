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

// src/native-tab.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var tabKeys = /* @__PURE__ */ new WeakMap();
function request(key, action, data, keepalive = false) {
  return fetch(new URL("api/dsh-tab-browser/native", document.baseURI), {
    method: "POST",
    headers: { "X-DSH-Chrome": "1", "Content-Type": "application/json" },
    body: JSON.stringify({ key, action, ...data }),
    keepalive
  }).then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  });
}
function address(value) {
  const text = value.trim();
  if (!text) return void 0;
  if (/^[\w.-]+:\d+(?:[/?#]|$)/u.test(text)) return "http://" + text;
  return /^[a-z][a-z\d+.-]*:/iu.test(text) ? text : "https://" + text;
}
function NativeTab({ tab, t, CookieImport: CookieImport2, parseViewer: parseViewer2 }) {
  if (!tabKeys.has(tab.signal)) tabKeys.set(tab.signal, crypto.randomUUID());
  const key = tabKeys.get(tab.signal);
  const { revision, params } = tab.navigation;
  const url = params?.url;
  const popup = params?.chromePopup;
  const frame = (0, import_react.useRef)(null);
  const locationField = (0, import_react.useRef)(null);
  const seen = (0, import_react.useRef)(null);
  const actual = (0, import_react.useRef)("");
  const [viewer, setViewer] = (0, import_react.useState)(null);
  const [generation, setGeneration] = (0, import_react.useState)(0);
  const [mode, setMode] = (0, import_react.useState)("browser");
  const [title, setTitle] = (0, import_react.useState)("");
  const [locationText, setLocationText] = (0, import_react.useState)(url ?? "");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [offline, setOffline] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  function accept(result) {
    setMode(result.mode);
    setTitle(result.title || "");
    actual.current = result.url || "";
    if (document.activeElement !== locationField.current) setLocationText(actual.current);
  }
  async function run(action, data, reconnect = false) {
    setBusy(true);
    setError("");
    try {
      const result = await request(key, action, data);
      if (tab.signal.aborted) return;
      if (result.viewer) {
        const next = parseViewer2(result.viewer);
        setViewer((previous) => previous?.href === next.href ? previous : next);
        if (reconnect) setGeneration((value) => value + 1);
        accept(result);
      }
      setOffline(false);
      return result;
    } catch (err) {
      if (!tab.signal.aborted) setError(err.message || t("failed"));
    } finally {
      if (!tab.signal.aborted) setBusy(false);
    }
  }
  (0, import_react.useEffect)(() => {
    const close = () => {
      void request(key, "release", void 0, true).catch(() => {
      });
    };
    tab.signal.addEventListener("abort", close, { once: true });
    return () => tab.signal.removeEventListener("abort", close);
  }, [key, tab.signal]);
  (0, import_react.useEffect)(() => {
    if (!tab.visible || seen.current?.revision === revision && seen.current?.key === key) return;
    seen.current = { revision, key };
    void run("attach", { url, popup });
  }, [tab.visible, revision, key, url, popup]);
  (0, import_react.useEffect)(() => {
    if (!viewer) return;
    const receive = (event) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== viewer.origin || event.data?.type !== "dsh-native-chrome") return;
      const message = event.data.message;
      if (message.type === "status") accept(message);
      if (message.type === "offline") setOffline(true);
      if (message.type === "ready") setOffline(false);
      if (message.type === "popup") {
        tab.actions.openTab("browser", { params: { url: message.url, chromePopup: message.token }, revealIfOpened: false });
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [viewer, tab.actions]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-dsh-tab-chrome": "", className: "chrome-native", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "chrome-address", onSubmit: (event) => {
      event.preventDefault();
      const url2 = address(locationText);
      if (!url2) return;
      locationField.current?.blur();
      void run("navigate", { url: url2 });
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", title: t("back"), "aria-label": t("back"), disabled: busy || !viewer || mode !== "browser", onClick: () => run("back"), children: "\u2039" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", title: t("forward"), "aria-label": t("forward"), disabled: busy || !viewer || mode !== "browser", onClick: () => run("forward"), children: "\u203A" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", title: t("reload"), "aria-label": t("reload"), disabled: busy || !viewer || mode !== "browser", onClick: () => run("reload"), children: "\u21BB" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          ref: locationField,
          type: "text",
          "aria-label": t("address"),
          placeholder: t("address"),
          title: title || locationText,
          value: locationText,
          onChange: (event) => setLocationText(event.target.value),
          spellCheck: false,
          onKeyDown: (event) => {
            if (event.key === "Escape") setLocationText(actual.current);
          },
          disabled: busy || mode !== "browser"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", hidden: true, children: t("openPage") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: busy || mode === "starting", onClick: () => run(mode === "manage" ? "resume" : "manage"), children: t(mode === "manage" ? "resume" : "manage") })
    ] }),
    viewer && mode === "browser" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "chrome-native-tools", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CookieImport2, { t, applyImport: (bundle) => request(key, "import", { bundle }) }),
      actual.current && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: busy, onClick: () => run("openWindow"), children: t("openWindow") })
    ] }),
    (error || offline) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "chrome-alert", role: error ? "alert" : "status", children: [
      error || t("disconnected"),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: busy, onClick: () => run("attach", viewer ? void 0 : { url, popup }, true), children: t("retry") })
    ] }),
    viewer && tab.visible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "iframe",
      {
        ref: frame,
        title: title || "Google Chrome",
        src: viewer.href,
        sandbox: "allow-scripts allow-same-origin",
        referrerPolicy: "no-referrer"
      },
      generation
    ),
    !viewer && busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "chrome-alert", role: "status", children: t("waiting") })
  ] });
}

// src/cookie-import.js
var MAX_COOKIE_FILE = 96 * 1024;
var sameSites = /* @__PURE__ */ new Map([["lax", "Lax"], ["strict", "Strict"], ["no_restriction", "None"], ["none", "None"]]);
function prepareCookieImport(data, now = Date.now() / 1e3) {
  const invalid = () => new Error("\u8BF7\u9009\u62E9\u4E00\u4E2A\u6709\u6548\u7684\u5355\u7AD9\u70B9 Cookie JSON \u6587\u4EF6\u3002");
  if (typeof data?.origin !== "string" || !Array.isArray(data.cookies) || !data.cookies.length || data.cookies.length > 200) {
    throw invalid();
  }
  let target;
  try {
    target = new URL(data.origin);
  } catch {
    throw invalid();
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  if (target.protocol !== "https:" && !(local && target.protocol === "http:") || target.username || target.password || target.origin !== data.origin) throw invalid();
  const cookies = [];
  for (const entry of data.cookies) {
    if (entry?.partitionKey || typeof entry?.expirationDate === "number" && entry.expirationDate <= now) continue;
    const domain = typeof entry?.domain === "string" ? entry.domain.toLowerCase().replace(/^\./u, "") : "";
    const hostOnly = entry?.hostOnly ?? !entry?.domain?.startsWith?.(".");
    if (!domain || domain !== target.hostname && (hostOnly || !target.hostname.endsWith("." + domain)) || typeof entry.name !== "string" || !entry.name || typeof entry.value !== "string" || entry.name.length + entry.value.length > 4096 || /[\x00-\x1f\x7f;]/u.test(entry.name + entry.value) || typeof entry.path !== "string" || !entry.path.startsWith("/") || entry.path.length > 1024) throw invalid();
    const cookie = {
      name: entry.name,
      value: entry.value,
      url: target.origin,
      path: entry.path,
      secure: entry.secure === true,
      httpOnly: entry.httpOnly === true
    };
    if (!hostOnly) cookie.domain = "." + domain;
    const sameSite = sameSites.get(typeof entry.sameSite === "string" ? entry.sameSite.toLowerCase() : "");
    if (sameSite) cookie.sameSite = sameSite;
    if (Number.isFinite(entry.expirationDate) && entry.session !== true) cookie.expires = entry.expirationDate;
    cookies.push(cookie);
  }
  if (!cookies.length) throw new Error("\u6587\u4EF6\u4E2D\u6CA1\u6709\u53EF\u5BFC\u5165\u7684 Cookie\u3002");
  if (new TextEncoder().encode(JSON.stringify(cookies)).length > 128 * 1024) throw invalid();
  return { origin: target.origin, cookies };
}

// src/client.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var ID = "dsh-tab-browser";
var SLOT = "sidebar.right.pane.tab";
var lastViewer;
var navigations = /* @__PURE__ */ new WeakMap();
var messages = {
  zh: {
    back: "\u540E\u9000",
    forward: "\u524D\u8FDB",
    reload: "\u5237\u65B0",
    address: "\u8F93\u5165\u7F51\u5740",
    openPage: "\u6253\u5F00\u7F51\u9875",
    manage: "\u7BA1\u7406\u6269\u5C55",
    resume: "\u8FD4\u56DE\u6D4F\u89C8",
    openWindow: "\u5728 Chrome \u7A97\u53E3\u6253\u5F00",
    disconnected: "\u7F51\u9875\u8FDE\u63A5\u5DF2\u7ED3\u675F\u3002",
    browser: "\u6D4F\u89C8\u5668",
    title: "Google Chrome",
    description: "\u5728\u4FA7\u680F\u6D4F\u89C8\u7F51\u9875",
    start: "\u542F\u52A8 Chrome",
    retry: "\u91CD\u8BD5",
    waiting: "\u6B63\u5728\u542F\u52A8 Chrome\u2026",
    firstRun: "\u9996\u6B21\u542F\u52A8\u9700\u8981\u4E0B\u8F7D\u6D4F\u89C8\u5668\u3002Chrome \u4F7F\u7528\u72EC\u7ACB\u7684\u6D4F\u89C8\u5668\u8D44\u6599\u3002",
    local: "\u8BF7\u5728\u672C\u673A DSH \u684C\u9762\u7248\u6216\u672C\u673A Web \u754C\u9762\u6253\u5F00\u3002",
    failed: "Chrome \u542F\u52A8\u5931\u8D25\u3002",
    importCookies: "\u5BFC\u5165\u7F51\u7AD9 Cookie",
    importConfirm: "\u5BFC\u5165\u5E76\u6253\u5F00",
    cancel: "\u53D6\u6D88",
    importing: "\u6B63\u5728\u5BFC\u5165\u2026",
    invalidFile: "\u8BF7\u9009\u62E9\u6709\u6548\u7684\u5355\u7AD9\u70B9 Cookie JSON \u6587\u4EF6\u3002",
    importFailed: "Cookie \u5BFC\u5165\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
    imported: "Cookie \u5DF2\u5BFC\u5165\u3002\u8BF7\u5728\u7F51\u9875\u786E\u8BA4\u767B\u5F55\u72B6\u6001\u3002",
    manualOpen: "Cookie \u5DF2\u5BFC\u5165\u3002\u8BF7\u5728 Chrome \u6253\u5F00\u8BE5\u7F51\u7AD9\u3002",
    keyring: "\u5BC6\u94A5\u73AF\u81EA\u52A8\u89E3\u9501",
    keyringHelp: "\u8F93\u5165\u72EC\u7ACB Chrome \u539F\u6709\u7684\u5BC6\u94A5\u73AF\u5BC6\u7801\u3002\u5BC6\u7801\u4FDD\u5B58\u5230\u672C\u673A macOS \u94A5\u5319\u4E32\u3002",
    keyringPassword: "\u5BC6\u94A5\u73AF\u5BC6\u7801",
    keyringSave: "\u4FDD\u5B58\u5E76\u5F00\u542F",
    keyringForget: "\u5173\u95ED\u81EA\u52A8\u89E3\u9501",
    keyringSaved: "\u5DF2\u5F00\u542F\u3002\u4E0B\u6B21\u542F\u52A8\u4F1A\u81EA\u52A8\u89E3\u9501\u3002",
    keyringForgotten: "\u5DF2\u5173\u95ED\u81EA\u52A8\u89E3\u9501\u3002",
    invalidPassword: "\u5BC6\u7801\u672A\u901A\u8FC7\u6838\u5BF9\u3002\u8BF7\u786E\u8BA4\u5DF2\u521B\u5EFA\u5BC6\u94A5\u73AF\uFF0C\u5E76\u8F93\u5165\u539F\u6765\u8BBE\u7F6E\u7684\u5BC6\u7801\u3002",
    keyringFailed: "\u65E0\u6CD5\u66F4\u65B0\u81EA\u52A8\u89E3\u9501\u8BBE\u7F6E\uFF0C\u8BF7\u91CD\u8BD5\u3002",
    keyringWorking: "\u6B63\u5728\u5904\u7406\u2026"
  },
  en: {
    back: "Back",
    forward: "Forward",
    reload: "Reload",
    address: "Enter a URL",
    openPage: "Open page",
    manage: "Manage extensions",
    resume: "Return to browsing",
    openWindow: "Open in a Chrome window",
    disconnected: "The page disconnected.",
    browser: "Browser",
    title: "Google Chrome",
    description: "Browse the web in the sidebar",
    start: "Start Chrome",
    retry: "Try again",
    waiting: "Starting Chrome\u2026",
    firstRun: "The first launch downloads Chrome. This browser uses its own profile.",
    local: "Open this tab in the local DSH desktop app or a local DSH web session.",
    failed: "Chrome could not start.",
    importCookies: "Import site cookies",
    importConfirm: "Import and open",
    cancel: "Cancel",
    importing: "Importing\u2026",
    invalidFile: "Choose a valid single-site cookie JSON file.",
    importFailed: "Cookie import failed. Please try again.",
    imported: "Cookies imported. Check your sign-in status on the website.",
    manualOpen: "Cookies imported. Open the website in Chrome.",
    keyring: "Unlock keyring automatically",
    keyringHelp: "Enter the separate Chrome keyring password. It will be saved to your Mac Keychain.",
    keyringPassword: "Keyring password",
    keyringSave: "Save and enable",
    keyringForget: "Turn off automatic unlock",
    keyringSaved: "Enabled. Chrome will unlock the keyring on its next launch.",
    keyringForgotten: "Automatic unlock is off.",
    invalidPassword: "Could not verify the password. Set up a keyring first and enter its existing password.",
    keyringFailed: "Could not update automatic unlock. Please try again.",
    keyringWorking: "Working\u2026"
  }
};
function localClient() {
  return window.dshDesktop?.protocolVersion === 1 || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}
function nativeClient() {
  return window.dshDesktop?.protocolVersion === 1 && navigator.userAgent.includes("Macintosh");
}
function parseViewer(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || !/^\/[A-Za-z0-9_-]{43}\/$/u.test(url.pathname) || url.search || url.hash) throw new Error();
  return url;
}
function CookieImport({ t, applyImport }) {
  const picker = (0, import_react2.useRef)(null);
  const [selected, setSelected] = (0, import_react2.useState)(null);
  const [loading, setLoading] = (0, import_react2.useState)(false);
  const [status, setStatus] = (0, import_react2.useState)(null);
  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus(null);
    setSelected(null);
    try {
      if (file.size > MAX_COOKIE_FILE) throw new Error();
      const text = await file.text();
      const plan = prepareCookieImport(JSON.parse(text));
      setSelected({ text, origin: plan.origin });
    } catch {
      setStatus({ error: true, key: "invalidFile" });
    }
  }
  async function submit() {
    setLoading(true);
    setStatus(null);
    try {
      let result;
      if (applyImport) result = await applyImport(JSON.parse(selected.text));
      else {
        const response = await fetch(new URL("api/dsh-tab-browser/cookies", document.baseURI), {
          method: "POST",
          headers: { "X-DSH-Chrome": "1", "Content-Type": "application/json" },
          body: selected.text
        });
        if (!response.ok) throw new Error();
        result = await response.json();
      }
      setSelected(null);
      setStatus({ key: result.opened ? "imported" : "manualOpen" });
    } catch {
      setStatus({ error: true, key: "importFailed" });
    } finally {
      setLoading(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "chrome-import", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "file", "aria-label": t("importCookies"), accept: ".json,application/json", ref: picker, onChange: chooseFile, hidden: true }),
    selected ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: selected.origin }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", disabled: loading, onClick: submit, children: t(loading ? "importing" : "importConfirm") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", disabled: loading, onClick: () => {
        setSelected(null);
        setStatus(null);
      }, children: t("cancel") })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: () => picker.current?.click(), children: t("importCookies") }),
    status && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: status.error ? "alert" : "status", children: t(status.key) })
  ] });
}
function KeyringSettings({ t }) {
  const input = (0, import_react2.useRef)(null);
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [enabled, setEnabled] = (0, import_react2.useState)(false);
  const [working, setWorking] = (0, import_react2.useState)(false);
  const [message, setMessage] = (0, import_react2.useState)(null);
  const endpoint = new URL("api/dsh-tab-browser/keyring", document.baseURI);
  const headers = { "X-DSH-Chrome": "1" };
  async function toggle() {
    if (!open) {
      setMessage(null);
      try {
        const response = await fetch(endpoint, { headers });
        if (!response.ok) throw new Error();
        setEnabled((await response.json()).enabled);
      } catch {
        setMessage({ key: "keyringFailed", error: true });
        return;
      }
    }
    setOpen(!open);
  }
  async function change(method, body) {
    setWorking(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method, headers, body });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ key: result.error === "invalidPassword" ? "invalidPassword" : "keyringFailed", error: true });
        return;
      }
      setEnabled(result.enabled);
      setMessage({ key: result.enabled ? "keyringSaved" : "keyringForgotten" });
    } catch {
      setMessage({ key: "keyringFailed", error: true });
    } finally {
      setWorking(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "chrome-import", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", "aria-expanded": open, disabled: working, onClick: toggle, children: t("keyring") }),
    open && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { className: "chrome-keyring", onSubmit: (event) => {
      event.preventDefault();
      const password = input.current.value;
      input.current.value = "";
      void change("POST", password);
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("keyringHelp") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "password", ref: input, required: true, autoComplete: "off", "aria-label": t("keyringPassword"), maxLength: 1024 }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "submit", disabled: working, children: t(working ? "keyringWorking" : "keyringSave") }),
      enabled && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", disabled: working, onClick: () => change("DELETE"), children: t("keyringForget") })
    ] }),
    message && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: message.error ? "alert" : "status", children: t(message.key) })
  ] });
}
function ChromeTab({ tab, t }) {
  const { revision, params } = tab.navigation;
  const url = params?.url;
  const [viewer, setViewer] = (0, import_react2.useState)(lastViewer);
  const [error, setError] = (0, import_react2.useState)("");
  const [starting, setStarting] = (0, import_react2.useState)(false);
  const frame = (0, import_react2.useRef)(null);
  const request2 = (0, import_react2.useRef)(null);
  const local = localClient();
  async function connect({ target, newPage = false, reconnect = false } = {}) {
    request2.current?.abort();
    const controller = new AbortController();
    request2.current = controller;
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
      if (request2.current === controller) {
        request2.current = null;
        setStarting(false);
      }
    }
  }
  (0, import_react2.useEffect)(() => () => {
    request2.current?.abort();
    request2.current = null;
  }, []);
  (0, import_react2.useEffect)(() => {
    if (!local || !tab.visible) return;
    const previous = navigations.get(tab.signal);
    if (previous === revision && (lastViewer || request2.current)) return;
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { "data-dsh-tab-chrome": "", children: [
    viewer && local && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "chrome-tools", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CookieImport, { t }),
      window.dshDesktop?.protocolVersion === 1 && navigator.userAgent.includes("Macintosh") && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KeyringSettings, { t })
    ] }),
    viewer ? tab.visible && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    ] })
  ] });
}
function BrowserTab({ useTabInfo, t }) {
  const { tab } = useTabInfo();
  if (nativeClient()) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NativeTab, { tab, t, CookieImport, parseViewer });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChromeTab, { tab, t });
}
var css = `
[data-dsh-tab-chrome]{display:flex;flex-direction:column;flex:1;width:100%;height:100%;min-height:0;min-width:0;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
[data-dsh-tab-chrome] iframe{display:block;flex:1;width:100%;height:100%;min-width:0;min-height:0;border:0}
[data-dsh-tab-chrome] .chrome-start{margin:auto;display:grid;gap:10px;justify-items:start;padding:24px;max-width:360px;white-space:normal}
[data-dsh-tab-chrome] h2{font-size:25px;line-height:1.2;font-weight:600;margin:0 0 3px}
[data-dsh-tab-chrome] p{margin:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
[data-dsh-tab-chrome] .chrome-note{color:var(--dsw-alias-label-secondary);font-size:12px}
[data-dsh-tab-chrome] button{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;font:inherit;font-size:13px;padding:8px 14px;cursor:pointer}
[data-dsh-tab-chrome] button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
[data-dsh-tab-chrome] button:disabled{cursor:wait;opacity:.65}
[data-dsh-tab-chrome] .chrome-import{display:flex;flex:none;flex-wrap:wrap;align-items:center;gap:6px;padding:5px 8px}
[data-dsh-tab-chrome] .chrome-import button{font-size:12px;padding:3px 8px}
[data-dsh-tab-chrome] .chrome-import p{min-width:0;font-size:12px}
[data-dsh-tab-chrome] .chrome-tools,[data-dsh-tab-chrome] .chrome-keyring{display:flex;align-items:center;flex-wrap:wrap;gap:4px}
[data-dsh-tab-chrome] .chrome-keyring input{min-width:0;max-width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit;padding:3px 8px}
[data-dsh-tab-chrome] .chrome-address{display:flex;align-items:center;gap:4px;padding:6px 8px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l2)}
[data-dsh-tab-chrome] .chrome-address input{flex:1;min-width:0;height:29px;box-sizing:border-box;padding:0 8px;font:inherit;font-size:13px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit}
[data-dsh-tab-chrome] .chrome-address button,[data-dsh-tab-chrome] .chrome-alert button{padding:4px 7px;white-space:nowrap}
[data-dsh-tab-chrome] .chrome-address button[hidden]{display:none}
[data-dsh-tab-chrome] .chrome-native-tools{display:flex;align-items:center;flex:none;flex-wrap:wrap}
[data-dsh-tab-chrome] .chrome-native-tools>button{font-size:12px;padding:3px 8px;margin:0 8px}
[data-dsh-tab-chrome] .chrome-alert{display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:12px}
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
    multiple: nativeClient(),
    keepMounted: nativeClient(),
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
