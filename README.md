# DSH 内置浏览器增强

DeepSeek Harness 原来的「浏览器」Tab 支持 **本机 Chrome** 和 **独立 Chrome**。本机模式把已打开的网页带进 DSH，继续使用该 Chrome 资料的登录状态。独立模式提供隔离的完整 Chrome 窗口。

## 使用本机 Chrome

1. 在 DSH `0.2.2-rc.3` 的「插件 → 添加插件」安装 `dsh-tab-browser-0.3.0.tgz`。
2. 解压 `dsh-tab-browser-chrome-extension-0.3.0.zip`。在平时用的 Chrome 打开 `chrome://extensions`，启用「开发者模式」，点「加载已解压的扩展程序」，选择解压后的 `chrome-extension` 文件夹。这个安装步骤只需一次。
3. 在 DSH 打开原来的「浏览器」Tab，选「本机 Chrome」，复制连接码。在平时用的 Chrome 选中已登录的抖音网页，打开「DSH 本机 Chrome」扩展，粘贴连接码，点「共享当前网页」。Chrome 会在共享期间显示调试提示。
4. 在 DSH 里点击、滚动或输入。点 DSH 或扩展里的「结束共享」结束会话。连接码一次有效，过期后在 DSH 点「重新生成连接码」。

网页继续在原 Chrome 标签页执行，网站的 Cookie 和账号资料留在原 Chrome。扩展把所选网页的画面和键鼠操作通过本机回环连接转发。Chrome 工具栏、扩展面板、浏览器级提示和弹出的新窗口在本机 Chrome 中操作。使用本机模式无需 Docker 或 Colima。

## 使用独立 Chrome

在「浏览器」Tab 选「独立 Chrome」。Chrome 自己渲染地址栏、标签页、应用商店和 Google 密码管理器。首次启动出现 **Choose password for new keyring** 时，在上下两个输入框填入同一个自选密码。下次启动独立环境时用它解锁。Chrome 的快捷键按 Linux 习惯使用 `Ctrl`，例如 `Ctrl+L` 选中地址栏。

独立模式在 macOS 上需安装 Docker CLI 和 Colima，首次打开约需下载数百 MB。插件启动独立的 `dsh-chrome` Colima 配置，分配 2 核、4 GiB 内存，可用 `colima stop --profile dsh-chrome` 释放。重启后浏览器资料从各 DSH profile 的专用 Docker 卷恢复。一个 DSH profile 共享同一个独立 Chrome 窗口。停用插件后 DSH 恢复原浏览器的渲染器。

独立模式运行官方 Google Chrome 的 Linux 稳定版。下载文件和 `localhost` 位于该 Linux 环境，macOS 钥匙串、Touch ID、音频与剪贴板未接到独立环境。需要同步时在独立 Chrome 中自行登录。删除插件会关闭独立 Chrome 连接，浏览器资料卷留待下次使用。

## 构建与维护

```sh
npm ci
npm test
npm pack
zip -r -X dsh-tab-browser-chrome-extension-0.3.0.zip chrome-extension
```

Chrome 容器从 Google 的签名仓库构建。更新 Chrome 后端时，可用同一专用 Docker context 重新拉取并构建，再从 DSH 重启 Chrome。保留 profile 卷可以保留扩展、书签和浏览器资料。

```sh
docker --context colima-dsh-chrome build --pull --no-cache -t dsh-tab-chrome:0.1.0 runtime
```

浏览器画面和输入走只监听本机回环地址的临时连接。Linux 里的 VNC 端口未发布到宿主，插件不访问 Chrome 资料文件。依赖和第三方许可见 `NOTICE`。
