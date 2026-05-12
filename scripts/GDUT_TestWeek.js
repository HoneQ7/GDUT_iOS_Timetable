// GDUT_TestWeek.js
// Scriptable for iOS

const KEYCHAIN_KEY = "GDUT_JSESSIONID"
const WEEK = 11
const XNXQDM = "202502"
const TIMETABLE_URL = `https://jxfw.gdut.edu.cn/xsgrkbcx!getKbRq.action?xnxqdm=${XNXQDM}&zc=${WEEK}`
const REFERER_URL = `https://jxfw.gdut.edu.cn/xsgrkbcx!xskbList.action?xnxqdm=${XNXQDM}&zc=${WEEK}`
const LOGIN_URL = "https://jxfw.gdut.edu.cn/"

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

async function alertMessage(message, title = "") {
  const alert = new Alert()
  if (title) alert.title = title
  alert.message = message
  alert.addAction("确定")
  await alert.presentAlert()
}

async function alertSessionExpired() {
  const alert = new Alert()
  alert.title = "登录已过期"
  alert.message = "登录已过期，请重新登录教务系统后复制新的 JSESSIONID，并运行 GDUT_SetCookie。"
  alert.addAction("打开教务系统登录页")
  alert.addCancelAction("稍后处理")

  const action = await alert.presentAlert()
  if (action === 0) {
    Safari.open(LOGIN_URL)
  }
}

function containsAny(text, markers) {
  const lowerText = String(text || "").toLowerCase()
  return markers.some(marker => lowerText.includes(marker.toLowerCase()))
}

function inspectTimetableResponse(text) {
  const responseText = String(text || "")
  const trimmedText = responseText.trim()

  if (containsAny(responseText, SESSION_EXPIRED_MARKERS)) {
    return { status: "sessionExpired" }
  }

  if (containsAny(responseText, PERMISSION_DENIED_MARKERS)) {
    return { status: "permissionDenied" }
  }

  if (!trimmedText.startsWith("[[")) {
    return { status: "unexpected" }
  }

  return {
    status: "json",
    text: trimmedText
  }
}

function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return ""

  for (const key of keys) {
    if (obj[key] != null && String(obj[key]).trim() !== "") {
      return String(obj[key])
    }

    const actualKey = Object.keys(obj).find(name => name.toLowerCase() === key.toLowerCase())
    if (actualKey && obj[actualKey] != null && String(obj[actualKey]).trim() !== "") {
      return String(obj[actualKey])
    }
  }

  return ""
}

function formatDateRange(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return "无日期数据"

  const dateTexts = dates
    .map(item => {
      if (typeof item === "string") return item
      return pick(item, ["rq", "date", "xq", "xqmc", "rqmc", "title"])
    })
    .filter(Boolean)

  if (dateTexts.length === 0) return "无日期数据"
  if (dateTexts.length === 1) return dateTexts[0]
  return `${dateTexts[0]} 至 ${dateTexts[dateTexts.length - 1]}`
}

function formatPeriod(course) {
  const period = pick(course, ["jc", "jcdm", "jcdm2", "jcxx", "period", "time"])
  if (period) return period

  const start = pick(course, ["ksjc", "startSection"])
  const end = pick(course, ["jsjc", "endSection"])
  if (start && end) return `${start}-${end}`
  return start || end || "无"
}

async function main() {
  const jsessionid = Keychain.contains(KEYCHAIN_KEY) ? Keychain.get(KEYCHAIN_KEY) : ""

  if (!jsessionid || jsessionid.trim() === "") {
    await alertMessage("请先运行 GDUT_SetCookie。")
    return
  }

  try {
    const request = new Request(TIMETABLE_URL)
    request.method = "GET"
    request.headers = {
      "Cookie": `JSESSIONID=${jsessionid}`,
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Referer": REFERER_URL
    }

    const responseText = await request.loadString()
    const result = inspectTimetableResponse(responseText)

    if (result.status === "sessionExpired") {
      await alertSessionExpired()
      return
    }

    if (result.status === "permissionDenied") {
      await alertMessage("接口权限异常")
      return
    }

    if (result.status !== "json") {
      await alertMessage("响应不是预期 JSON，课表接口请求未成功。")
      return
    }

    const data = JSON.parse(result.text)
    if (!Array.isArray(data)) {
      await alertMessage("响应 JSON 顶层结构不是数组。")
      return
    }

    const courses = Array.isArray(data[0]) ? data[0] : []
    const dates = Array.isArray(data[1]) ? data[1] : []
    const firstCourse = courses[0] || null

    const courseName = pick(firstCourse, ["kcmc", "kcMc", "courseName", "kcm", "name"]) || "无"
    const teacher = pick(firstCourse, ["jsxm", "jsxmstr", "jsmc", "xm", "skjs", "teaxm", "teacher", "teacherName"]) || "无"
    const classroom = pick(firstCourse, ["jxcdmc", "jxcdmcs", "jxcd", "jsdd", "skdd", "cdmc", "classroom", "room"]) || "无"
    const period = formatPeriod(firstCourse)

    const message = [
      `第 ${WEEK} 周课程数量：${courses.length}`,
      `日期范围：${formatDateRange(dates)}`,
      "",
      "第一节课：",
      `课程名：${courseName}`,
      `教师：${teacher}`,
      `教室：${classroom}`,
      `节次：${period}`
    ].join("\n")

    await alertMessage(message, "课表接口测试")
  } catch (error) {
    await alertMessage(`请求或解析失败：${error.message || String(error)}`)
  }
}

await main()
Script.complete()
