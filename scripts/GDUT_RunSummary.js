// GDUT_RunSummary.js
// Scriptable for iOS

const AUTH_STATUS_FILE_NAME = "gdut_auth_status.json"
const SCHEDULE_FILE_NAME = "gdut_schedule.json"
const NOTIFICATION_STATUS_FILE_NAME = "gdut_notification_status.json"
const CALENDAR_STATUS_FILE_NAME = "gdut_calendar_status.json"

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

function documentPath(fileName) {
  const fm = FileManager.local()
  return fm.joinPath(fm.documentsDirectory(), fileName)
}

function readJsonFile(fileName) {
  const fm = FileManager.local()
  const path = documentPath(fileName)

  if (!fm.fileExists(path)) {
    return {
      ok: false,
      reason: "missing",
      data: null
    }
  }

  try {
    return {
      ok: true,
      reason: "",
      data: JSON.parse(fm.readString(path))
    }
  } catch (error) {
    return {
      ok: false,
      reason: "parseFailed",
      data: null
    }
  }
}

function extractOccurrences(cache) {
  if (Array.isArray(cache)) return cache
  if (cache && Array.isArray(cache.occurrences)) return cache.occurrences

  const result = []
  if (cache && cache.weeks && typeof cache.weeks === "object") {
    for (const week of Object.keys(cache.weeks)) {
      if (Array.isArray(cache.weeks[week])) {
        result.push(...cache.weeks[week])
      }
    }
  }

  return result
}

function parseLocalDateTime(value) {
  const text = String(value || "").trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0)
    )
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function todayString() {
  const now = new Date()
  return formatDate(now)
}

function formatDate(date) {
  if (!date) return "无"
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatMonthDayTime(date) {
  if (!date) return "无"
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${month}-${day} ${hour}:${minute}`
}

function formatTime(date) {
  if (!date) return "--:--"
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${hour}:${minute}`
}

function safeText(value, fallback) {
  const text = String(value == null ? "" : value).trim()
  return text || fallback
}

function courseName(course) {
  return safeText(course && course.courseName, "未命名课程")
}

function classroomName(course) {
  return safeText(course && course.classroom, "未知教室")
}

function courseStartDate(course) {
  return parseLocalDateTime(course && course.startDateTime)
}

function courseEndDate(course) {
  return parseLocalDateTime(course && course.endDateTime)
}

function sortCourses(courses) {
  return courses.slice().sort((a, b) => {
    const aStart = courseStartDate(a)
    const bStart = courseStartDate(b)
    if (!aStart && !bStart) return 0
    if (!aStart) return 1
    if (!bStart) return -1
    return aStart.getTime() - bStart.getTime()
  })
}

function summarizeAuth(authResult) {
  if (!authResult.ok) return "登录态：暂无状态"

  const status = authResult.data.status || "unknown"
  const message = authResult.data.message || "状态未知"

  if (status === "valid") return "登录态：正常"
  if (status === "expired") return "登录态：已过期，请更新 JSESSIONID"
  if (status === "permissionDenied") return `登录态：权限异常，${message}`
  if (status === "networkError") return `登录态：网络异常，${message}`
  return `登录态：${message}`
}

function summarizeSchedule(scheduleResult) {
  if (!scheduleResult.ok) {
    return {
      cacheLine: "课表缓存：暂无状态",
      todayLine: "今日课程：暂无状态",
      nextLine: "下一节：暂无状态"
    }
  }

  const occurrences = extractOccurrences(scheduleResult.data)
  if (occurrences.length === 0) {
    return {
      cacheLine: "课表缓存：共 0 节",
      todayLine: "今日课程：今天没课",
      nextLine: "下一节：暂无课程"
    }
  }

  const validCourses = occurrences
    .map(course => ({
      course,
      startDate: courseStartDate(course),
      endDate: courseEndDate(course)
    }))
    .filter(item => item.startDate && item.endDate)

  const sorted = validCourses.slice().sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const firstDate = sorted.length > 0 ? sorted[0].startDate : null
  const lastDate = sorted.length > 0 ? sorted[sorted.length - 1].startDate : null
  const cacheLine = `课表缓存：共 ${occurrences.length} 节，${formatDate(firstDate)} ~ ${formatDate(lastDate)}`

  const today = todayString()
  const todayCourses = sortCourses(
    occurrences.filter(course => String(course.date || "") === today)
  )

  const todayLine = todayCourses.length > 0
    ? `今日课程：${todayCourses.length} 节`
    : "今日课程：今天没课"

  const now = new Date()
  const remaining = todayCourses
    .filter(course => {
      const endDate = courseEndDate(course)
      return endDate && endDate.getTime() > now.getTime()
    })
    .sort((a, b) => {
      const aStart = courseStartDate(a)
      const bStart = courseStartDate(b)
      if (!aStart && !bStart) return 0
      if (!aStart) return 1
      if (!bStart) return -1
      return aStart.getTime() - bStart.getTime()
    })

  let nextLine
  if (todayCourses.length === 0) {
    nextLine = "下一节：暂无课程"
  } else if (remaining.length === 0) {
    nextLine = "下一节：今日课程已结束"
  } else {
    const nextCourse = remaining[0]
    const startDate = courseStartDate(nextCourse)
    nextLine = `下一节：${formatTime(startDate)} ${courseName(nextCourse)} @${classroomName(nextCourse)}`
  }

  return {
    cacheLine,
    todayLine,
    nextLine
  }
}

function summarizeCalendar(calendarResult) {
  if (!calendarResult.ok) return "日历：未读取状态"

  const status = calendarResult.data
  const created = Number(status.createdCount || 0)
  const existed = Number(status.existedCount || 0)
  const failed = Number(status.failedCount || 0)
  return `日历：新增 ${created}，已存在 ${existed}，失败 ${failed}`
}

function summarizeNotifications(notificationResult) {
  if (!notificationResult.ok) return "通知：暂无状态"

  const status = notificationResult.data
  const scheduled = Number(status.scheduledCount || 0)
  const nextDate = status.nextNotificationAt ? parseLocalDateTime(status.nextNotificationAt) : null
  const nextText = nextDate ? formatMonthDayTime(nextDate) : "无"
  return `通知：已安排 ${scheduled} 条，下一次 ${nextText}`
}

async function main() {
  const authResult = readJsonFile(AUTH_STATUS_FILE_NAME)
  const scheduleResult = readJsonFile(SCHEDULE_FILE_NAME)
  const notificationResult = readJsonFile(NOTIFICATION_STATUS_FILE_NAME)
  const calendarResult = readJsonFile(CALENDAR_STATUS_FILE_NAME)

  const scheduleSummary = summarizeSchedule(scheduleResult)
  const lines = [
    summarizeAuth(authResult),
    scheduleSummary.cacheLine,
    scheduleSummary.todayLine,
    scheduleSummary.nextLine,
    summarizeCalendar(calendarResult),
    summarizeNotifications(notificationResult)
  ]

  await finishWithMessage("GDUT课表更新完成", lines.join("\n"))
}

await main()
Script.complete()
