# DSH 内置浏览器增强

DeepSeek Harness 会话右侧的「浏览器」打开 Google Chrome 的完整窗口。Chrome 自己渲染地址栏、标签页、扩展商店、扩展弹窗和 Google 密码管理器。

## 使用

1. 从 [GitHub Releases](https://github.com/maomyu/dsh-tab-browser/releases) 下载 `dsh-tab-browser-0.2.0.tgz`。在 DSH `0.2.2-rc.3` 里打开「插件 → 添加插件」，选择该安装包。
2. 打开一个会话，从右侧 Tab 导览进入原来的 **浏览器**。如果会话链接设置为在侧栏打开，DSH 会把网页交给 Chrome。网页在 Chrome 自身的标签页切换。
3. 在 Chrome 的地址栏打开 `chrome://extensions` 管理扩展，从 [Chrome 应用商店](https://chromewebstore.google.com/) 安装扩展。输入 `chrome://password-manager/passwords` 或用 Chrome 菜单进入 Google 密码管理器。
4. 首次启动出现 **Choose password for new keyring** 时，在上下两个输入框填入同一个自选密码。下次启动 Chrome 环境时用它解锁。Chrome 的快捷键按 Linux 习惯使用 `Ctrl`，例如 `Ctrl+L` 选中地址栏。

此版本面向 macOS 本机。需安装 Docker CLI、Colima，首次打开约需下载数百 MB。插件启动独立的 `dsh-chrome` Colima 配置，分配 2 核、4 GiB 内存，可用 `colima stop --profile dsh-chrome` 释放。重启后浏览器资料从各 DSH profile 的专用 Docker 卷恢复。一个 DSH profile 共享同一个 Chrome 窗口。停用插件后 DSH 恢复原浏览器的渲染器。

内嵌的是官方 Google Chrome 的 Linux 稳定版。下载文件和 `localhost` 位于该 Linux 环境，macOS 钥匙串、Touch ID、音频与剪贴板未接到 DSH。需要同步时在内嵌 Chrome 中自行登录。删除插件会关闭当前的 Chrome 连接，浏览器资料卷留待下次使用。

## 构建与维护

```sh
npm ci
npm test
npm pack
```

Chrome 容器从 Google 的签名仓库构建。更新 Chrome 后端时，可用同一专用 Docker context 重新拉取并构建，再从 DSH 重启 Chrome。保留 profile 卷可以保留扩展、书签和浏览器资料。

```sh
docker --context colima-dsh-chrome build --pull --no-cache -t dsh-tab-chrome:0.1.0 runtime
```

浏览器画面和输入走只监听本机回环地址的临时连接。Linux 里的 VNC 端口未发布到宿主，插件不访问 Chrome 资料文件。依赖和第三方许可见 `NOTICE`。
