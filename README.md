# GDUT iOS Timetable

## 项目简介

GDUT iOS Timetable 是一个基于 iOS Scriptable 的广东工业大学教务系统课表工具，用于在 iPhone 上离线查看课表、显示桌面小组件、写入 Apple 日历、安排本地通知，并通过快捷指令实现一键更新和自动化维护。

它可以实现：

- 本地离线查看课表
- 桌面小组件显示今日课程
- 登录态过期提醒
- 写入 Apple 日历
- 课前提醒、上课开始、下课结束通知
- 快捷指令一键更新
- 每日/每周自动化维护

## 功能特性

- 通过 JSESSIONID 访问教务系统课表接口
- 本地缓存课表
- 小组件显示今日课表
- 支持 small、medium、large / max size
- large / max size 支持课程状态颜色区分
- 支持 Apple 日历写入
- 支持本地通知
- 支持登录态检测
- 支持快捷指令一键更新
- 支持每日检查和每周同步自动化

## 项目结构

```text
GDUT_iOS_Timetable/
├── README.md
├── .gitignore
├── scripts/
│   ├── GDUT_SetCookie.js
│   ├── GDUT_TestWeek.js
│   ├── GDUT_CheckSession.js
│   ├── GDUT_SyncTimetable.js
│   ├── GDUT_TodayWidget.js
│   ├── GDUT_WriteCalendar.js
│   ├── GDUT_ScheduleNotifications.js
│   └── GDUT_RunSummary.js
└── docs/
    ├── usage.md
    └── security.md
```

## 脚本说明

| 文件 | 作用 | 是否联网 | 是否读取 JSESSIONID | 是否修改缓存 |
|---|---|---|---|---|
| `GDUT_SetCookie.js` | 保存 JSESSIONID | 否 | 否，由用户输入 | 写入 Scriptable Keychain |
| `GDUT_TestWeek.js` | 测试单周课表接口是否可用 | 是 | 是 | 否 |
| `GDUT_CheckSession.js` | 检查登录态 | 是 | 是 | 写入 `gdut_auth_status.json` |
| `GDUT_SyncTimetable.js` | 同步多周课表，生成本地缓存 | 是 | 是 | 写入 `gdut_schedule.json`，并可能更新登录态状态 |
| `GDUT_TodayWidget.js` | 桌面小组件，显示今日课表 | 否 | 否 | 否 |
| `GDUT_WriteCalendar.js` | 将课程写入 Apple 日历“GDUT课表” | 否 | 否 | 写入 `gdut_calendar_status.json` |
| `GDUT_ScheduleNotifications.js` | 安排课前、上课开始、下课结束通知 | 否 | 否 | 写入 `gdut_notification_status.json` |
| `GDUT_RunSummary.js` | 汇总显示一键更新后的关键信息 | 否 | 否 | 否 |

## 安装准备

需要：

- iPhone
- Scriptable
- 快捷指令 App
- Apple 日历 App
- 电脑浏览器，用于登录教务系统并复制 JSESSIONID
- 可选：Git / GitHub，用于备份和维护项目

## 快速开始

1. 将 `scripts` 目录中的 JS 文件复制到 Scriptable。
2. 登录教务系统。
3. 在浏览器 Network 中找到课表接口请求。
4. 复制 JSESSIONID。
5. 运行 `GDUT_SetCookie`。
6. 运行 `GDUT_SyncTimetable`。
7. 添加 Scriptable 小组件，选择 `GDUT_TodayWidget`。
8. 可选：运行 `GDUT_WriteCalendar`。
9. 可选：运行 `GDUT_ScheduleNotifications`。
10. 可选：配置快捷指令和自动化。

## 快捷指令配置

建议创建两个手动快捷指令。

### 一键更新GDUT课表

动作顺序：

```text
Run GDUT_CheckSession
Run GDUT_SyncTimetable
Run GDUT_WriteCalendar
Run GDUT_ScheduleNotifications
Run GDUT_RunSummary
显示结果
```

### 更新GDUT登录态

动作：

```text
Run GDUT_SetCookie
```

## 自动化配置

建议创建两个自动化。

### 每日检查GDUT登录态

触发：

```text
每天 07:00 或 08:00
```

动作：

```text
Run GDUT_CheckSession
```

### 每周自动同步GDUT课表

触发：

```text
每周一 07:05，或每周日 22:00
```

动作：

```text
Run GDUT_CheckSession
Run GDUT_SyncTimetable
Run GDUT_WriteCalendar
Run GDUT_ScheduleNotifications
```

自动化中不建议加入 `GDUT_RunSummary` 和“显示结果”，避免打断自动化。

## 常见问题 FAQ

### Q1：为什么小组件不能在上下课瞬间准时刷新？

Scriptable 小组件刷新由 iOS 控制，`refreshAfterDate` 只是建议刷新时间，不保证准时。项目通过课前提醒、上课开始通知、下课结束通知来弥补准时性。

### Q2：JSESSIONID 过期怎么办？

重新登录教务系统，复制新的 JSESSIONID，运行“更新GDUT登录态”，然后运行“一键更新GDUT课表”。

### Q3：为什么日历事件可能重复？

正常情况下使用 `GDUT_EVENT_ID` 去重，不应重复。如果手动改过事件备注或清理过状态，可能影响去重。

### Q4：为什么快捷指令不能弹窗？

Scriptable 在快捷指令/Siri 环境中不支持 Alert，所以脚本在快捷指令中使用 `Script.setShortcutOutput()` 输出结果。

### Q5：为什么 GitHub push 失败？

可能是网络、代理、认证 token、远程仓库已有提交等问题。建议检查代理、GitHub token、`git pull --rebase` 后再 push。

### Q6：可以公开仓库吗？

可以，但必须确保没有上传 JSESSIONID、Cookie、课表缓存、Network 截图、curl、HAR 等敏感内容。

## 安全说明

- 本项目不保存教务系统账号和密码。
- JSESSIONID 只应该保存在 Scriptable Keychain。
- 不要把 JSESSIONID 写入代码、README、截图或 GitHub。
- 不要上传课表缓存、认证状态、通知状态、curl、HAR、Cookie 文件。
- 如果误上传 JSESSIONID，应立即重新登录教务系统使旧 JSESSIONID 失效，并清理 Git 历史。

## 免责声明

- 本项目仅供个人学习和个人课表查看。
- 请遵守学校教务系统使用规范。
- 不要绕过验证码、统一认证或访问控制。
- 不要高频请求接口。
- 作者不对误用造成的后果负责。

## 文档链接

- [详细使用教程](docs/usage.md)
- [安全注意事项](docs/security.md)
