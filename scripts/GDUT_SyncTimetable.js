// GDUT_SyncTimetable.js
// Scriptable for iOS

const semesterCode = "202502"
const startWeek = 11
const weeksToSync = 5
const remindMinutesBefore = 15

const CACHE_FILE_NAME = "gdut_schedule.json"
const AUTH_STATUS_FILE_NAME = "gdut_auth_status.json"

const sectionTimes = {
  1: ["08:30", "09:15"],
  2: ["09:20", "10:05"],
  3: ["10:25", "11:10"],
  4: ["11:15", "12:00"],
  5: ["13:50", "14:35"],
  6: ["14:40", "15:25"],
  7: ["15:30", "16:15"],
  8: ["16:30", "17:15"],
  9: ["17:20", "18:05"],
  10: ["18:30", "19:15"],
  11: ["19:20", "20:05"],
  12: ["20:10", "20:55"]
}

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

function normalizeWeekday(value) {
  const text = String(value == null ? "" : value).trim()
  if (!text) return ""

  const numberMatch = text.match(/\d+/)
  if (numberMatch) {
    const number = Number(numberMatch[0])
    if (number >= 1 && number <= 7) return String(number)
    if (number === 0) return "7"
  }

  const weekdayMap = {
    "一": "1",
    "二": "2",
    "三": "3",
    "四": "4",
    "五": "5",
    "六": "6",
    "日": "7",
    "天": "7"
  }

  for (const key of Object.keys(weekdayMap)) {
    if (text.includes(key)) return weekdayMap[key]
  }

  return ""
}

function buildWeekdayDateMap(dateRows) {
  const map = {}
  if (!Array.isArray(dateRows)) return map

  for (let index = 0; index < dateRows.length; index++) {
    const row = dateRows[index]
    const date = typeof row === "string" ? row : pick(row, ["rq", "date"])
    let weekday = typeof row === "string" ? String(index + 1) : normalizeWeekday(pick(row, ["xq", "xqmc", "weekday"]))

    if (!weekday && index >= 0 && index < 7) {
      weekday = String(index + 1)
    }

    if (weekday && date) {
      map[weekday] = date
    }
  }

  return map
}

function parseSections(jcdm2) {
  const matches = String(jcdm2 || "").match(/\d+/g) || []
  return matches
    .map(item => Number(item))
    .filter(number => Number.isFinite(number) && number > 0)
    .sort((a, b) => a - b)
}

function localDateTime(date, time) {
  return `${date}T${time}:00`
}

function makeOccurrence(course, week, weekdayDateMap) {
  const weekday = normalizeWeekday(pick(course, ["xq", "weekday"]))
  const date = weekdayDateMap[weekday] || pick(course, ["rq", "date"])
  const sections = parseSections(pick(course, ["jcdm2", "jc", "jcdm"]))

  if (!weekday || !date || sections.length === 0) {
    return null
  }

  const startSection = Math.min(...sections)
  const endSection = Math.max(...sections)
  const startTimeRow = sectionTimes[startSection]
  const endTimeRow = sectionTimes[endSection]
  const startTime = startTimeRow ? startTimeRow[0] : ""
  const endTime = endTimeRow ? endTimeRow[1] : ""

  if (!startTime || !endTime) {
    return null
  }

  const courseName = pick(course, ["kcmc", "courseName", "name"])
  if (!courseName) {
    return null
  }

  const rawSourceId = pick(course, ["dgksdm", "rawSourceId"])
  const id = rawSourceId
    ? `${semesterCode}-${week}-${rawSourceId}`
    : `${semesterCode}-${week}-${weekday}-${startSection}-${endSection}-${courseName}`

  return {
    id,
    semesterCode,
    week: Number(week),
    weekday: Number(weekday),
    date,
    courseName,
    teacher: pick(course, ["teaxms", "jsxm", "jsxmstr", "teacher", "teacherName"]),
    classroom: pick(course, ["jxcdmc", "jxcd", "jsdd", "classroom", "room"]),
    startSection,
    endSection,
    startTime,
    endTime,
    startDateTime: localDateTime(date, startTime),
    endDateTime: localDateTime(date, endTime),
    teachingType: pick(course, ["jxhjmc", "teachingType"]),
    description: pick(course, ["sknrjj", "description"]),
    rawSourceId,
    courseCode: pick(course, ["kcdm", "courseCode"]),
    teachingClassId: pick(course, ["jxbdm", "teachingClassId"]),
    teachingClassName: pick(course, ["jxbmc", "teachingClassName"])
  }
}

function sortOccurrences(occurrences) {
  return occurrences.slice().sort((a, b) => {
    const left = `${a.date || ""} ${a.startTime || ""} ${String(a.startSection).padStart(2, "0")} ${a.courseName || ""}`
    const right = `${b.date || ""} ${b.startTime || ""} ${String(b.startSection).padStart(2, "0")} ${b.courseName || ""}`
    return left.localeCompare(right)
  })
}

function parseWeekData(data, week) {
  if (!Array.isArray(data)) {
    throw new Error("响应 JSON 顶层结构不是数组")
  }

  const courses = Array.isArray(data[0]) ? data[0] : []
  const dateRows = Array.isArray(data[1]) ? data[1] : []
  const weekdayDateMap = buildWeekdayDateMap(dateRows)
  const occurrences = []
  let skippedCount = 0

  for (const course of courses) {
    const occurrence = makeOccurrence(course, week, weekdayDateMap)
    if (occurrence) {
      occurrences.push(occurrence)
    } else {
      skippedCount += 1
    }
  }

  return {
    occurrences: sortOccurrences(occurrences),
    skippedCount
  }
}

function timetableUrl(week) {
  return `https://jxfw.gdut.edu.cn/xsgrkbcx!getKbRq.action?xnxqdm=${semesterCode}&zc=${week}`
}

function refererUrl(week) {
  return `https://jxfw.gdut.edu.cn/xsgrkbcx!xskbList.action?xnxqdm=${semesterCode}&zc=${week}`
}

async function fetchWeek(week, jsessionid) {
  const req = new Request(timetableUrl(week))
  req.method = "GET"
  req.headers = {
    "Cookie": `JSESSIONID=${jsessionid}`,
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": refererUrl(week)
  }

  const text = await req.loadString()
  const inspected = inspectTimetableResponse(text)

  if (inspected.status !== "json") {
    return inspected
  }

  let parsed
  try {
    const data = JSON.parse(inspected.text)
    parsed = parseWeekData(data, week)
  } catch (error) {
    return { status: "parseFailed" }
  }

  if (parsed.occurrences.length === 0) {
    return {
      status: "noCourseOccurrence",
      skippedCount: parsed.skippedCount
    }
  }

  return {
    status: "success",
    occurrences: parsed.occurrences,
    skippedCount: parsed.skippedCount
  }
}

function localDocumentPath(fileName) {
  const fm = FileManager.local()
  return fm.joinPath(fm.documentsDirectory(), fileName)
}

function cachePath() {
  return localDocumentPath(CACHE_FILE_NAME)
}

function authStatusPath() {
  return localDocumentPath(AUTH_STATUS_FILE_NAME)
}

function readOldCache(path) {
  const fm = FileManager.local()
  if (!fm.fileExists(path)) {
    return {
      exists: false,
      cache: null,
      weeks: {}
    }
  }

  try {
    const cache = JSON.parse(fm.readString(path))
    return {
      exists: true,
      cache,
      weeks: extractWeeks(cache)
    }
  } catch (error) {
    return {
      exists: true,
      cache: null,
      weeks: {}
    }
  }
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

function resolveAuthStatus(successWeeks, failedWeeks, sessionExpired, oldAuthStatus) {
  const now = new Date().toISOString()
  const preservedSuccessAt = oldAuthStatus.lastSuccessAt || null

  if (sessionExpired) {
    return {
      status: "expired",
      message: "登录已过期，请重新登录教务系统后复制新的 JSESSIONID，并运行 GDUT_SetCookie。",
      lastSuccessAt: preservedSuccessAt
    }
  }

  const hasPermissionDenied = failedWeeks.some(item => item.reason === "permissionDenied")
  const hasNetworkError = failedWeeks.some(item => item.reason === "requestFailed")
  const hasSuccess = successWeeks.length > 0

  if (hasNetworkError) {
    return {
      status: "networkError",
      message: hasSuccess ? "部分周次网络异常，已保留旧缓存" : "网络异常，正在使用旧缓存",
      lastSuccessAt: hasSuccess ? now : preservedSuccessAt
    }
  }

  if (hasPermissionDenied) {
    return {
      status: "permissionDenied",
      message: hasSuccess ? "部分周次无权限访问" : "周次无权限访问",
      lastSuccessAt: hasSuccess ? now : preservedSuccessAt
    }
  }

  if (hasSuccess) {
    return {
      status: "valid",
      message: "登录正常",
      lastSuccessAt: now
    }
  }

  return {
    status: "unknown",
    message: "同步未成功，已保留旧缓存",
    lastSuccessAt: preservedSuccessAt
  }
}

function extractWeeks(cache) {
  const weeks = {}
  if (!cache) return weeks

  if (cache.weeks && typeof cache.weeks === "object" && !Array.isArray(cache.weeks)) {
    for (const week of Object.keys(cache.weeks)) {
      if (Array.isArray(cache.weeks[week])) {
        weeks[String(week)] = cache.weeks[week]
      }
    }
    return weeks
  }

  const occurrences = Array.isArray(cache)
    ? cache
    : Array.isArray(cache.occurrences)
      ? cache.occurrences
      : []

  for (const occurrence of occurrences) {
    if (occurrence && occurrence.week != null) {
      const week = String(occurrence.week)
      if (!weeks[week]) weeks[week] = []
      weeks[week].push(occurrence)
    }
  }

  return weeks
}

function mergeWeeks(oldWeeks, newWeeks) {
  const merged = {}

  for (const week of Object.keys(oldWeeks || {})) {
    merged[week] = Array.isArray(oldWeeks[week]) ? oldWeeks[week] : []
  }

  for (const week of Object.keys(newWeeks || {})) {
    merged[week] = sortOccurrences(newWeeks[week])
  }

  return merged
}

function flattenWeeks(weeks) {
  const occurrences = []
  for (const week of Object.keys(weeks)) {
    if (Array.isArray(weeks[week])) {
      occurrences.push(...weeks[week])
    }
  }
  return sortOccurrences(occurrences)
}

function writeCache(path, mergedWeeks, successWeeks, failedWeeks, newOccurrenceCount) {
  const fm = FileManager.local()
  const occurrences = flattenWeeks(mergedWeeks)
  const cache = {
    version: 1,
    source: "GDUT",
    semesterCode,
    updatedAt: new Date().toISOString(),
    config: {
      startWeek,
      weeksToSync,
      remindMinutesBefore
    },
    lastSync: {
      successWeeks,
      failedWeeks,
      newOccurrenceCount
    },
    weeks: mergedWeeks,
    occurrences
  }

  fm.writeString(path, JSON.stringify(cache, null, 2))

  return {
    cache,
    occurrences
  }
}

function failureLabel(item) {
  return `${item.week}(${item.reason})`
}

function courseSummary(occurrence) {
  const classroom = occurrence.classroom ? ` ${occurrence.classroom}` : ""
  return `${occurrence.date} ${occurrence.startTime}-${occurrence.endTime} ${occurrence.courseName}${classroom}`
}

function formatList(values) {
  return values.length > 0 ? values.join(", ") : "无"
}

function formatFailedWeeks(failedWeeks) {
  return failedWeeks.length > 0 ? failedWeeks.map(failureLabel).join(", ") : "无"
}

async function showResult(options) {
  const {
    successWeeks,
    failedWeeks,
    newOccurrenceCount,
    cacheTotalCount,
    oldCacheKept,
    didWrite,
    path,
    sampleOccurrences,
    authStatus
  } = options

  const sampleText = sampleOccurrences.length > 0
    ? sampleOccurrences.slice(0, 3).map(courseSummary).join("\n")
    : "无"

  const message = [
    `当前登录状态：${authStatus.status}`,
    `状态提示：${authStatus.message}`,
    `lastCheckedAt：${authStatus.lastCheckedAt || "无"}`,
    `lastSuccessAt：${authStatus.lastSuccessAt || "无"}`,
    "",
    `成功周数：${successWeeks.length}`,
    `失败周数：${failedWeeks.length}`,
    `成功周次：${formatList(successWeeks)}`,
    `失败周次：${formatFailedWeeks(failedWeeks)}`,
    `本次解析课程数：${newOccurrenceCount}`,
    `总课程数：${cacheTotalCount}`,
    `是否保留了旧缓存：${oldCacheKept ? "是" : "否"}`,
    `是否写入缓存：${didWrite ? "是" : "否"}`,
    `缓存文件路径：${path}`,
    "",
    "前 3 节课程：",
    sampleText
  ].join("\n")

  await finishWithMessage("同步结果", message)
}

async function main() {
  const oldAuthStatus = readAuthStatus()
  const jsessionid = Keychain.contains("GDUT_JSESSIONID") ? Keychain.get("GDUT_JSESSIONID") : ""
  if (!jsessionid || jsessionid.trim() === "") {
    const authStatus = writeAuthStatus("expired", "未设置 JSESSIONID，请运行 GDUT_SetCookie", oldAuthStatus.lastSuccessAt)
    await finishWithMessage("同步结果", [
      `当前登录状态：${authStatus.status}`,
      `状态提示：${authStatus.message}`,
      `lastCheckedAt：${authStatus.lastCheckedAt || "无"}`,
      `lastSuccessAt：${authStatus.lastSuccessAt || "无"}`,
      "",
      "请先运行 GDUT_SetCookie。"
    ].join("\n"))
    return
  }

  const path = cachePath()
  const oldCacheInfo = readOldCache(path)
  const targetWeeks = Array.from({ length: weeksToSync }, (_, index) => startWeek + index)
  const successWeeks = []
  const failedWeeks = []
  const newWeeks = {}
  let newOccurrenceCount = 0
  let skippedCourseCount = 0
  let sessionExpired = false

  for (const week of targetWeeks) {
    try {
      const result = await fetchWeek(week, jsessionid)

      if (result.status === "sessionExpired") {
        sessionExpired = true
        failedWeeks.push({ week, reason: "sessionExpired" })
        break
      }

      if (result.status === "permissionDenied") {
        failedWeeks.push({ week, reason: "permissionDenied" })
        continue
      }

      if (result.status !== "success") {
        failedWeeks.push({ week, reason: result.status })
        skippedCourseCount += result.skippedCount || 0
        continue
      }

      successWeeks.push(week)
      newWeeks[String(week)] = result.occurrences
      newOccurrenceCount += result.occurrences.length
      skippedCourseCount += result.skippedCount || 0
    } catch (error) {
      failedWeeks.push({ week, reason: "requestFailed" })
    }
  }

  console.log(`成功周次：${formatList(successWeeks)}`)
  console.log(`失败周次：${formatFailedWeeks(failedWeeks)}`)
  console.log(`本次解析课程数：${newOccurrenceCount}`)
  console.log(`跳过课程数：${skippedCourseCount}`)

  const authDecision = resolveAuthStatus(successWeeks, failedWeeks, sessionExpired, oldAuthStatus)
  const authStatus = writeAuthStatus(authDecision.status, authDecision.message, authDecision.lastSuccessAt)

  if (sessionExpired) {
    const oldOccurrences = flattenWeeks(oldCacheInfo.weeks)
    await showResult({
      successWeeks,
      failedWeeks,
      newOccurrenceCount,
      cacheTotalCount: oldOccurrences.length,
      oldCacheKept: oldCacheInfo.exists,
      didWrite: false,
      path,
      sampleOccurrences: [],
      authStatus
    })
    return
  }

  const allFailed = successWeeks.length === 0
  const canWriteCache = !allFailed && newOccurrenceCount > 0
  const oldCacheKept = oldCacheInfo.exists && (failedWeeks.length > 0 || !canWriteCache)

  if (!canWriteCache) {
    const oldOccurrences = flattenWeeks(oldCacheInfo.weeks)
    await showResult({
      successWeeks,
      failedWeeks,
      newOccurrenceCount,
      cacheTotalCount: oldOccurrences.length,
      oldCacheKept: oldCacheInfo.exists,
      didWrite: false,
      path,
      sampleOccurrences: [],
      authStatus
    })
    return
  }

  const mergedWeeks = mergeWeeks(oldCacheInfo.weeks, newWeeks)
  const writeResult = writeCache(path, mergedWeeks, successWeeks, failedWeeks, newOccurrenceCount)
  const newOccurrences = sortOccurrences(flattenWeeks(newWeeks))

  await showResult({
    successWeeks,
    failedWeeks,
    newOccurrenceCount,
    cacheTotalCount: writeResult.occurrences.length,
    oldCacheKept,
    didWrite: true,
    path,
    sampleOccurrences: newOccurrences,
    authStatus
  })
}

await main()
Script.complete()
