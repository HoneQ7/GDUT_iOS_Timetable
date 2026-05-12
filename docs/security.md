# 安全说明

本文档说明 GDUT iOS Timetable 如何处理登录态，以及上传 GitHub 前需要注意的安全事项。

## 本项目如何处理登录态

- 不保存账号密码。
- 使用 JSESSIONID。
- JSESSIONID 保存在 Scriptable Keychain。
- 小组件不读取 Keychain。
- 小组件不联网。
- Widget 只读取本地缓存和状态文件。

## 什么是 JSESSIONID

JSESSIONID 是登录会话标识。通俗地说，它类似“你已经登录过”的临时凭据。

拥有有效 JSESSIONID 的程序，可能在一定时间内以登录状态访问课表接口。它不是账号密码，但仍然属于敏感信息。

## 不要公开的内容

不要上传或公开以下内容：

- JSESSIONID
- Cookie
- curl 命令
- HAR 文件
- Network 截图
- `gdut_schedule.json`
- `gdut_auth_status.json`
- `gdut_notification_status.json`
- `gdut_calendar_status.json`
- 个人课表截图
- 任何包含学号、姓名、课程安排的隐私文件

## GitHub 上传前检查

提交前建议执行：

```bash
git status
grep -R "JSESSIONID=" -n .
grep -R "Cookie:" -n .
```

如果只是看到代码中的模板字符串，例如：

```js
Cookie: `JSESSIONID=${sessionId}`
```

是正常的。

如果看到真实 JSESSIONID，不能提交。

## 如果误上传了 JSESSIONID 怎么办

1. 立即将仓库改为 Private。
2. 删除包含 JSESSIONID 的文件。
3. 重新登录教务系统，使旧 JSESSIONID 失效。
4. 清理 Git 历史。
5. 重新提交和 push。
6. 必要时重建仓库。

只删除当前文件不一定能消除风险，因为敏感内容可能仍然保留在 Git 历史中。

## 请求频率建议

- 不要高频请求教务系统接口。
- 推荐每日检查登录态。
- 推荐每周同步一次课表。
- 需要时手动运行一键更新。

本项目更适合个人低频维护课表，不适合批量抓取。

## 免责声明

- 本项目仅供个人学习和个人课表查看。
- 请遵守学校系统使用规范。
- 不要绕过验证码、统一认证或访问控制。
- 不要将项目用于批量抓取或他人信息获取。
