// GDUT_TodayWidget.js
// Scriptable for iOS

const CACHE_FILE_NAME = "gdut_schedule.json"
const AUTH_STATUS_FILE_NAME = "gdut_auth_status.json"
const previewFamily = "medium"

const COLORS = {
  bgTop: new Color("#101820"),
  bgBottom: new Color("#17212B"),
  card: new Color("#22303C"),
  cardSoft: new Color("#1B2631"),
  primary: new Color("#F5F7FA"),
  secondary: new Color("#B7C0CA"),
  muted: new Color("#7D8996"),
  accent: new Color("#2DD4BF"),
  accentDark: new Color("#115E59"),
  warning: new Color("#F59E0B"),
  warningDark: new Color("#78350F"),
  danger: new Color("#F87171"),
  dangerDark: new Color("#7F1D1D"),
  quiet: new Color("#334155")
}

function cachePath() {
  const fm = FileManager.local()
  return fm.joinPath(fm.documentsDirectory(), CACHE_FILE_NAME)
}

function authStatusPath() {
  const fm = FileManager.local()
  return fm.joinPath(fm.documentsDirectory(), AUTH_STATUS_FILE_NAME)
}

function todayString() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseLocalDateTime(value) {
  const text = String(value || "").trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  )
}

function readSchedule() {
  const path = cachePath()
  const fm = FileManager.local()

  if (!fm.fileExists(path)) {
    return {
      ok: false,
      reason: "missing"
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
      reason: "parseFailed"
    }
  }
}

function readAuthStatus() {
  const fm = FileManager.local()
  const path = authStatusPath()

  if (!fm.fileExists(path)) return null

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
      message: "状态未知",
      lastCheckedAt: null,
      lastSuccessAt: null
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

function courseStartDate(course) {
  return parseLocalDateTime(course.startDateTime) || parseLocalDateTime(`${course.date}T${course.startTime}:00`) || new Date(0)
}

function courseEndDate(course) {
  return parseLocalDateTime(course.endDateTime) || parseLocalDateTime(`${course.date}T${course.endTime}:00`) || new Date(0)
}

function sortCourses(courses) {
  return courses.slice().sort((a, b) => {
    const sectionDiff = Number(a.startSection || 0) - Number(b.startSection || 0)
    if (sectionDiff !== 0) return sectionDiff
    return courseStartDate(a).getTime() - courseStartDate(b).getTime()
  })
}

function findNextCourse(todayCourses, now) {
  const remaining = todayCourses
    .filter(course => courseEndDate(course).getTime() > now.getTime())
    .sort((a, b) => courseStartDate(a).getTime() - courseStartDate(b).getTime())

  return remaining[0] || null
}

function isCourseInProgress(course, now) {
  if (!course) return false
  const start = courseStartDate(course).getTime()
  const end = courseEndDate(course).getTime()
  const current = now.getTime()
  return start <= current && current < end
}

function getCourseState(course, now) {
  if (courseEndDate(course).getTime() <= now.getTime()) return "done"
  if (isCourseInProgress(course, now)) return "active"
  return "upcoming"
}

function getLargeCourseStyle(course, now) {
  const state = getCourseState(course, now)

  if (state === "done") {
    return {
      backgroundColor: COLORS.quiet,
      nameColor: COLORS.muted,
      detailColor: COLORS.muted
    }
  }

  if (state === "active") {
    return {
      backgroundColor: COLORS.accentDark,
      nameColor: COLORS.primary,
      detailColor: COLORS.accent
    }
  }

  return {
    backgroundColor: COLORS.cardSoft,
    nameColor: COLORS.primary,
    detailColor: COLORS.warning
  }
}

function getUpcomingCourses(todayCourses, nextCourse, now) {
  if (!nextCourse) return []

  return todayCourses
    .filter(course => courseEndDate(course).getTime() > now.getTime())
    .filter(course => course.id !== nextCourse.id)
    .sort((a, b) => courseStartDate(a).getTime() - courseStartDate(b).getTime())
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function tomorrowAtFivePastMidnight(now) {
  const date = new Date(now)
  date.setDate(date.getDate() + 1)
  date.setHours(0, 5, 0, 0)
  return date
}

function computeNextWidgetRefreshDate(todayCourses, now) {
  if (todayCourses.length === 0) return tomorrowAtFivePastMidnight(now)

  const activeCourse = todayCourses.find(course => isCourseInProgress(course, now))
  if (activeCourse) return addMinutes(courseEndDate(activeCourse), 1)

  const nextCourse = todayCourses
    .filter(course => courseStartDate(course).getTime() > now.getTime())
    .sort((a, b) => courseStartDate(a).getTime() - courseStartDate(b).getTime())[0]

  if (nextCourse) return addMinutes(courseStartDate(nextCourse), 1)
  return tomorrowAtFivePastMidnight(now)
}

function truncateText(text, maxLength) {
  const value = String(text || "")
  if (value.length <= maxLength) return value
  if (maxLength <= 1) return value.slice(0, maxLength)
  return `${value.slice(0, maxLength - 1)}…`
}

function formatTime(course) {
  return `${course.startTime || "--:--"}-${course.endTime || "--:--"}`
}

function formatClassroom(course) {
  return course.classroom || "教室未填"
}

function formatTeacherName(course) {
  const teacher = String(course && course.teacher != null ? course.teacher : "").trim()
  return teacher || "未知教师"
}

function formatTeacher(course) {
  const teacher = formatTeacherName(course)
  return teacher === "未知教师" ? "教师：未知" : `教师：${teacher}`
}

function formatCourseLine(course) {
  const startTime = course.startTime || "--:--"
  const name = truncateText(course.courseName || "未命名课程", 10)
  const teacher = truncateText(formatTeacherName(course), 5)
  const classroom = truncateText(formatClassroom(course), 8)
  return `${startTime} ${name} · ${teacher} @${classroom}`
}

function addText(stack, text, font, color, lineLimit = 1) {
  const item = stack.addText(String(text || ""))
  item.font = font
  item.textColor = color || COLORS.primary
  item.lineLimit = lineLimit
  item.minimumScaleFactor = 0.72
  return item
}

function applyBackground(widget) {
  const gradient = new LinearGradient()
  gradient.colors = [COLORS.bgTop, COLORS.bgBottom]
  gradient.locations = [0, 1]
  widget.backgroundGradient = gradient
}

function getAuthBadgeInfo(authStatus, family) {
  if (!authStatus || authStatus.status === "valid") return null

  if (authStatus.status === "expired") {
    return {
      text: family === "small" ? "过期" : family === "large" || family === "extraLarge" ? "登录已过期，请更新" : "登录已过期",
      textColor: COLORS.danger,
      backgroundColor: COLORS.dangerDark
    }
  }

  if (authStatus.status === "networkError") {
    return {
      text: family === "small" ? "网" : "网络异常",
      textColor: COLORS.warning,
      backgroundColor: COLORS.warningDark
    }
  }

  if (authStatus.status === "permissionDenied") {
    return {
      text: family === "small" ? "权" : "部分周失败",
      textColor: COLORS.warning,
      backgroundColor: COLORS.warningDark
    }
  }

  if (authStatus.status === "unknown") {
    return {
      text: family === "small" ? "?" : "状态未知",
      textColor: COLORS.muted,
      backgroundColor: COLORS.quiet
    }
  }

  return null
}

function addAuthStatusBadge(stack, authStatus, family) {
  const info = getAuthBadgeInfo(authStatus, family)
  if (!info) return

  const badge = stack.addStack()
  badge.layoutHorizontally()
  badge.centerAlignContent()
  badge.cornerRadius = 6
  badge.backgroundColor = info.backgroundColor
  badge.setPadding(1, 5, 1, 5)

  const text = badge.addText(info.text)
  text.font = Font.boldSystemFont(family === "small" ? 8 : 9)
  text.textColor = info.textColor
  text.lineLimit = 1
  text.minimumScaleFactor = 0.7
}

function addHeader(widget, title, count, authStatus, family) {
  const row = widget.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()

  addText(row, title, Font.boldSystemFont(14), COLORS.primary)
  if (family === "large" || family === "extraLarge") {
    row.addSpacer(4)
    addAuthStatusBadge(row, authStatus, family)
  }
  row.addSpacer()
  if (family !== "large" && family !== "extraLarge") {
    addAuthStatusBadge(row, authStatus, family)
    row.addSpacer(4)
  }
  addText(row, `今天 ${count} 节`, Font.mediumSystemFont(11), COLORS.accent)
}

function addStatusBadge(stack, text, type) {
  const badge = stack.addStack()
  badge.layoutHorizontally()
  badge.centerAlignContent()
  badge.cornerRadius = 6
  badge.setPadding(2, 6, 2, 6)

  if (type === "active") {
    badge.backgroundColor = COLORS.accentDark
  } else if (type === "empty" || type === "ended") {
    badge.backgroundColor = COLORS.quiet
  } else {
    badge.backgroundColor = COLORS.warningDark
  }

  const badgeText = badge.addText(text)
  badgeText.font = Font.boldSystemFont(9)
  badgeText.textColor = type === "active" ? COLORS.accent : COLORS.warning
  badgeText.lineLimit = 1
  badgeText.minimumScaleFactor = 0.8

  return badge
}

function addMainCourseCard(widget, course, statusText, family) {
  const card = widget.addStack()
  card.layoutVertically()
  card.backgroundColor = COLORS.card
  card.cornerRadius = 10
  card.setPadding(family === "medium" ? 6 : 8, 9, family === "medium" ? 6 : 8, 9)

  const badgeRow = card.addStack()
  badgeRow.layoutHorizontally()
  addStatusBadge(badgeRow, statusText, statusText === "正在上课" ? "active" : "next")
  badgeRow.addSpacer()

  card.addSpacer(family === "medium" ? 3 : 6)

  const nameSize = family === "small" ? 13 : family === "medium" ? 15 : 17
  const maxNameLength = family === "small" ? 12 : family === "medium" ? 18 : 24
  addText(card, truncateText(course.courseName || "未命名课程", maxNameLength), Font.boldSystemFont(nameSize), COLORS.primary)

  card.addSpacer(family === "medium" ? 3 : 5)

  if (family === "medium") {
    const teacher = truncateText(formatTeacherName(course), 6)
    const classroom = truncateText(formatClassroom(course), 12)
    addText(card, `${formatTime(course)} · ${teacher} · ${classroom}`, Font.mediumSystemFont(11), COLORS.accent)
  } else if (family === "small") {
    addText(card, formatTime(course), Font.mediumSystemFont(11), COLORS.accent)
    card.addSpacer(3)
    addText(card, `${truncateText(formatTeacherName(course), 6)} · ${truncateText(formatClassroom(course), 10)}`, Font.systemFont(10), COLORS.secondary)
  } else {
    addText(card, formatTime(course), Font.mediumSystemFont(12), COLORS.accent)
    card.addSpacer(3)
    addText(card, truncateText(formatClassroom(course), 20), Font.systemFont(11), COLORS.secondary)
  }

  if (family === "large") {
    card.addSpacer(3)
    addText(card, truncateText(formatTeacher(course), 22), Font.systemFont(11), COLORS.secondary)
  }
}

function addUpcomingList(widget, courses, limit) {
  const list = courses.slice(0, limit)
  if (list.length === 0) return

  widget.addSpacer(4)

  const titleRow = widget.addStack()
  titleRow.layoutHorizontally()
  addText(titleRow, "后续", Font.boldSystemFont(10), COLORS.muted)
  titleRow.addSpacer()

  widget.addSpacer(2)

  for (let index = 0; index < list.length; index++) {
    const row = widget.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    row.backgroundColor = COLORS.cardSoft
    row.cornerRadius = 7
    row.setPadding(2, 6, 2, 6)
    addText(row, formatCourseLine(list[index]), Font.systemFont(10), COLORS.secondary)
    if (index < list.length - 1) widget.addSpacer(2)
  }
}

function addEmptyCard(widget, title, subtitle, badgeText, type, family) {
  const card = widget.addStack()
  card.layoutVertically()
  card.backgroundColor = COLORS.card
  card.cornerRadius = 10
  card.setPadding(family === "small" ? 8 : 10, 9, family === "small" ? 8 : 10, 9)

  const badgeRow = card.addStack()
  badgeRow.layoutHorizontally()
  addStatusBadge(badgeRow, badgeText, type)
  badgeRow.addSpacer()

  card.addSpacer(6)
  addText(card, title, Font.boldSystemFont(family === "small" ? 13 : 15), COLORS.primary)

  if (family !== "small") {
    card.addSpacer(4)
    addText(card, subtitle, Font.systemFont(11), COLORS.secondary)
  }
}

function renderSmall(widget, state) {
  if (state.status === "missing") {
    addHeader(widget, "今日课表", 0, state.authStatus, "small")
    widget.addSpacer(4)
    addEmptyCard(widget, "请先同步课表", "", "待同步", "empty", "small")
    return
  }

  if (state.status === "parseFailed") {
    addHeader(widget, "今日课表", 0, state.authStatus, "small")
    widget.addSpacer(4)
    addEmptyCard(widget, "课表缓存异常", "", "异常", "empty", "small")
    return
  }

  addHeader(widget, "今日课表", state.todayCourses.length, state.authStatus, "small")
  widget.addSpacer(4)

  if (state.todayCourses.length === 0) {
    addEmptyCard(widget, "今天没课", "可以安心安排自己的学习计划", "今天没课", "empty", "small")
    return
  }

  if (!state.nextCourse) {
    addEmptyCard(widget, "今日课程已结束", "明天继续保持节奏", "已结束", "ended", "small")
    return
  }

  addMainCourseCard(widget, state.nextCourse, state.statusText, "small")
}

function renderMedium(widget, state) {
  if (state.status === "missing") {
    addHeader(widget, "今日课表", 0, state.authStatus, "medium")
    widget.addSpacer(4)
    addEmptyCard(widget, "请先同步课表", "运行 GDUT_SyncTimetable", "待同步", "empty", "medium")
    return
  }

  if (state.status === "parseFailed") {
    addHeader(widget, "今日课表", 0, state.authStatus, "medium")
    widget.addSpacer(4)
    addEmptyCard(widget, "课表缓存异常，请重新同步", "缓存文件无法解析", "异常", "empty", "medium")
    return
  }

  addHeader(widget, "今日课表", state.todayCourses.length, state.authStatus, "medium")
  widget.addSpacer(4)

  if (state.todayCourses.length === 0) {
    addEmptyCard(widget, "今天没课", "可以安心安排自己的学习计划", "今天没课", "empty", "medium")
    return
  }

  if (!state.nextCourse) {
    addEmptyCard(widget, "今日课程已结束", "明天继续保持节奏", "已结束", "ended", "medium")
    return
  }

  addMainCourseCard(widget, state.nextCourse, state.statusText, "medium")
  addUpcomingList(widget, state.upcomingCourses, 2)
}

function renderLarge(widget, state) {
  if (state.status === "missing") {
    addHeader(widget, "今日课表", 0, state.authStatus, "large")
    widget.addSpacer(8)
    addEmptyCard(widget, "请先同步课表", "运行 GDUT_SyncTimetable 后再查看今日课程", "待同步", "empty", "large")
    return
  }

  if (state.status === "parseFailed") {
    addHeader(widget, "今日课表", 0, state.authStatus, "large")
    widget.addSpacer(8)
    addEmptyCard(widget, "课表缓存异常，请重新同步", "缓存文件无法解析", "异常", "empty", "large")
    return
  }

  addHeader(widget, "今日课表", state.todayCourses.length, state.authStatus, "large")
  widget.addSpacer(8)

  if (state.todayCourses.length === 0) {
    addEmptyCard(widget, "今天没课", "可以安心安排自己的学习计划", "今天没课", "empty", "large")
    return
  }

  if (!state.nextCourse) {
    addEmptyCard(widget, "今日课程已结束", "明天继续保持节奏", "已结束", "ended", "large")
    widget.addSpacer(8)
  } else {
    addMainCourseCard(widget, state.nextCourse, state.statusText, "large")
    widget.addSpacer(8)
  }

  const titleRow = widget.addStack()
  titleRow.layoutHorizontally()
  addText(titleRow, "今日课程", Font.boldSystemFont(11), COLORS.muted)
  titleRow.addSpacer()
  widget.addSpacer(4)

  const list = state.todayCourses.slice(0, 8)
  const now = state.now || new Date()
  for (let index = 0; index < list.length; index++) {
    const course = list[index]
    const style = getLargeCourseStyle(course, now)
    const row = widget.addStack()
    row.layoutVertically()
    row.backgroundColor = style.backgroundColor
    row.cornerRadius = 8
    row.setPadding(5, 7, 5, 7)
    addText(row, truncateText(course.courseName || "未命名课程", 24), Font.mediumSystemFont(11), style.nameColor)
    row.addSpacer(2)
    const detail = `${formatTime(course)} · ${truncateText(formatTeacherName(course), 10)} · ${truncateText(formatClassroom(course), 16)}`
    addText(row, detail, Font.systemFont(10), style.detailColor)
    if (index < list.length - 1) widget.addSpacer(4)
  }
}

function buildState() {
  const schedule = readSchedule()
  const now = new Date()
  const authStatus = readAuthStatus()

  if (!schedule.ok) {
    return {
      status: schedule.reason,
      todayCourses: [],
      nextCourse: null,
      upcomingCourses: [],
      statusText: "",
      authStatus,
      now,
      nextRefreshDate: tomorrowAtFivePastMidnight(now)
    }
  }

  const today = todayString()
  const todayCourses = sortCourses(
    schedule.occurrences.filter(course => String(course.date || "") === today)
  )
  const nextCourse = findNextCourse(todayCourses, now)
  const statusText = isCourseInProgress(nextCourse, now) ? "正在上课" : "下一节课"

  return {
    status: "ok",
    todayCourses,
    nextCourse,
    upcomingCourses: getUpcomingCourses(todayCourses, nextCourse, now),
    statusText,
    authStatus,
    now,
    nextRefreshDate: computeNextWidgetRefreshDate(todayCourses, now)
  }
}

function buildWidget(state, family) {
  const widget = new ListWidget()
  applyBackground(widget)
  widget.setPadding(10, 12, 10, 12)
  widget.url = "scriptable:///run/GDUT_RunSummary"
  // refreshAfterDate 只是建议 iOS 最早刷新时间，不保证小组件会在上下课边界准时刷新。
  widget.refreshAfterDate = state.nextRefreshDate

  if (family === "small") {
    renderSmall(widget, state)
  } else if (family === "large" || family === "extraLarge") {
    renderLarge(widget, state)
  } else {
    renderMedium(widget, state)
  }

  return widget
}

async function presentPreview(widget, family) {
  if (family === "small") {
    await widget.presentSmall()
  } else if ((family === "large" || family === "extraLarge") && widget.presentLarge) {
    await widget.presentLarge()
  } else {
    await widget.presentMedium()
  }
}

const family = config.widgetFamily || previewFamily
const widget = buildWidget(buildState(), family)

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await presentPreview(widget, previewFamily)
}

Script.complete()
