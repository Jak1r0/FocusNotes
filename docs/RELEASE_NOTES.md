# FocusNotes 发布说明

## 2.6.0（Windows）/ 2.9.0（Android）

发布日期：2026-11-19

| 平台 | 版本号 | 说明 |
| --- | --- | --- |
| Windows | 2.6.0 | 安装包目录 `apps/desktop/release-260` |
| Android | 2.9.0（versionCode 9） | `versionName` 与 `versionCode` 已同步递增 |
| 核心包 `@focusnotes/core` | 1.0.0 | 新增分页事件判定导出 |

### 主要变更

#### 环境音（桌面）

- 白噪音支持多场景混音，最多同时播放 4 种；再次点击已启用场景即可关闭。
- 新增「风声」「夏夜」，桌面场景扩展到 12 种。
- 混音时按场景数量均摊子增益（`0.9 / 场景数`），降低叠加爆音风险。
- 专注页显示当前混音数量，场景按钮支持多选高亮。
- 新增 wind / night 合成配方与起伏、脉冲包络。

#### Windows 桌面

- 侧栏新增记录档案入口，可直接切换档案；顶部图标栏的档案提示改为引导到侧栏。
- 档案弹窗支持锚定式布局（`anchored`），与常规模态弹窗区分。
- 「左侧功能栏」设置移动到更合适的设置分组。
- 桌面版本号更新为 2.6.0，安装包输出目录改为 `release-260`。

#### Android

- 顶部标签改为动画滑块（Animated pill），滑动时只更新 `Animated.Value`，不再每帧触发 React 重渲染。
- 从设置页返回业务页时等待一帧布局完成后再调用 `setPage`，避免 PagerView 尺寸未恢复导致跳页失败。
- 修复设置页打开期间 PagerView 分页事件把 page 改回业务页的问题，新增 `resolvePageFromPager()`。
- Android 版本号更新为 2.9.0（versionCode 9）。

#### 核心与测试

- 新增 `resolvePageFromPager()`，在设置页打开时忽略分页事件。
- `features.test.ts` 新增 2 项回归测试，核心包测试共 31 项。

### 修复内容

- 修复白噪音混音后停止或切换场景时，waves/wind 的 interval 与脉冲递归 timeout 未被清理，继续操作已关闭 AudioContext 的问题；现在所有定时器统一登记并在停止、切换、卸载时清理。
- 修复睡眠定时进入淡出阶段后，关闭定时或重新设定时不恢复主音量、环境音保持静音的问题。
- 修复点击「停止」后场景仍显示为选中、再次点击行为不符合预期的问题。
- 修复混音叠加时可能出现的爆音（按场景数均摊增益）。
- 修复设置页被分页事件切走的回归问题。

### 兼容性

- **数据格式**：本地数据与 JSON 备份结构未变。
- **Windows**：支持 Windows 10/11 x64；覆盖安装保留数据。
- **Android**：最低 Android 7.0（API 24），编译/目标 SDK 35；versionCode 9。
- **版本跨度**：本次从 2.4.0 / 2.7.0 直接更新到 2.6.0 / 2.9.0，中间版本未单独发布。
- **环境音偏好**：音量与睡眠定时会持久化；当前混音场景集合不持久化，启动后需重新选择。
- **混音上限**：最多 4 种；选择第 5 种时会自动移除最早选择的场景。

### 升级注意事项

1. 升级前导出 JSON 备份。
2. Android 覆盖安装必须使用相同签名；更换签名需先备份再卸载重装。
3. Windows 与 Android 均需授予通知权限；桌面习惯提醒依赖系统通知。
4. Windows 安装包未做代码签名，SmartScreen 可能提示「未知发布者」。
5. Android Release 构建继续从 `apps/mobile/android/local.properties` 读取签名；`FN_RELEASE_STORE_FILE` 的相对路径以 `apps/mobile/android/app` 为基准，建议显式配置。
6. 环境音混音最多 4 种，且不会跨启动恢复。

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
npm run dist -w @focusnotes/desktop  # 生成 Setup 2.6.0
```

## 2.4.0（Windows）/ 2.7.0（Android）

发布日期：2026-11-19

| 平台 | 版本号 | 说明 |
| --- | --- | --- |
| Windows | 2.4.0 | 安装包目录 `apps/desktop/release-240b` |
| Android | 2.7.0（versionCode 7） | `versionName` 与 `versionCode` 已同步递增 |
| 核心包 `@focusnotes/core` | 1.0.0 | 仅新增导出，未改变既有数据结构 |

### 主要变更

#### 核心与共享逻辑

- 新增 `todayCompletion()`，统一聚合「今日完成」：当天完成且未删除的待办、当天已排期并打卡的习惯、当天专注会话。
- 新增 `sleepTimerRemaining()`，以纯函数计算睡眠定时剩余毫秒，非法输入与已到期统一返回 `<= 0`。
- 新增 `clampReminderMinutes()`，把提醒分钟数钳制为 0–10080 的整数，非法值返回 `null`。
- 新增 `packages/core/src/navigation.ts`，提供 `PAGE_KEYS`、`pageIndex()`、`pageKey()`，供移动端分页导航复用。
- 新增 `packages/core/tests/features.test.ts`，覆盖上述函数与分页边界；核心包测试共 29 项。
- 新增 `packages/core/vitest.config.ts`，在 Windows 下改为单线程顺序收集，避免 vitest 并发争用临时目录导致 `EPERM`。

#### Windows 桌面 2.4.0

- 专注页新增「今日完成」统计卡，展示待办 / 习惯 / 番茄三项明细。
- 桌面小组件与「概览」小组件新增今日完成汇总条。
- 环境音由 5 种扩展到 10 种：新增雷声、篝火、瀑布、鸟鸣、棕噪音。
- 环境音新增睡眠定时：15 / 30 / 45 / 60 / 90 分钟，最后 15 秒渐弱后自动停止；设置写入本地存储并跨会话保留。
- 白噪音引擎重构：统一音源挂载、显式记录可停止的 `AudioBufferSourceNode`，并用 `cancelled` 标志终止脉冲式音效的递归调度。
- 新增习惯每日提醒：按习惯的 `HH:MM` 提醒时间，每天每个习惯最多提醒一次；点击通知打开主窗口并跳转习惯页。
- 提醒负载新增 `habits` 字段，主进程最多接收 200 条习惯提醒。
- 小组件数据新增 `completion` 字段，与核心包 `TodayCompletion` 口径对齐。

#### Android 2.7.0

- 主界面改为 `PagerView` 左右滑动分页：待办、日历、习惯、专注四页；设置页作为独立覆盖层打开。
- 顶部标签固定在页面上方，滑动过半即切换高亮。
- 「字体大小」改为 80%–140% 滑块；「默认提前提醒」改为 0–120 分钟滑块；「界面高度」改为 80%–130% 滑块，并按区间映射为紧凑 / 标准 / 宽松。
- 待办编辑的「提前提醒」改为 0–240 分钟滑块，并支持 0–10080 分钟的自定义输入。
- 新增依赖 `@react-native-community/slider@4.5.1`、`react-native-pager-view@6.4.1`，并更新锁文件。
- 界面高度改为按 `layoutScale` 计算内边距与列表间距，替换原有三档固定样式。

### 修复内容

- 从入库的 `gradle.properties` 中移除明文测试签名密码，签名凭据改为只从 `local.properties` 读取，降低凭据泄露风险。
- Release 签名配置改用 `rootProject.ext.signingProps`，避免把签名信息写入版本控制。
- 移动端读取本地设置时统一做数值校验：提醒分钟数经 `clampReminderMinutes()` 钳制，避免 `NaN` 或越界值进入界面状态。
- 移动端读取旧的界面密度值时增加数值范围判断，非法值不再直接套用。
- 桌面端习惯提醒按「习惯 ID + 日期」去重，避免同一天重复通知。
- 桌面端今日完成统计与核心包统一口径，修复小组件此前只统计待办完成数的问题。
- 微信接入文档与实际实现对齐：未配置时调用抛出 `IntegrationRequiredError`，不再描述为已可切换状态。

### 兼容性

- **数据格式**：本地数据与 JSON 备份结构未变，2.4.0 / 2.7.0 可读取旧版数据，旧版也可读取新版备份（新增字段会被忽略）。
- **Windows**：支持 Windows 10/11 x64；覆盖安装会保留本地数据。
- **Android**：最低 Android 7.0（API 24），编译与目标 SDK 为 35。
- **签名**：Android 2.7.0 必须使用与已安装版本相同的签名才能覆盖升级。
- **Node.js**：开发环境需要 Node.js 18 及以上；React Native 0.75.4。
- **Gradle**：wrapper 已改为官方 `services.gradle.org` 的 Gradle 8.8，首次构建会重新下载。

### 升级注意事项

1. **先备份**：升级前在「设置 → 导出完整备份」保存 JSON 文件，尤其是需要卸载重装的 Android 设备。
2. **Android 签名**：`gradle.properties` 中原来的测试签名配置已删除。构建 Release 前必须在 `apps/mobile/android/local.properties` 中提供：
   ```properties
   FN_RELEASE_STORE_FILE=focusnotes-release.jks
   FN_RELEASE_STORE_PASSWORD=你的密码
   FN_RELEASE_KEY_ALIAS=focusnotes
   FN_RELEASE_KEY_PASSWORD=你的密码
   ```
   `FN_RELEASE_STORE_FILE` 的相对路径以 `apps/mobile/android/app` 为基准；也可以填写绝对路径。代码中默认值仍为 `app/focusnotes-release.jks`，在 app 模块内会被解析为 `app/app/...`，因此**建议始终显式配置该属性**。
3. **换签名需重装**：如果从旧的测试签名切换到正式签名，Android 会拒绝覆盖安装；请先导出备份，卸载后重新安装并导入。
4. **默认提醒上限变化**：Android 的设置项上限由 1440 分钟调整为 120 分钟，旧值 1440 会在读取时被钳制为 120。需要更长提前量时，请在单个待办中使用自定义分钟数（最多 10080 分钟）。
5. **界面密度偏好**：旧版的「紧凑 / 标准 / 宽松」不会自动换算为新的百分比，升级后统一回落到 100%，可在设置中重新调整。
6. **通知权限**：Windows 与 Android 均需授予通知权限；桌面端习惯提醒依赖系统通知。
7. **Windows 安装包未做代码签名**：SmartScreen 可能提示「未知发布者」，请核对下载来源。

### 已知限制

- Android 版的习惯提醒时间目前仅保存，不参与本地通知；桌面版已支持习惯每日提醒。
- Android 自定义提醒输入超过 10080 分钟时，状态值会被钳制，但输入框仍显示原始文本。
- 桌面端深色模式的日出日落功能仍依赖内置的 OpenWeatherMap Key。

### 验证记录

本次发布前已执行：

```powershell
npm run typecheck   # core / desktop / mobile 均通过
npm test            # 2 个测试文件，29 项用例通过
npm run build       # core 与 desktop 构建通过
```