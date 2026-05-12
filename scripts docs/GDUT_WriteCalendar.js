// GDUT_WriteCalendar.js
// Scriptable for iOS

const CACHE_FILE_NAME = "gdut_schedule.json"
const CALENDAR_STATUS_FILE_NAME = "gdut_calendar_status.json"
const TARGET_CALENDAR_NAME = "GDUT课表"
const EVENT_ID_PREFIX = "GDUT_EVENT_ID="

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

function schedulePath() {
  const fm = FileManager.local()
  const docs = fm.documentsDirectory()
  return fm.joinPath(docs, CACHE_FILE_NAME)
}

function calendarStatusPath() {
  const fm = FileManager.local()
  const docs = fm.documentsDirectory()
  return fm.joinPath(docs, CALENDAR_STATUS_FILE_NAME)
}

function readSchedule() {
  const fm = FileManager.local()
  const path = schedulePath()

  if (!fm.fileExists(path)) {
    return {
      ok: false,
      reason: "missing",
      occurrences: []
    }
  }

  try {
    const cache = JSON.parse(fm.readString(path))
    return {
      ok: true,
      occurrences: extractOccurrences(cache)
    }
  } catch (error) {
    return {
      ok: false,
      reason: "parseFailed",
      occurrences: []
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

function safeText(value, fallback) {
  const text = String(value == null ? "" : value).trim()
  return text || fallback
}

function courseId(course) {
  return safeText(course && course.id, "")
}

function courseName(course) {
  return safeText(course && course.courseName, "未命名课程")
}

function teacherName(course) {
  return safeText(course && course.teacher, "未知教师")
}

function classroomName(course) {
  return safeText(course && course.classroom, "未知教室")
}

function parseDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function validateOccurrence(course) {
  if (!course || typeof course !== "object") {
    return {
      ok: false,
      reason: "课程对象无效"
    }
  }

  if (!courseId(course)) {
    return {
      ok: false,
      reason: "缺少 CourseOccurrence.id"
    }
  }

  const startDate = parseDateTime(course.startDateTime)
  const endDate = parseDateTime(course.endDateTime)

  if (!startDate || !endDate) {
    return {
      ok: false,
      reason: "开始或结束时间无效"
    }
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return {
      ok: false,
      reason: "结束时间不晚于开始时间"
    }
  }

  return {
    ok: true,
    startDate,
    endDate
  }
}

function sortValidEntries(entries) {
  return entries.slice().sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
}

function getDateRange(entries) {
  let startDate = null
  let endDate = null

  for (const entry of entries) {
    if (!startDate || entry.startDate.getTime() < startDate.getTime()) {
      startDate = entry.startDate
    }

    if (!endDate || entry.endDate.getTime() > endDate.getTime()) {
      endDate = entry.endDate
    }
  }

  return {
    startDate,
    endDate
  }
}

function formatDate(date) {
  if (!date) return "无"
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatTime(date) {
  if (!date) return "--:--"
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${hour}:${minute}`
}

function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return "无"
  return `${formatDate(startDate)} 至 ${formatDate(endDate)}`
}

function makeEventMarker(course) {
  return `${EVENT_ID_PREFIX}${courseId(course)}`
}

function makeNotes(course) {
  return [
    makeEventMarker(course),
    `学期：${safeText(course.semesterCode, "无")}`,
    `周次：第 ${safeText(course.week, "无")} 周`,
    `星期：${safeText(course.weekday, "无")}`,
    `节次：第 ${safeText(course.startSection, "无")}-${safeText(course.endSection, "无")} 节`,
    `教师：${teacherName(course)}`,
    `教室：${classroomName(course)}`,
    `教学类型：${safeText(course.teachingType, "无")}`,
    `授课内容：${safeText(course.description, "无")}`,
    `原始排课ID：${safeText(course.rawSourceId, "无")}`
  ].join("\n")
}

function extractExistingEventIds(events) {
  const ids = new Set()

  for (const event of events) {
    const notes = String(event.notes || "")
    const lines = notes.split(/\r?\n/)

    for (const line of lines) {
      if (line.indexOf(EVENT_ID_PREFIX) === 0) {
        const id = line.slice(EVENT_ID_PREFIX.length).trim()
        if (id) ids.add(id)
      }
    }
  }

  return ids
}

function courseSummary(entry) {
  const course = entry.course
  const time = `${formatTime(entry.startDate)}-${formatTime(entry.endDate)}`
  return `${formatDate(entry.startDate)} ${time} ${courseName(course)} ${classroomName(course)}`
}

function formatList(values) {
  return values.length > 0 ? values.join("\n") : "无"
}

function writeCalendarStatus(result) {
  const fm = FileManager.local()
  const status = {
    lastWrittenAt: new Date().toISOString(),
    totalCourseCount: result.cacheCourseCount,
    existedCount: result.existingCount,
    createdCount: result.createdCount,
    failedCount: result.failedCount
  }

  fm.writeString(calendarStatusPath(), JSON.stringify(status, null, 2))
}

async function findTargetCalendar() {
  try {
    return await Calendar.forEventsByTitle(TARGET_CALENDAR_NAME)
  } catch (error) {
    return null
  }
}

async function writeCalendarEvent(entry, calendar) {
  const course = entry.course
  const event = new CalendarEvent()
  event.title = courseName(course)
  event.startDate = entry.startDate
  event.endDate = entry.endDate
  event.isAllDay = false
  event.location = classroomName(course)
  event.notes = makeNotes(course)
  event.calendar = calendar

  if (typeof calendar.supportsAvailability === "function" && calendar.supportsAvailability("busy")) {
    event.availability = "busy"
  }

  await event.save()
}

async function showResult(result) {
  const addedText = result.createdSummaries.length > 0
    ? formatList(result.createdSummaries.slice(0, 3))
    : "没有新增事件，可能都已存在。"

  const message = [
    `缓存课程数：${result.cacheCourseCount}`,
    `已存在事件数：${result.existingCount}`,
    `新增事件数：${result.createdCount}`,
    `失败事件数：${result.failedCount}`,
    `目标日历名称：${TARGET_CALENDAR_NAME}`,
    `日期范围：${result.rangeText}`,
    "",
    "前 3 个新增事件摘要：",
    addedText
  ].join("\n")

  await finishWithMessage("写入日历结果", message)
}

async function main() {
  const schedule = readSchedule()

  if (!schedule.ok && schedule.reason === "missing") {
    await finishWithMessage("写入日历结果", "请先运行 GDUT_SyncTimetable 同步课表。")
    return
  }

  if (!schedule.ok && schedule.reason === "parseFailed") {
    await finishWithMessage("写入日历结果", "课表缓存异常，请重新同步。")
    return
  }

  if (schedule.occurrences.length === 0) {
    await finishWithMessage("写入日历结果", "缓存中没有课程数据")
    return
  }

  const validEntries = []
  const failedSummaries = []

  for (const course of schedule.occurrences) {
    const validation = validateOccurrence(course)
    if (validation.ok) {
      validEntries.push({
        course,
        startDate: validation.startDate,
        endDate: validation.endDate
      })
    } else {
      failedSummaries.push(`${courseName(course)}：${validation.reason}`)
    }
  }

  const sortedEntries = sortValidEntries(validEntries)

  if (sortedEntries.length === 0) {
    await finishWithMessage("写入日历结果", "课表缓存中没有可写入的有效课程。")
    return
  }

  const calendar = await findTargetCalendar()
  if (!calendar) {
    await finishWithMessage("写入日历结果", "请先在 Apple 日历 App 中创建名为 GDUT课表 的日历。")
    return
  }

  if (calendar.allowsContentModifications === false) {
    await finishWithMessage("写入日历结果", "GDUT课表 日历不允许写入，请检查日历设置。")
    return
  }

  const range = getDateRange(sortedEntries)
  let existingEvents

  try {
    existingEvents = await CalendarEvent.between(range.startDate, range.endDate, [calendar])
  } catch (error) {
    await finishWithMessage("写入日历结果", `无法读取 GDUT课表 现有事件：${error.message || String(error)}`)
    return
  }

  const existingIds = extractExistingEventIds(existingEvents)
  const createdSummaries = []
  let existingCount = 0
  let createdCount = 0
  let failedCount = failedSummaries.length

  for (const entry of sortedEntries) {
    const id = courseId(entry.course)

    if (existingIds.has(id)) {
      existingCount += 1
      continue
    }

    try {
      await writeCalendarEvent(entry, calendar)
      existingIds.add(id)
      createdCount += 1
      createdSummaries.push(courseSummary(entry))
    } catch (error) {
      failedCount += 1
      failedSummaries.push(`${courseSummary(entry)}：写入失败`)
    }
  }

  const result = {
    cacheCourseCount: schedule.occurrences.length,
    existingCount,
    createdCount,
    failedCount,
    rangeText: formatDateRange(range.startDate, range.endDate),
    createdSummaries,
    failedSummaries
  }

  writeCalendarStatus(result)
  await showResult(result)
}

await main()
Script.complete()
