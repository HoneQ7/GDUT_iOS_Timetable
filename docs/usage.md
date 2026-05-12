# 使用教程

本文档说明如何在 iPhone 上安装、配置和日常使用 GDUT iOS Timetable。

## 准备工作

需要：

- iPhone
- Scriptable
- 快捷指令 App
- Apple 日历 App
- 电脑浏览器

## 复制脚本到 Scriptable

将 `scripts` 目录下的脚本逐个复制到 Scriptable，并保持脚本名一致：

```text
GDUT_SetCookie
GDUT_TestWeek
GDUT_CheckSession
GDUT_SyncTimetable
GDUT_TodayWidget
GDUT_WriteCalendar
GDUT_ScheduleNotifications
GDUT_RunSummary
```

Scriptable 中的脚本名称不需要带 `.js` 后缀。

## 获取 JSESSIONID

大致流程：

1. 在电脑浏览器登录广东工业大学教务系统。
2. 打开开发者工具 Network。
3. 进入个人课表页面。
4. 找到课表接口请求：

```text
xsgrkbcx!getKbRq.action?xnxqdm=...&zc=...
```

5. 查看请求 Cookie。
6. 复制 JSESSIONID 的值。

必须注意：

- 只复制 JSESSIONID 的值。
- 不要把 JSESSIONID 发给别人。
- 不要上传到 GitHub。
- 不要提交包含 JSESSIONID 的 Network 截图、curl 或 HAR 文件。

## 保存 JSESSIONID

在 iPhone Scriptable 中运行：

```text
GDUT_SetCookie
```

然后粘贴 JSESSIONID。脚本会将它保存到 Scriptable Keychain，不保存账号密码。

## 测试单周接口

运行：

```text
GDUT_TestWeek
```

用于确认接口和登录态可用。若测试失败，优先检查 JSESSIONID 是否过期或复制错误。

## 同步课表

运行：

```text
GDUT_SyncTimetable
```

成功后会生成：

```text
gdut_schedule.json
```

该文件是本地课表缓存，不应该上传到 GitHub。

## 添加小组件

1. 长按 iPhone 桌面。
2. 添加小组件。
3. 选择 Scriptable。
4. 选择尺寸 small / medium / large。
5. 编辑小组件。
6. Script 选择 `GDUT_TodayWidget`。

large / max size 可以看到更完整的今日课程列表和状态颜色。

## 写入 Apple 日历

1. 打开 Apple 日历 App。
2. 新建日历，名称必须为“GDUT课表”。
3. 运行 `GDUT_WriteCalendar`。
4. 检查课程是否写入。
5. 第二次运行不应重复写入。

脚本会使用 `GDUT_EVENT_ID` 去重，不会删除用户其他日历事件。

## 安排通知

运行：

```text
GDUT_ScheduleNotifications
```

它会安排：

- 课前提醒
- 上课开始通知
- 下课结束通知

通知点击后会打开 `GDUT_RunSummary`。

## 配置一键更新快捷指令

快捷指令名称：

```text
一键更新GDUT课表
```

动作顺序：

```text
Run GDUT_CheckSession
Run GDUT_SyncTimetable
Run GDUT_WriteCalendar
Run GDUT_ScheduleNotifications
Run GDUT_RunSummary
显示结果
```

所有 Parameter 留空。

## 配置更新登录态快捷指令

快捷指令名称：

```text
更新GDUT登录态
```

动作：

```text
Run GDUT_SetCookie
```

## 配置每日自动检查登录态

触发：

```text
每天 07:00 或 08:00
```

动作：

```text
Run GDUT_CheckSession
```

说明：不加显示结果。

## 配置每周自动同步课表

触发：

```text
每周一 07:05 或每周日 22:00
```

动作：

```text
Run GDUT_CheckSession
Run GDUT_SyncTimetable
Run GDUT_WriteCalendar
Run GDUT_ScheduleNotifications
```

说明：不加 `GDUT_RunSummary`，不加显示结果。

## 日常使用流程

- 平时看小组件即可。
- 课前和上下课靠通知提醒。
- 小组件提示登录已过期时，重新复制 JSESSIONID。
- 课表有变化时，运行“一键更新GDUT课表”。
- 新学期需要修改学期代码和周次范围。

## 常见错误处理

### Alerts are not supported in Siri

这是 Scriptable 在快捷指令/Siri 环境中的限制。快捷指令环境中不应使用 Alert，脚本应通过 `Script.setShortcutOutput()` 输出结果。

### JSESSIONID 过期

重新登录教务系统，复制新的 JSESSIONID，运行“更新GDUT登录态”，再运行“一键更新GDUT课表”。

### 日历找不到“GDUT课表”

打开 Apple 日历 App，手动新建一个名称完全为“GDUT课表”的日历，然后重新运行 `GDUT_WriteCalendar`。

### 日历事件重复

正常情况下脚本使用 `GDUT_EVENT_ID` 去重，不应重复。若手动修改过事件备注、删除过事件标识或清理过状态文件，可能影响去重。

### 小组件不准时刷新

Scriptable 小组件刷新由 iOS 控制，`refreshAfterDate` 只是建议刷新时间，不保证准时。本项目通过课前提醒、上课开始通知、下课结束通知弥补准时性。

### GitHub push 失败

检查网络、GitHub token、远程仓库地址和分支状态。若远程仓库已有提交，可以先执行：

```bash
git pull --rebase
```

再重新 push。

### 代理导致 GitHub 连接失败

检查系统代理、Git 代理配置和终端环境变量。可以查看：

```bash
git config --global --get http.proxy
git config --global --get https.proxy
```

如果代理不可用，清理或修正代理配置后重试。
