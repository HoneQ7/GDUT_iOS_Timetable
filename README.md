# GDUT iOS Timetable

基于 iOS Scriptable 的广东工业大学教务系统课表工具。

## 功能

- 保存 JSESSIONID 登录态
- 同步多周课表
- 本地缓存课表
- iOS 桌面小组件显示今日课程
- 登录态过期提醒
- Apple 日历写入
- 课前提醒、上课开始、下课结束本地通知
- 快捷指令一键更新

## 脚本说明

| 文件 | 作用 |
|---|---|
| `GDUT_SetCookie.js` | 手动保存 JSESSIONID |
| `GDUT_TestWeek.js` | 测试单周课表接口 |
| `GDUT_CheckSession.js` | 检查登录态 |
| `GDUT_SyncTimetable.js` | 同步课表并生成缓存 |
| `GDUT_TodayWidget.js` | iOS 桌面小组件 |
| `GDUT_WriteCalendar.js` | 写入 Apple 日历 |
| `GDUT_ScheduleNotifications.js` | 安排本地通知 |
| `GDUT_RunSummary.js` | 一键更新后的汇总显示 |

## 安全说明

本项目不会保存教务系统账号和密码。

JSESSIONID 只应保存在 Scriptable Keychain 中，不应写入代码、日志、README、截图或 GitHub 仓库。

不要上传：

- `gdut_schedule.json`
- `gdut_auth_status.json`
- `gdut_notification_status.json`
- `gdut_calendar_status.json`
- 任何包含 Cookie / JSESSIONID 的 curl、HAR、截图

## 使用方式

1. 在 iPhone 安装 Scriptable。
2. 将 `scripts/` 目录中的脚本复制到 Scriptable。
3. 运行 `GDUT_SetCookie` 保存 JSESSIONID。
4. 运行 `GDUT_SyncTimetable` 同步课表。
5. 添加 Scriptable 小组件，选择 `GDUT_TodayWidget`。
6. 运行 `GDUT_WriteCalendar` 写入 Apple 日历。
7. 运行 `GDUT_ScheduleNotifications` 安排通知。
8. 在快捷指令中配置一键更新和自动化。

## 免责声明

本项目仅用于个人学习和个人课表查看。请遵守学校系统使用规范，不要绕过验证码、统一认证或访问控制。