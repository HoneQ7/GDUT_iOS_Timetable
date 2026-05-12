// GDUT_ScheduleNotifications.js
// Scriptable for iOS

const remindMinutesBefore = 15
const scheduleDaysAhead = 7
const maxNotifications = 64

const enablePreClassReminder = true
const enableBoundaryNotifications = true
const enableClassStartNotification = true
const enableClassEndNotification = true

const remindPrefix = "GDUT_CLASS_REMIND_"
const startPrefix = "GDUT_CLASS_START_"
const endPrefix = "GDUT_CLASS_END_"
const notificationPrefixes = [remindPrefix, startPrefix, endPrefix]

const CACHE_FILE_NAME = "gdut_schedule.json"
const STATUS_FILE_NAME = "gdut_notification_status.json"
const RUN_SUMMARY_URL = "scriptable:///run/GDUT_RunSummary"
const THREAD_IDENTIFIER = "GDUT_CLASS"

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
  if (typeof Script.setShortcutOutput === "function") {
    Script.setShortcutOutput(output)
  }
}

function documentsPath(fileName) {
  const fm = FileManager.local()
  const docs = fm.documentsDirectory()
  return fm.joinPath(docs, fileName)
}

function schedulePath() {
  return documentsPath(CACHE_FILE_NAME)
}

function statusPath() {
  return documentsPath(STATUS_FILE_NAME)
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

function classroomName(course) {
  return safeText(course && course.classroom, "未知教室")
}

function teacherName(course) {
  return safeText(course && course.teacher, "未知教师")
}

function parseDateTime(value) {
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

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
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

function formatDateTime(date) {
  if (!date) return "无"
  return `${formatDate(date)} ${formatTime(date)}`
}

function buildCourseMeta(course) {
  const startDate = parseDateTime(course && course.startDateTime)
  const endDate = parseDateTime(course && course.endDateTime)

  return {
    course,
    id: courseId(course),
    name: courseName(course),
    classroom: classroomName(course),
    teacher: teacherName(course),
    startDate,
    endDate,
    dateKey: safeText(course && course.date, startDate ? formatDate(startDate) : "")
  }
}

function isCourseInScheduleRange(meta, now, horizon) {
  if (!meta.startDate) return false
  if (meta.startDate.getTime() > horizon.getTime()) return false
  if (meta.startDate.getTime() > now.getTime()) return true
  return meta.endDate && meta.endDate.getTime() > now.getTime()
}

function findNextCourseAfter(courseMeta, allCourses) {
  if (!courseMeta.endDate) return null

  const endTime = courseMeta.endDate.getTime()
  const candidates = allCourses
    .filter(meta => meta !== courseMeta)
    .filter(meta => meta.startDate)
    .filter(meta => meta.dateKey === courseMeta.dateKey)
    .filter(meta => meta.startDate.getTime() > endTime)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  return candidates[0] || null
}

function notificationIdentifier(prefix, meta) {
  return `${prefix}${meta.id}`
}

function buildPreClassBody(meta) {
  return `${formatTime(meta.startDate)} ${meta.classroom} ${meta.teacher}`
}

function buildClassStartBody(meta) {
  return `${meta.classroom} · ${meta.teacher}`
}

function buildClassEndBody(meta, allCourses) {
  const nextCourse = findNextCourseAfter(meta, allCourses)
  if (!nextCourse) return "今日课程已结束"
  return `下一节：${formatTime(nextCourse.startDate)} ${nextCourse.name} @${nextCourse.classroom}`
}

function createCandidate(type, meta, deliveryDate, title, body, identifier, summaryLabel) {
  return {
    type,
    meta,
    deliveryDate,
    title,
    body,
    identifier,
    summaryLabel
  }
}

function addCandidate(candidates, candidate, now, horizon) {
  if (!candidate.deliveryDate) return false
  if (candidate.deliveryDate.getTime() <= now.getTime()) return false
  if (candidate.deliveryDate.getTime() > horizon.getTime()) return false
  candidates.push(candidate)
  return true
}

function notificationSummary(item) {
  const suffix = item.type === "preClass" ? ` @${item.meta.classroom}` : ""
  return `${formatDateTime(item.deliveryDate)} ${item.summaryLabel}：${item.meta.name}${suffix}`
}

function candidateSortOrder(type) {
  if (type === "preClass") return 1
  if (type === "classStart") return 2
  return 3
}

function buildCandidates(occurrences, now) {
  const horizon = addDays(now, scheduleDaysAhead)
  const allCourses = []
  const candidates = []
  const failedSummaries = []
  let futureDaysCourseCount = 0
  let failedCount = 0

  for (const course of occurrences) {
    const meta = buildCourseMeta(course)
    if (!meta.startDate) {
      failedCount += 1
      failedSummaries.push(`${meta.name}：startDateTime 无效`)
      continue
    }
    allCourses.push(meta)
  }

  allCourses.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  for (const meta of allCourses) {
    if (!isCourseInScheduleRange(meta, now, horizon)) continue

    futureDaysCourseCount += 1

    if (!meta.id) {
      failedCount += 1
      failedSummaries.push(`${meta.name}：缺少课程 ID`)
      continue
    }

    if (enablePreClassReminder) {
      const reminderDate = addMinutes(meta.startDate, -remindMinutesBefore)
      addCandidate(
        candidates,
        createCandidate(
          "preClass",
          meta,
          reminderDate,
          `即将上课：${meta.name}`,
          buildPreClassBody(meta),
          notificationIdentifier(remindPrefix, meta),
          "课前提醒"
        ),
        now,
        horizon
      )
    }

    if (enableBoundaryNotifications && enableClassStartNotification) {
      addCandidate(
        candidates,
        createCandidate(
          "classStart",
          meta,
          meta.startDate,
          `正在上课：${meta.name}`,
          buildClassStartBody(meta),
          notificationIdentifier(startPrefix, meta),
          "上课开始"
        ),
        now,
        horizon
      )
    }

    if (enableBoundaryNotifications && enableClassEndNotification) {
      if (!meta.endDate || meta.endDate.getTime() <= meta.startDate.getTime()) {
        failedCount += 1
        failedSummaries.push(`${meta.name}：endDateTime 无效，已跳过下课通知`)
      } else {
        addCandidate(
          candidates,
          createCandidate(
            "classEnd",
            meta,
            meta.endDate,
            `课程已结束：${meta.name}`,
            buildClassEndBody(meta, allCourses),
            notificationIdentifier(endPrefix, meta),
            "下课结束"
          ),
          now,
          horizon
        )
      }
    }
  }

  candidates.sort((a, b) => {
    const timeDiff = a.deliveryDate.getTime() - b.deliveryDate.getTime()
    if (timeDiff !== 0) return timeDiff
    return candidateSortOrder(a.type) - candidateSortOrder(b.type)
  })

  return {
    candidates,
    futureDaysCourseCount,
    failedCount,
    failedSummaries
  }
}

function isManagedNotificationId(id) {
  return notificationPrefixes.some(prefix => id.indexOf(prefix) === 0)
}

async function clearOldGdutNotifications() {
  const result = {
    supported: true,
    canceledCount: 0,
    warning: ""
  }

  if (typeof Notification.allPending !== "function" || typeof Notification.removePending !== "function") {
    result.supported = false
    result.warning = "当前 Scriptable 版本不支持自动清理旧通知，可能需要手动检查重复通知。"
    return result
  }

  try {
    const pending = await Notification.allPending()
    const ids = []

    for (const notification of pending) {
      const id = String(notification.identifier || "")
      if (isManagedNotificationId(id)) {
        ids.push(id)
      }
    }

    if (ids.length > 0) {
      await Notification.removePending(ids)
      result.canceledCount = ids.length
    }
  } catch (error) {
    result.supported = false
    result.warning = "当前 Scriptable 版本不支持自动清理旧通知，可能需要手动检查重复通知。"
  }

  return result
}

async function scheduleNotification(item) {
  const notification = new Notification()
  notification.identifier = item.identifier
  notification.title = item.title
  notification.body = item.body
  notification.threadIdentifier = THREAD_IDENTIFIER
  notification.openURL = RUN_SUMMARY_URL
  notification.userInfo = {
    type: item.type,
    courseId: item.meta.id,
    startDateTime: safeText(item.meta.course && item.meta.course.startDateTime, ""),
    endDateTime: safeText(item.meta.course && item.meta.course.endDateTime, "")
  }
  notification.setTriggerDate(item.deliveryDate)
  await notification.schedule()
}

function countScheduledItems(scheduledItems) {
  const counts = {
    preClassCount: 0,
    classStartCount: 0,
    classEndCount: 0
  }

  for (const item of scheduledItems) {
    if (item.type === "preClass") counts.preClassCount += 1
    if (item.type === "classStart") counts.classStartCount += 1
    if (item.type === "classEnd") counts.classEndCount += 1
  }

  return counts
}

function writeStatus(scheduledItems, failedCount, truncated) {
  const fm = FileManager.local()
  const counts = countScheduledItems(scheduledItems)
  const sortedItems = scheduledItems
    .slice()
    .sort((a, b) => a.deliveryDate.getTime() - b.deliveryDate.getTime())
  const nextNotificationAt = sortedItems.length > 0
    ? sortedItems[0].deliveryDate.toISOString()
    : null

  const status = {
    lastScheduledAt: new Date().toISOString(),
    remindMinutesBefore,
    scheduleDaysAhead,
    scheduledCount: scheduledItems.length,
    preClassCount: counts.preClassCount,
    classStartCount: counts.classStartCount,
    classEndCount: counts.classEndCount,
    failedCount,
    nextNotificationAt,
    truncated
  }

  fm.writeString(statusPath(), JSON.stringify(status, null, 2))
}

async function showResult(result) {
  const summaries = result.summaries.length > 0
    ? result.summaries.slice(0, 3).join("\n")
    : "无"
  const warningText = result.cleanupWarning ? ["", result.cleanupWarning] : []

  const message = [
    `缓存课程数：${result.cacheCourseCount}`,
    `未来 ${scheduleDaysAhead} 天课程数：${result.futureDaysCourseCount}`,
    `课前提醒数量：${result.preClassCount}`,
    `上课开始通知数量：${result.classStartCount}`,
    `下课结束通知数量：${result.classEndCount}`,
    `总安排通知数量：${result.scheduledCount}`,
    `已取消旧 GDUT 通知数：${result.canceledCount}`,
    `失败数量：${result.failedCount}`,
    `下一条通知时间：${formatDateTime(result.nextNotificationDate)}`,
    `是否因为超过 ${maxNotifications} 条被截断：${result.truncated ? "是" : "否"}`,
    "",
    "前 3 条新通知摘要：",
    summaries,
    ...warningText
  ].join("\n")

  await finishWithMessage("课程通知安排结果", message)
}

async function main() {
  const schedule = readSchedule()

  if (!schedule.ok && schedule.reason === "missing") {
    await finishWithMessage("课程通知安排结果", "请先运行 GDUT_SyncTimetable 同步课表。")
    return
  }

  if (!schedule.ok && schedule.reason === "parseFailed") {
    await finishWithMessage("课程通知安排结果", "课表缓存异常，请重新同步。")
    return
  }

  const now = new Date()
  const built = buildCandidates(schedule.occurrences, now)
  const cleanup = await clearOldGdutNotifications()
  const selectedCandidates = built.candidates.slice(0, maxNotifications)
  const truncated = built.candidates.length > maxNotifications
  const scheduledItems = []
  const summaries = []
  let failedCount = built.failedCount

  for (const item of selectedCandidates) {
    try {
      await scheduleNotification(item)
      scheduledItems.push(item)
      summaries.push(notificationSummary(item))
    } catch (error) {
      failedCount += 1
      built.failedSummaries.push(`${notificationSummary(item)}：通知创建失败`)
    }
  }

  writeStatus(scheduledItems, failedCount, truncated)

  const counts = countScheduledItems(scheduledItems)
  const nextNotificationDate = scheduledItems.length > 0
    ? scheduledItems.slice().sort((a, b) => a.deliveryDate.getTime() - b.deliveryDate.getTime())[0].deliveryDate
    : null

  await showResult({
    cacheCourseCount: schedule.occurrences.length,
    futureDaysCourseCount: built.futureDaysCourseCount,
    preClassCount: counts.preClassCount,
    classStartCount: counts.classStartCount,
    classEndCount: counts.classEndCount,
    scheduledCount: scheduledItems.length,
    canceledCount: cleanup.canceledCount,
    failedCount,
    nextNotificationDate,
    truncated,
    summaries,
    cleanupWarning: cleanup.warning
  })
}

await main()
if (!config.runsWithSiri) {
  Script.complete()
}
