# DSH 内置浏览器增强

DeepSeek Harness 原来的「浏览器」Tab 运行独立 Chrome。浏览记录、扩展和登录状态保存在这套 Chrome 的资料里。

## 导入抖音的 Cookie

1. 解压 `dsh-tab-browser-douyin-export-0.4.0.zip`。在平时用的 Chrome 打开 `chrome://extensions`，启用「开发者模式」，用「加载已解压的扩展程序」选择 `chrome-extension` 文件夹。已装过 0.3.0 扩展时，移除旧扩展后加载新文件夹。
2. 在已登录的抖音页打开「DSH 抖音 Cookie 导出」，点「保存到本机」并按提示授权。
3. 在 DSH 原来的「浏览器」Tab 点「导入网站 Cookie」，选择下载的 JSON 文件，确认站点后点「导入并打开」。Chrome 若提示创建或解锁密钥环，先按提示完成。导入完成后删除该文件。

也可选择符合 `{"origin":"https://www.example.com","cookies":[...]}` 格式的单站点 JSON。Cookie 字段使用 Chrome 导出格式。密码、网页存储和设备绑定凭据不在文件里。网站可能要求重新验证。

## 使用独立 Chrome

在 DSH 打开「浏览器」Tab。Chrome 自己渲染地址栏、标签页、应用商店和 Google 密码管理器。首次启动出现 **Choose password for new keyring** 时，在上下两个输入框填入同一个自选密码。下次启动独立环境时用它解锁。Chrome 的快捷键按 Linux 习惯使用 `Ctrl`，例如 `Ctrl+L` 选中地址栏。

macOS 桌面版可在「浏览器」Tab 点「密钥环自动解锁」。输入独立 Chrome 的原有密钥环密码一次，点「保存并开启」。DSH 用本机 macOS 钥匙串保存它，下次启动时解锁原密钥环。可在同一入口关闭自动解锁。网站登录状态仍按各网站的有效期保存。

独立模式在 macOS 上需安装 Docker CLI 和 Colima，首次打开约需下载数百 MB。插件启动独立的 `dsh-chrome` Colima 配置，分配 2 核、4 GiB 内存，可用 `colima stop --profile dsh-chrome` 释放。重启后浏览器资料从各 DSH profile 的专用 Docker 卷恢复。一个 DSH profile 共享同一个独立 Chrome 窗口。停用插件后 DSH 恢复原浏览器的渲染器。

独立模式运行官方 Google Chrome 的 Linux 稳定版。下载文件和 `localhost` 位于该 Linux 环境，macOS 钥匙串、Touch ID、音频与剪贴板未接到独立环境。需要同步时在独立 Chrome 中自行登录。删除插件会关闭独立 Chrome 连接，浏览器资料卷留待下次使用。

## 构建与维护

```sh
npm ci
npm test
npm pack
zip -r -X dsh-tab-browser-douyin-export-0.4.0.zip chrome-extension
```

Chrome 容器从 Google 的签名仓库构建。更新 Chrome 后端时，可用同一专用 Docker context 重新拉取并构建，再从 DSH 重启 Chrome。保留 profile 卷可以保留扩展、书签和浏览器资料。

```sh
docker --context colima-dsh-chrome build --pull --no-cache -t dsh-tab-chrome:0.2.2 runtime
```

浏览器画面和输入走只监听本机回环地址的临时连接。Linux 里的 VNC 端口未发布到宿主，插件不访问 Chrome 资料文件。依赖和第三方许可见 `NOTICE`。
