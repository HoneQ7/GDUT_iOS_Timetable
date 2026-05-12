// GDUT_CheckSession.js
// Scriptable for iOS

const semesterCode = "202502"
const checkWeek = 11

const AUTH_STATUS_FILE_NAME = "gdut_auth_status.json"

const SESSION_EXPIRED_MARKERS = [
  "<!DOCTYPE html",
  "<html",
  "广东工业大学教学管理系统",
  "请输入学号或工号",
  "使用统一认证中心登录"
]

const PERMISSION_DENIED_MARKERS = [
  "非法访问",
  "你没有该权限"
]

async function finishWithMessage(title, message) {
  const output = `${title}\n\n${message}`

  if (config.runsWithSiri) {
    Script.setShortcutOutput(output)
    Script.complete()
    return
  }

  if (config.runsInApp) {
    const alert = new Alert()
    alert.title = title
    alert.message = message
    alert.addAction("OK")
    await alert.presentAlert()
    return
  }

  console.log(output)
  Script.setShortcutOutput(output)
  Script.complete()
}

function localDocumentPath(fileName) {
  const fm = FileManager.local()
  return fm.joinPath(fm.documentsDirectory(), fileName)
}

function authStatusPath() {
  return localDocumentPath(AUTH_STATUS_FILE_NAME)
}

function readAuthStatus() {
  const fm = FileManager.local()
  const path = authStatusPath()

  if (!fm.fileExists(path)) {
    return {
      status: "unknown",
      message: "尚未检查登录状态",
      lastCheckedAt: null,
      lastSuccessAt: null
    }
  }

  try {
    const status = JSON.parse(fm.readString(path))
    return {
      status: status.status || "unknown",
      message: status.message || "状态未知",
      lastCheckedAt: status.lastCheckedAt || null,
      lastSuccessAt: status.lastSuccessAt || null
    }
  } catch (error) {
    return {
      status: "unknown",
      message: "状态文件异常",
      lastCheckedAt: null,
      lastSuccessAt: null
    }
  }
}

function writeAuthStatus(status, message, lastSuccessAt) {
  const fm = FileManager.local()
  const payload = {
    status,
    message,
    lastCheckedAt: new Date().toISOString(),
    lastSuccessAt: lastSuccessAt || null
  }

  fm.writeString(authStatusPath(), JSON.stringify(payload, null, 2))
  return payload
}

function containsAny(text, markers) {
  const lowerText = String(text || "").toLowerCase()
  return markers.some(marker => lowerText.includes(marker.toLowerCase()))
}

function timetableUrl() {
  return `https://jxfw.gdut.edu.cn/xsgrkbcx!getKbRq.action?xnxqdm=${semesterCode}&zc=${checkWeek}`
}

function refererUrl() {
  return `https://jxfw.gdut.edu.cn/xsgrkbcx!xskbList.action?xnxqdm=${semesterCode}&zc=${checkWeek}`
}

function inspectResponse(text) {
  const responseText = String(text || "")
  const trimmedText = responseText.trim()

  if (containsAny(responseText, SESSION_EXPIRED_MARKERS)) {
    return { status: "expired", message: "登录已过期，请更新 JSESSIONID" }
  }

  if (containsAny(responseText, PERMISSION_DENIED_MARKERS)) {
    return { status: "permissionDenied", message: "检查周次无权限访问" }
  }

  if (trimmedText.startsWith("[[")) {
    return { status: "valid", message: "登录正常" }
  }

  try {
    const data = JSON.parse(trimmedText)
    if (Array.isArray(data)) {
      return { status: "valid", message: "登录正常" }
    }
  } catch (error) {
  }

  return { status: "unknown", message: "无法识别接口响应" }
}

async function checkSession(jsessionid) {
  const req = new Request(timetableUrl())
  req.method = "GET"
  req.headers = {
    "Cookie": `JSESSIONID=${jsessionid}`,
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": refererUrl()
  }

  const text = await req.loadString()
  return inspectResponse(text)
}

async function showResult(authStatus) {
  const message = [
    `当前状态：${authStatus.status}`,
    `状态提示：${authStatus.message}`,
    `检查时间：${authStatus.lastCheckedAt || "无"}`,
    `上次成功时间：${authStatus.lastSuccessAt || "无"}`
  ].join("\n")

  await finishWithMessage("登录状态检查", message)
}

async function main() {
  const oldStatus = readAuthStatus()
  const jsessionid = Keychain.contains("GDUT_JSESSIONID") ? Keychain.get("GDUT_JSESSIONID") : ""

  if (!jsessionid || jsessionid.trim() === "") {
    const authStatus = writeAuthStatus(
      "expired",
      "未设置 JSESSIONID，请运行 GDUT_SetCookie",
      oldStatus.lastSuccessAt
    )
    await showResult(authStatus)
    return
  }

  let result
  try {
    result = await checkSession(jsessionid)
  } catch (error) {
    result = {
      status: "networkError",
      message: "网络异常，无法检查登录态"
    }
  }

  const now = new Date().toISOString()
  const lastSuccessAt = result.status === "valid" ? now : oldStatus.lastSuccessAt
  const authStatus = writeAuthStatus(result.status, result.message, lastSuccessAt)
  await showResult(authStatus)
}

await main()
Script.complete()
