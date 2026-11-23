# FocusNotes 发布说明

## 0.1.3（Windows / Android）

发布日期：2026-11-23

| 平台 | 版本号 | 说明 |
| --- | --- | --- |
| Windows | 0.1.3 | 安装包目录 `apps/desktop/release-011e` |
| Android | 0.1.3（versionCode 6） | 可从 0.1.2 覆盖安装 |
| 核心包 `@focusnotes/core` | 0.1.3 | 小组件输入偏好与位置状态 |

### 主要变更

#### 桌面小组件

- 显示模式切换改为原子操作：失败时回滚父级与置顶状态，并向主窗口回传具体错误。
- 固定到桌面后每 15 秒校验父级窗口，Explorer 重启后自动重新挂载；隐藏或关闭时停止检测。
- 显示模式与每显示器位置持久化到 `userData/widget-state.json`，启动时恢复。
- 多显示器位置记忆：按显示器保存位置，切换或重启后恢复，并自动夹紧到工作区。
- 新增「锁定位置」与「点击穿透」开关；点击穿透时窗口不抢焦点。
- 新增布局预设：保存、应用、删除“显示方式 + 材质 + 玻璃参数 + 字号 + 磁吸 + 动效”，最多 8 个。
- 固定到桌面时忽略磁吸位置，使用记住的自定义位置；窗口尺寸变化不再被磁吸覆盖。

#### 发布工具

- 新增 `npm run sign:apk`：严格 `zipalign`（16K 页对齐）→ `apksigner`（v1/v2/v3，v4 关闭），密码从环境变量、密码文件或 `local.properties` 读取，不打印密码。
- 新增 `npm run verify:release`：校验 APK `versionCode` / `versionName`、v1/v2/v3、证书 SHA-256、zipalign、APK/EXE SHA-256 与 EXE ProductVersion。

#### 其他

- 核心测试新增小组件锁定/穿透归一化用例，总计 51 项。
- 版本号统一为 0.1.3，Android `versionCode` 6。

### 修复内容

- 修复从桌面模式切回浮动/普通模式失败时，窗口停在非置顶状态的问题。
- 修复 Explorer 重启后固定到桌面的组件不可见、需要手动切换模式的问题。
- 修复切换显示模式时窗口位置被磁吸覆盖的问题。
- 修复关闭或隐藏小部件后桌面监控定时器仍在运行的问题。
- 修复桌面状态未持久化、重启后显示模式丢失的问题。
- 修复壁纸读取失败时缺少回退提示的问题。

### 兼容性

- **数据格式**：`WidgetPreferences` 新增 `locked` / `clickThrough`，旧数据默认 `false`。
- **Windows**：Windows 10/11 x64；桌面模式依赖系统 PowerShell。
- **Android**：Android 7.0（API 24）及以上，`versionCode` 6，可从 0.1.2 覆盖；2.x 需卸载重装。
- **Android 签名**：APK 内嵌 v1 / v2 / v3 签名，证书 SHA-256 为 `7a851890d7d62edf66d08f7183846517cdcb98f6fc24fc23bfa87b2f2aa39c2b`；APK SHA-256 为 `2a7333871699d2058ffeaf8be112d9b26e046e0d869aa3f0535007682fbd6f21`。
- **验签附件**：`FocusNotes-0.1.3-cert.pem` 为公钥证书，`FocusNotes-0.1.3.apk.sha256` 为 APK 校验文件；私钥 keystore 不公开。

### 升级注意事项

1. 升级前导出 JSON 备份。
2. Android 0.1.2 → 0.1.3 使用相同证书且 `versionCode` 更高，可直接覆盖；2.x 需先卸载。
3. 桌面固定模式需要允许 PowerShell 运行；首次切换可能有短暂延迟。
4. 点击穿透开启后，小部件不再接收鼠标事件，需要从主窗口设置关闭。
5. 布局预保存在本机 `localStorage`，不随 Gitee 同步。
6. Windows 安装包未做代码签名。

### 已知限制

- Android 习惯提醒时间当前仅保存，不发送本地通知。
- 桌面固定模式依赖 Windows Explorer；Explorer 重启后最多 15 秒恢复。
- 桌面壁纸背景仅在 Windows 下可用。
- Gitee 同步为整文件提交，冲突时需要重新拉取后再提交。
- R8 代码混淆与资源压缩尚未启用。

### 验证记录

本次发布前已执行：

```powershell
npm run typecheck   # core / desktop / mobile 均通过
npm test            # 3 个测试文件，51 项用例通过
npm run dist -w @focusnotes/desktop  # 生成 Setup 0.1.3
gradlew assembleRelease  # APK 0.1.3，versionCode 6
npm run sign:apk     # 严格 zipalign + apksigner，v1/v2/v3 通过
npm run verify:release  # APK/EXE 校验通过
```

## 0.1.2（Windows / Android）

发布日期：2026-11-23

| 平台 | 版本号 | 说明 |
| --- | --- | --- |
| Windows | 0.1.2 | 安装包目录 `apps/desktop/release-011e` |
| Android | 0.1.2（versionCode 5） | 可从 0.1.1 覆盖安装 |
| 核心包 `@focusnotes/core` | 0.1.2 | 小组件偏好、保存队列、Gitee 合并 |

### 主要变更

#### Windows 桌面

- 小组件新增毛玻璃、液态玻璃与经典材质，支持读取当前 Windows 壁纸作为背景，并提供雾面透明度、模糊强度、字号与动效强度设置。
- 壁纸读取限制为 Windows、最大 32MB、最长边缩放至 1600px、30 秒缓存；读取失败时回退纯色。
- 任务列表新增逾期分组与任务图标，任务行与列表视觉更新。
- 设置面板改版：深浅模式、动效强度、小组件材质与玻璃参数、界面缩放等。
- 小组件窗口尺寸持久化，吸附与跟随前台应用窗口行为保留。
- 工作区保存失败时在顶部提示具体错误并支持「重试」；切换档案时阻止把待办写入错误档案。
- 开发模式使用独立 userData 与 AppID，避免与正式版数据冲突。

#### 同步与核心

- Gitee `push` 支持 `mergeRemote`：提交前合并远端数据，降低多设备覆盖冲突。
- 新增远端文件与本地档案的绑定校验，避免同一 Gitee 文件被多个档案覆盖。
- `TodoStore` 支持 `prepareWrite` 预捕获写入档案，异步写入队列不会因档案切换写错位置。
- `WidgetPreferences` 新增 `material`、`glassTransparency`、`glassBlur`；旧 `opacity` 自动映射为雾面透明度。
- 核心测试新增 2 项，总计 49 项。

#### Android

- 版本号更新为 0.1.2（`versionCode` 5）。
- 功能与 0.1.1 一致，重新构建并启用 v1 / v2 / v3 单文件签名。

### 修复内容

- 修复桌面保存失败被静默吞掉、用户无法感知的问题。
- 修复切换档案时异步写入可能落到新档案的问题。
- 修复 Gitee 提交直接覆盖远端、可能丢失其他设备修改的问题。
- 修复小组件数据重复计算与壁纸读取缺少大小、尺寸限制的问题。
- 修复旧版小组件透明度设置无法映射到新玻璃材质的问题。

### 兼容性

- **数据格式**：`WidgetPreferences` 新增字段，旧数据自动迁移；0.1.2 可读取 0.1.1 备份。
- **Windows**：Windows 10/11 x64；覆盖安装保留本地数据。
- **Android**：Android 7.0（API 24）及以上，`versionCode` 5，可从 0.1.1 / 0.1.0 覆盖；2.x 版本仍需卸载重装。
- **Android 签名**：APK 内嵌 v1 / v2 / v3 签名，证书 SHA-256 为 `7a851890d7d62edf66d08f7183846517cdcb98f6fc24fc23bfa87b2f2aa39c2b`；APK SHA-256 为 `355da3c0c5a870dea582aa730f9e4a074f130b2311260c2cddf1689173f36af8`。
- **验签附件**：`FocusNotes-0.1.2-cert.pem` 为公钥证书，`FocusNotes-0.1.2.apk.sha256` 为 APK 校验文件；私钥 keystore 不公开。

### 升级注意事项

1. 升级前导出 JSON 备份。
2. Android 0.1.1 / 0.1.0 → 0.1.2 使用相同证书且 `versionCode` 更高，可直接覆盖；2.x 需先卸载。
3. Windows 覆盖安装保留数据；壁纸背景首次加载可能有短暂延迟。
4. Gitee 同步建议先拉取再修改；自动提交会合并远端，但并发编辑仍可能冲突。
5. Windows 与 Android 均需授予通知权限；Windows 安装包未做代码签名。

### 已知限制

- Android 习惯提醒时间当前仅保存，不发送本地通知。
- 桌面壁纸背景仅在 Windows 下可用，其他平台回退纯色。
- Gitee 同步为整文件提交，冲突时需要重新拉取后再提交。
- R8 代码混淆与资源压缩尚未启用。

### 验证记录

本次发布前已执行：

```powershell
npm run typecheck   # core / desktop / mobile 均通过
npm test            # 3 个测试文件，49 项用例通过
npm run build       # core 与 desktop 构建通过
npm run dist -w @focusnotes/desktop  # 生成 Setup 0.1.2
gradlew assembleRelease  # APK 0.1.2，v1/v2/v3 签名
```

## 0.1.1（Windows / Android）

发布日期：2026-11-19

| 平台 | 版本号 | 说明 |
| --- | --- | --- |
| Windows | 0.1.1 | 安装包目录 `apps/desktop/release-011c` |
| Android | 0.1.1（versionCode 4） | 可从 0.1.0 覆盖安装 |
| 核心包 `@focusnotes/core` | 0.1.1 | 新增备忘录、同步载荷、Gitee 与小组件布局模块 |

### 主要变更

#### 备忘录

- 桌面与 Android 新增备忘录视图，支持置顶、搜索、长文本（单条 5 万字符，最多 500 条）。
- 备忘录写入 `WorkspaceExtras.memos`，旧数据自动兼容。
- 桌面导航与 Android 分页新增「备忘录」入口。

#### Gitee 云同步

- 新增 `createGiteeSync()`：基于 Gitee OpenAPI 的 pull / push / test，读写仓库中的 JSON 文件。
- 新增 `SyncPayload` 与 `mergeSyncPayload()`：同步待办与附属数据（清单、习惯打卡、专注记录、备忘录），偏好以远端为准。
- 桌面令牌通过 Electron `safeStorage` 加密后落盘，设置页新增 Gitee 配置面板。
- 启动时拉取并合并远端数据，本地修改后约 3 秒防抖提交。
- 移动端令牌保存在 AsyncStorage 应用私有存储中。

#### Android 小组件

- 新增 1x1、1x2、2x2、2x4 四种尺寸 Provider 与布局。
- 新增 `pickWidgetLayout()` 与 `widget_info_*` 配置，按占位格数选择布局。
- 统一刷新逻辑，按尺寸渲染今日计数、首条待办、方形列表或完整列表。

#### 其他

- 桌面新增 `app:version` 与 `ui:set-zoom` IPC，设置页显示版本并支持界面缩放。
- 默认隐藏「搜索」导航项，可在设置中重新开启。
- 新增 `memo-sync.test.ts`（12 项用例），核心包测试共 43 项。

### 修复内容

- Gitee base64 编码改为纯 JS UTF-8 实现，避免 React Native/Hermes 缺少 `TextEncoder`、`btoa`、`atob` 时运行时崩溃。
- Gitee contents 路径改为按路径段编码并用 `/` 连接，避免 `%2F` 被服务端误判为字面量。
- 签名默认 keystore 路径修正为 `focusnotes-release.jks`，避免解析到 `app/app/...`。
- Android APK 改为内嵌 v1 / v2 / v3 签名并禁用 v4，不再单独发布 `.idsig`；单 APK 即可完成签名校验与覆盖安装。签名证书与 0.1.0 一致（SHA-256 `7a85…`）。

### 兼容性

- **数据格式**：`extras` 新增 `memos` 字段，旧数据可正常读取；0.1.0 读取新备份时会忽略备忘录。
- **Android**：`versionCode` 为 4，可从 0.1.0 覆盖安装；从 2.x 版本升级仍需卸载重装。
- **Android 签名**：APK 内嵌 v1 / v2 / v3 签名，证书 SHA-256 为 `7a851890d7d62edf66d08f7183846517cdcb98f6fc24fc23bfa87b2f2aa39c2b`，与 0.1.0 相同；不再提供 `.idsig`。Release 附件提供公钥证书 `FocusNotes-0.1.1-cert.pem` 与校验文件 `FocusNotes-0.1.1.apk.sha256`（APK SHA-256 `4da05deb…`），私钥 keystore 不公开。
- **Gitee**：同步文件格式版本为 1，仅写入用户自己的仓库。
- **容量限制**：备忘录最多 500 条、单条 5 万字符；Gitee 以整文件提交，多设备并发可能冲突。

### 升级注意事项

1. 升级前导出 JSON 备份。
2. Android 0.1.0 → 0.1.1 使用相同证书且 `versionCode` 更高，可直接覆盖；若系统仍提示签名冲突，说明设备上的安装包不是同证书版本（如旧 2.x 或第三方重签包），需先卸载再安装。
3. Gitee 私人令牌需要仓库 contents 读写权限；桌面端加密保存，移动端保存在应用私有存储。
4. 多设备同步前先拉取最新数据，避免同时提交造成冲突。
5. Windows 覆盖安装保留本地数据。

### 已知限制

- Android 习惯提醒时间当前仅保存，不发送本地通知。
- Gitee 同步为整文件覆盖，冲突时需要重新拉取后再提交。
- Windows 安装包未做代码签名。
- R8 代码混淆与资源压缩尚未启用。

### 验证记录

本次发布前已执行：

```powershell
npm run typecheck   # core / desktop / mobile 均通过
npm test            # 3 个测试文件，43 项用例通过
npm run build       # core 与 desktop 构建通过
npm run dist -w @focusnotes/desktop  # 生成 Setup 0.1.1
gradlew assembleRelease  # APK 0.1.1，v1/v2/v3 内嵌签名，无 .idsig
```

## 0.1.0（Windows / Android）

发布日期：2026-11-19

| 平台 | 版本号 | 说明 |
| --- | --- | --- |
| Windows | 0.1.0 | 安装包目录 `apps/desktop/release-010` |
| Android | 0.1.0（versionCode 1） | `versionCode` 重置为 1 |
| 核心包 `@focusnotes/core` | 0.1.0 | 版本号与项目统一 |

### 版本号重置说明

- 此前版本使用 2.x 版本号，迭代节奏过快。自本版本起统一为 **0.1.0**，作为重新规划后的首个版本。
- 旧版本号不再使用，此前的 Release 将清理，仅保留 0.1.0。
- 功能上 0.1.0 包含此前 2.6.0 / 2.9.0 的全部能力，没有功能删减。

### 主要功能

- **待办与清单**：按清单整理任务，用重要/紧急象限安排优先级，并为任务设置截止时间。
- **日历与提醒**：按日期查看待办；任务到期提醒；Android 支持单任务提前提醒并添加到系统日历；桌面支持习惯每日提醒。
- **习惯追踪**：按每天/工作日/周末排期，记录打卡与连续天数，支持目标次数与提醒时间。
- **专注计时**：番茄倒计时或正计时，关联任务并记录专注会话；桌面展示「今日完成」聚合。
- **环境音**：程序合成环境音，桌面 12 种场景、最多 4 种混音与睡眠定时；Android 支持最多 4 种混音与睡眠定时。
- **桌面小组件**：Windows 悬浮小组件与 Android 主屏幕小组件，支持深色外观和今日完成汇总。
- **本地数据与备份**：两端支持 JSON 导入/导出与合并，桌面另支持 CSV；Android 支持系统文件选择器访问云盘 JSON。
- **外观与导航**：浅色/深色/跟随系统；Android 滑块调整字号与留白，支持左右滑动分页。

### 本版本包含的修复

- 白噪音混音后停止或切换场景时，统一清理 `interval` 与递归 `timeout`，避免继续操作已关闭的 `AudioContext`。
- 睡眠定时进入淡出阶段后，关闭定时或重新设定时恢复主音量，避免环境音保持静音。
- 混音时按场景数量均摊子增益，降低叠加爆音风险。
- 修复设置页打开期间被 PagerView 分页事件切走的问题。
- 修复「记录档案」锚定弹窗缺少定位与遮罩样式的问题。
- 提醒分钟数统一钳制为 0–10080 整数；移动端读取旧设置时增加数值校验。
- Android 签名凭据从入库的 `gradle.properties` 移出，改为读取 `local.properties`。
- Android APK 显式启用 APK Signature Scheme v2 / v3 / v4，并生成 v4 的 `.idsig` 附属文件；发布包已重新签名构建。

### 兼容性

- **数据格式**：本地数据与 JSON 备份结构未变，旧版数据可直接导入。
- **Windows**：Windows 10/11 x64；覆盖安装保留本地数据。
- **Android**：Android 7.0（API 24）及以上，编译/目标 SDK 35。
- **Android 签名**：发布 APK 使用 v2 / v3 / v4 签名方案，证书 RSA-2048、有效期至 2054 年；v4 增量安装需要随包提供 `.idsig`。
- **环境音偏好**：音量与睡眠定时会持久化；当前混音场景集合不持久化，启动后需重新选择。
- **混音上限**：最多 4 种，选择第 5 种时会自动移除最早选择的场景。

### 升级注意事项

1. **先备份**：升级前在「设置 → 导出完整备份」保存 JSON 文件。
2. **Android 必须卸载重装**：0.1.0 的 `versionCode` 为 1，低于此前 2.x 版本的 9，Android 会拒绝覆盖安装。请先导出备份，卸载旧版，再安装 0.1.0 并导入备份。
3. **Windows 覆盖安装**：可直接覆盖安装并保留数据；如遇异常，先导出备份。
4. **签名要求**：Android 安装包仍需使用与发布流程一致的签名；重装后首次启动需重新授予通知与自启动权限。
5. **通知权限**：Windows 与 Android 均需允许通知；桌面习惯提醒依赖系统通知。
6. **Windows 安装包未做代码签名**：SmartScreen 可能提示「未知发布者」。

### 已知限制

- Android 版的习惯提醒时间目前仅保存，不参与本地通知；桌面版已支持习惯每日提醒。
- Android 自定义提醒输入超过 10080 分钟时，状态值会被钳制，但输入框仍显示原始文本。
- 桌面端深色模式的日出日落功能仍依赖内置的 OpenWeatherMap Key。

### 验证记录

本次发布前已执行：

```powershell
npm run typecheck   # core / desktop / mobile 均通过
npm test            # 2 个测试文件，31 项用例通过
npm run build       # core 与 desktop 构建通过
npm run dist -w @focusnotes/desktop  # 生成 Setup 0.1.0
```