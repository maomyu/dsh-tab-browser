# DSH 内置浏览器增强

在 macOS 版 DeepSeek Harness 打开原来的「浏览器」Tab 即可使用本机 Google Chrome。一个网页对应一个 DSH 右侧 Tab，网页用新标签打开的链接也会在右侧新建 Tab。只传输当前正在看的网页画面，切换 Tab 时页面继续留在 Chrome 中。

## macOS 桌面版

1. 在 Mac 的「应用程序」安装 Google Chrome。在 DSH 的「插件 → DSH Deck」更新「浏览器增强」，然后打开右侧「浏览器」。
2. 输入网址浏览。要安装扩展，点「管理扩展」，在打开的 Chrome 窗口使用 Chrome 网上应用店，或在扩展管理页加载解压后的扩展。装好后回到 DSH，点「返回浏览」。
3. 抖音在这套 Chrome 中首次登录后，登录资料随浏览器资料保存。遇到验证页时，可点「在 Chrome 窗口打开」，完成验证或登录后回 DSH 点「返回浏览」。只要抖音会话仍然有效，重启后即可继续使用。

扩展管理窗口与 DSH 浏览共用同一套独立 Chrome 资料。切换前会关闭正在运行的 Chrome，回到 DSH 时重新打开原来的网址。首版用 Chrome 窗口管理扩展及弹窗，网页标题显示在 DSH 地址栏的提示里。每个 DSH 配置各有独立资料，保存在 DSH 数据目录的 `browser-data` 中。

## 从旧版迁移抖音登录

0.5.0 的 macOS 桌面模式使用新的浏览器资料。可在 DSH 重新登录抖音，也可将自己平时用的 Chrome 里已登录的抖音 Cookie 导入 DSH。

1. 解压 `dsh-tab-browser-douyin-export-0.4.0.zip`。在平时用的 Chrome 打开 `chrome://extensions`，启用「开发者模式」，用「加载已解压的扩展程序」选择 `chrome-extension` 文件夹。
2. 在已登录的抖音页打开「DSH 抖音 Cookie 导出」，点「保存到本机」并按提示授权。
3. 在 DSH 的「浏览器」Tab 点「导入网站 Cookie」，选择 JSON，确认站点后点「导入并打开」。导入完成后删除 JSON。

支持 Chrome 导出格式的单站点 JSON（`{"origin":"https://www.example.com","cookies":[...]}`）。导入范围为所选站点的 Cookie。网站可能根据会话状态要求重新验证。

## 其他安装方式

本机 Web 客户端和非 macOS 桌面环境继续使用 0.4.3 的独立浏览器界面。旧环境及其资料仍可按 [0.4.3 的说明](https://github.com/maomyu/dsh-tab-browser/tree/v0.4.3) 使用。

## 构建

```sh
npm ci
npm test
npm pack
```

macOS 浏览器连接使用 Chrome 进程的本地管道。网页预览只在本机回环地址提供，每个 Tab 有自己的临时访问令牌。第三方依赖许可见 `NOTICE`。
