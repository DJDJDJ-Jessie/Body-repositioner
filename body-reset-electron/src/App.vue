<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Activity,
  CalendarDays,
  Check,
  CircleAlert,
  FolderOpen,
  Pause,
  Play,
  RotateCcw,
  Settings,
  ShieldCheck,
  TimerReset,
  Video,
  X,
} from '@lucide/vue'

type AppSettings = {
  focusMinutes: number
  resetMinutes: number
  resetVolume: number
  sleepReminderVolume: number
  videoFolder: string
  sleepReminderEnabled: boolean
  sleepReminderStart: string
  sleepReminderEnd: string
  sleepReminderInterval: number
  sleepReminderFolder: string
  strictMode: boolean
  autoStartWhenUnlocked: boolean
  earlyResetEnabled: boolean
  earlyResetMinutes: number
  minimizeToTray: boolean
  autoStart: boolean
  emergencyExitSeconds: number
  externalLogSyncEnabled: boolean
  externalLogSyncFolder: string
}

type TodayStats = {
  date: string
  focusMs: number
  resetMs: number
  resetCount: number
  completedResetCount: number
  skippedResetCount: number
}

type StatsPeriod = 'week' | 'month'

type StatsDay = TodayStats & {
  weekday: string
}

type StatsTotals = {
  focusMs: number
  resetMs: number
  resetCount: number
  completedResetCount: number
  skippedResetCount: number
  completionRate: number
}

type StatsTable = {
  period: StatsPeriod
  title: string
  startDate: string
  endDate: string
  generatedAt: string
  days: StatsDay[]
  totals: StatsTotals
}

type ExternalLogSyncStatus = {
  enabled: boolean
  folderPath: string
  configured: boolean
  lastSyncedAt: string | null
  lastError: string | null
}

type VideoItem = {
  name: string
  path: string
  url: string
  updatedAt: number
  size: number
}

type AppState = {
  appRoot: string
  dataDir: string
  settings: AppSettings
  videoFolderPath: string
  baseVideoFolderPath: string
  videoSourceLabel: string
  videoSourceKind: string
  matchedVideoFolderName: string | null
  videos: VideoItem[]
  videoCount: number
  sleepReminderVideoFolderPath: string
  sleepReminderVideoCount: number
  todayStats: TodayStats
  externalLogSyncStatus: ExternalLogSyncStatus
  systemLocked: boolean
  shouldAutoStartTimer: boolean
}

type ResetPayload = {
  id: number
  startedAt?: number
  video: VideoItem | null
  settings: AppSettings
  canClose: boolean
}

type ReminderPayload = {
  id: number
  startedAt: number
  video: VideoItem | null
  settings: AppSettings
  canClose: boolean
}

const fallbackSettings: AppSettings = {
  focusMinutes: 50,
  resetMinutes: 6,
  resetVolume: 1,
  sleepReminderVolume: 1,
  videoFolder: 'videos',
  sleepReminderEnabled: false,
  sleepReminderStart: '23:00',
  sleepReminderEnd: '07:00',
  sleepReminderInterval: 30,
  sleepReminderFolder: 'sleep-reminders',
  strictMode: true,
  autoStartWhenUnlocked: true,
  earlyResetEnabled: false,
  earlyResetMinutes: 3,
  minimizeToTray: true,
  autoStart: false,
  emergencyExitSeconds: 5,
  externalLogSyncEnabled: false,
  externalLogSyncFolder: '',
}
const fallbackTodayStats: TodayStats = {
  date: '',
  focusMs: 0,
  resetMs: 0,
  resetCount: 0,
  completedResetCount: 0,
  skippedResetCount: 0,
}
const fallbackStatsTotals: StatsTotals = {
  focusMs: 0,
  resetMs: 0,
  resetCount: 0,
  completedResetCount: 0,
  skippedResetCount: 0,
  completionRate: 0,
}
const fallbackExternalLogSyncStatus: ExternalLogSyncStatus = {
  enabled: false,
  folderPath: '',
  configured: false,
  lastSyncedAt: null,
  lastError: null,
}

function createEmptyStatsTable(period: StatsPeriod = 'week'): StatsTable {
  const today = getBrowserDateKey()
  return {
    period,
    title: period === 'month' ? '本月数据表' : '本周数据表',
    startDate: today,
    endDate: today,
    generatedAt: new Date().toISOString(),
    days: [{ ...fallbackTodayStats, date: today, weekday: '今天' }],
    totals: { ...fallbackStatsTotals },
  }
}

const view = new URLSearchParams(window.location.search).get('view') || 'main'
const isResetView = view === 'reset'
const isReminderView = view === 'reminder'

const settings = ref<AppSettings>({ ...fallbackSettings })
const remainingMs = ref(fallbackSettings.focusMinutes * 60_000)
const timerMode = ref<'idle' | 'running' | 'paused' | 'waiting'>('idle')
const videoCount = ref(0)
const videoFolderPath = ref('')
const baseVideoFolderPath = ref('')
const videoSourceLabel = ref('')
const sleepReminderVideoFolderPath = ref('')
const sleepReminderVideoCount = ref(0)
const todayStats = ref<TodayStats>({ ...fallbackTodayStats })
const externalLogSyncStatus = ref<ExternalLogSyncStatus>({ ...fallbackExternalLogSyncStatus })
const statsPeriod = ref<StatsPeriod>('week')
const statsTable = ref<StatsTable>(createEmptyStatsTable('week'))
const isSettingsOpen = ref(false)
const toast = ref('')
const lastReset = ref('')

const resetPayload = ref<ResetPayload | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const canCompleteReset = ref(false)
const resetStage = ref<'loading' | 'playing' | 'manual-play' | 'ended' | 'empty' | 'fallback'>(
  'loading',
)
const fallbackRemaining = ref(30)
const emergencyHolding = ref(false)
const emergencyLeft = ref(0)
const resetVolume = ref(1)
const resetIsPlaying = ref(false)
const resetNotice = ref('身体先回来，工作等一下。')
const earlyResetRemainingMs = ref(0)
const reminderPayload = ref<ReminderPayload | null>(null)
const reminderVideoRef = ref<HTMLVideoElement | null>(null)
const reminderVolume = ref(1)
const reminderIsPlaying = ref(false)
const reminderEmergencyHolding = ref(false)
const reminderEmergencyLeft = ref(0)

let tickHandle: number | null = null
let lastTickAt = 0
let toastHandle: number | null = null
let fallbackHandle: number | null = null
let emergencyHandle: number | null = null
let reminderEmergencyHandle: number | null = null
let removeResetListener: (() => void) | null = null
let removeSuspendListener: (() => void) | null = null
let removeResumeListener: (() => void) | null = null
let removeLockListener: (() => void) | null = null
let removeUnlockListener: (() => void) | null = null
let mediaVolumeSaveHandle: number | null = null
let pendingMediaVolumeSave: {
  key: 'resetVolume' | 'sleepReminderVolume'
  value: number
} | null = null
let settingsSaveChain = Promise.resolve()
let focusBufferMs = 0
let isFlushingFocus = false
let autoStartChecked = false
let wasRunningBeforeSuspend = false
let wasRunningBeforeLock = false
let isSystemLocked = false
let mainStateLoaded = false
let autoResumeHandle: number | null = null
let earlyResetHandle: number | null = null
let resetMediaFailureHandled = false
const autoResumeAfterPauseMs = 5 * 60_000
const totalFocusMs = computed(() => settings.value.focusMinutes * 60_000)
const elapsedMs = computed(() => Math.max(0, totalFocusMs.value - remainingMs.value))
const focusPercent = computed(() => {
  if (!totalFocusMs.value) return 0
  return Math.min(100, Math.max(0, (elapsedMs.value / totalFocusMs.value) * 100))
})
const timeText = computed(() => formatTime(remainingMs.value))
const statusTitle = computed(() => {
  if (timerMode.value === 'running') return '专注中'
  if (timerMode.value === 'paused') return '已暂停'
  if (timerMode.value === 'waiting') return '复位中'
  return '准备开始'
})
const statusBody = computed(() => {
  if (timerMode.value === 'running') return '到点后自动进入身体复位。'
  if (timerMode.value === 'paused') return '倒计时已停住，可以继续或重置。'
  if (timerMode.value === 'waiting') return '正在等待复位完成。'
  return '点击开始后进入专注倒计时。'
})
const primaryActionText = computed(() => {
  if (timerMode.value === 'running') return '暂停'
  if (timerMode.value === 'paused') return '继续'
  return '开始专注'
})
const primaryActionIcon = computed(() => (timerMode.value === 'running' ? Pause : Play))
const resetVideoName = computed(() => resetPayload.value?.video?.name || '')
const resetVolumeText = computed(() => formatVolume(resetVolume.value))
const reminderVolumeText = computed(() => formatVolume(reminderVolume.value))
const resetButtonText = computed(() => {
  if (resetStage.value === 'ended') return '完成，回到工作'
  if (resetStage.value === 'empty') return '我已知道'
  if (canCompleteReset.value && resetPayload.value?.settings.earlyResetEnabled) {
    return '提前完成，回到工作'
  }
  if (resetPayload.value?.settings.earlyResetEnabled && earlyResetRemainingMs.value > 0) {
    return `${formatTime(earlyResetRemainingMs.value)} 后可返回`
  }
  return '视频结束后可完成'
})
const todayFocusText = computed(() => formatDuration(todayStats.value.focusMs))
const todayResetText = computed(() => formatDuration(todayStats.value.resetMs))
const todayResetCountText = computed(() => `${todayStats.value.completedResetCount} 次`)
const rhythmWorkFlex = computed(() => Math.max(1, todayStats.value.focusMs))
const rhythmResetFlex = computed(() => Math.max(0, todayStats.value.resetMs))
const resetDots = computed(() =>
  Array.from({ length: 8 }, (_item, index) => index < todayStats.value.completedResetCount),
)
const extraResetCount = computed(() => Math.max(0, todayStats.value.completedResetCount - 8))
const statsRows = computed(() => statsTable.value.days.slice().reverse())
const statsRangeText = computed(
  () => `${formatShortDate(statsTable.value.startDate)} - ${formatShortDate(statsTable.value.endDate)}`,
)
const statsTotalFocusText = computed(() => formatCompactDuration(statsTable.value.totals.focusMs))
const statsTotalResetText = computed(() => formatCompactDuration(statsTable.value.totals.resetMs))
const statsCompletedText = computed(
  () => `${statsTable.value.totals.completedResetCount}/${statsTable.value.totals.resetCount} 次`,
)
const statsCompletionText = computed(() => `${statsTable.value.totals.completionRate}%`)
const externalLogSyncStatusText = computed(() => {
  if (!settings.value.externalLogSyncEnabled) {
    return '未开启。程序仍会在自己的 data 文件夹保存完整日志。'
  }
  if (!settings.value.externalLogSyncFolder) {
    return '已开启，但还没有选择外部同步文件夹。'
  }
  if (externalLogSyncStatus.value.lastError) {
    return `同步异常：${externalLogSyncStatus.value.lastError}`
  }
  if (externalLogSyncStatus.value.lastSyncedAt) {
    return `最近同步：${formatSyncTime(externalLogSyncStatus.value.lastSyncedAt)}`
  }
  return '已开启，下一次复位或统计变化后会自动同步。'
})

function formatTime(ms: number) {
  const safeMs = Math.max(0, ms)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatVolume(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function formatDuration(ms: number) {
  const minutes = Math.round(Math.max(0, ms) / 60_000)
  if (minutes <= 0) return '0 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`
}

function formatCompactDuration(ms: number) {
  const minutes = Math.round(Math.max(0, ms) / 60_000)
  if (minutes <= 0) return '0分'
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours}时${restMinutes}分` : `${hours}时`
}

function getBrowserDateKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortDate(dateKey: string) {
  const parts = dateKey.split('-')
  if (parts.length !== 3) return dateKey || '今天'
  return `${parts[1]}/${parts[2]}`
}

function formatSyncTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function getCompletionText(stats: TodayStats | StatsTotals) {
  if (!stats.resetCount) return '0%'
  return `${Math.round((stats.completedResetCount / stats.resetCount) * 100)}%`
}

function applyState(nextState: AppState) {
  settings.value = { ...nextState.settings }
  videoCount.value = nextState.videoCount
  videoFolderPath.value = nextState.videoFolderPath
  baseVideoFolderPath.value = nextState.baseVideoFolderPath || nextState.videoFolderPath
  videoSourceLabel.value = nextState.videoSourceLabel || '今日使用：默认 videos 文件夹'
  sleepReminderVideoFolderPath.value = nextState.sleepReminderVideoFolderPath || ''
  sleepReminderVideoCount.value = nextState.sleepReminderVideoCount || 0
  todayStats.value = { ...fallbackTodayStats, ...nextState.todayStats }
  externalLogSyncStatus.value = {
    ...fallbackExternalLogSyncStatus,
    ...nextState.externalLogSyncStatus,
  }
  isSystemLocked = Boolean(nextState.systemLocked)
  if (timerMode.value === 'idle') {
    remainingMs.value = settings.value.focusMinutes * 60_000
  }
}

async function loadMainState() {
  const nextState = await window.bodyReset.getState()
  applyState(nextState)
  await loadStatsTable(false)
  if (!autoStartChecked) {
    autoStartChecked = true
    if (nextState.shouldAutoStartTimer) {
      remainingMs.value = totalFocusMs.value
      timerMode.value = 'running'
      startTicker()
      showToast('已随开机启动开始倒计时')
    }
  }
  mainStateLoaded = true
  if (!nextState.shouldAutoStartTimer) {
    maybeAutoStartWhenUnlocked()
  }
}

async function loadStatsTable(showMessage = false) {
  statsTable.value = await window.bodyReset.getStatsTable(statsPeriod.value)
  if (showMessage) {
    showToast('数据表已刷新')
  }
}

function setStatsPeriod(period: StatsPeriod) {
  if (statsPeriod.value === period) return
  statsPeriod.value = period
  void loadStatsTable(false)
}

function showToast(message: string) {
  toast.value = message
  if (toastHandle) window.clearTimeout(toastHandle)
  toastHandle = window.setTimeout(() => {
    toast.value = ''
  }, 2600)
}

function clearTicker() {
  if (tickHandle) {
    window.clearInterval(tickHandle)
    tickHandle = null
  }
}

function clearAutoResume() {
  if (autoResumeHandle) {
    window.clearTimeout(autoResumeHandle)
    autoResumeHandle = null
  }
}

function startFocusTimer(message = '') {
  if (isSystemLocked || timerMode.value === 'waiting' || timerMode.value === 'running') return
  clearAutoResume()
  if (remainingMs.value <= 0) {
    remainingMs.value = totalFocusMs.value
  }
  timerMode.value = 'running'
  startTicker()
  if (message) showToast(message)
}

function scheduleAutoResume() {
  clearAutoResume()
  if (
    !mainStateLoaded ||
    !settings.value.autoStartWhenUnlocked ||
    isSystemLocked ||
    timerMode.value !== 'paused'
  ) {
    return
  }

  autoResumeHandle = window.setTimeout(() => {
    autoResumeHandle = null
    if (
      settings.value.autoStartWhenUnlocked &&
      !isSystemLocked &&
      timerMode.value === 'paused'
    ) {
      startFocusTimer('暂停已超过 5 分钟，倒计时已自动恢复')
    }
  }, autoResumeAfterPauseMs)
}

function maybeAutoStartWhenUnlocked() {
  if (!mainStateLoaded || !settings.value.autoStartWhenUnlocked || isSystemLocked) return
  if (timerMode.value === 'paused') {
    scheduleAutoResume()
    return
  }
  if (timerMode.value === 'idle') {
    startFocusTimer('电脑处于解锁状态，已自动开始专注倒计时')
  }
}

function startTicker() {
  clearTicker()
  lastTickAt = Date.now()
  tickHandle = window.setInterval(() => {
    const now = Date.now()
    const diff = now - lastTickAt
    lastTickAt = now
    const consumedMs = Math.min(diff, remainingMs.value)
    remainingMs.value = Math.max(0, remainingMs.value - diff)
    queueFocusTime(consumedMs)
    if (remainingMs.value <= 0) {
      beginReset()
    }
  }, 250)
}

function queueFocusTime(ms: number) {
  if (ms <= 0) return
  focusBufferMs += ms
  if (focusBufferMs >= 5_000) {
    void flushFocusStats()
  }
}

async function flushFocusStats() {
  if (isFlushingFocus || focusBufferMs <= 0) return
  isFlushingFocus = true
  const ms = Math.round(focusBufferMs)
  focusBufferMs = 0

  try {
    todayStats.value = await window.bodyReset.addFocusTime(ms)
    void loadStatsTable(false)
  } catch {
    focusBufferMs += ms
  } finally {
    isFlushingFocus = false
    if (focusBufferMs >= 5_000) {
      void flushFocusStats()
    }
  }
}

function runPrimaryAction() {
  if (timerMode.value === 'running') {
    timerMode.value = 'paused'
    clearTicker()
    void flushFocusStats()
    scheduleAutoResume()
    return
  }

  if (remainingMs.value <= 0) {
    remainingMs.value = totalFocusMs.value
  }
  clearAutoResume()
  timerMode.value = 'running'
  startTicker()
}

function resetTimer() {
  clearAutoResume()
  clearTicker()
  void flushFocusStats()
  timerMode.value = 'idle'
  remainingMs.value = totalFocusMs.value
}

async function beginReset() {
  clearTicker()
  await flushFocusStats()
  timerMode.value = 'waiting'
  await window.bodyReset.beginReset()
}

function handleSystemSuspend() {
  if (isResetView || isReminderView) return
  clearAutoResume()
  wasRunningBeforeSuspend = timerMode.value === 'running'
  if (!wasRunningBeforeSuspend) return

  timerMode.value = 'paused'
  clearTicker()
  void flushFocusStats()
  showToast('电脑进入睡眠，倒计时已自动暂停')
}

function handleSystemResume() {
  if (isResetView || isReminderView) return
  const shouldResume = wasRunningBeforeSuspend
  wasRunningBeforeSuspend = false
  if (shouldResume && isSystemLocked) {
    wasRunningBeforeLock = true
    return
  }
  if (shouldResume) {
    timerMode.value = 'running'
    startTicker()
    showToast('电脑已唤醒，倒计时已自动继续')
    return
  }

  maybeAutoStartWhenUnlocked()
}

function handleSystemLock() {
  if (isResetView || isReminderView || isSystemLocked) return
  isSystemLocked = true
  clearAutoResume()
  wasRunningBeforeLock = timerMode.value === 'running'
  if (!wasRunningBeforeLock) return

  timerMode.value = 'paused'
  clearTicker()
  void flushFocusStats()
}

function handleSystemUnlock() {
  if (isResetView || isReminderView) return
  isSystemLocked = false
  if (wasRunningBeforeLock) {
    wasRunningBeforeLock = false
    timerMode.value = 'running'
    startTicker()
    showToast('电脑已解锁，倒计时已自动继续')
    return
  }

  maybeAutoStartWhenUnlocked()
}

async function saveSettings() {
  const snapshot = { ...settings.value }
  const result = await queueSettingsSave(snapshot)
  applyState(result.state)
  showToast('设置已保存')
}

function queueSettingsSave(snapshot: AppSettings) {
  const nextSave = settingsSaveChain.then(() =>
    window.bodyReset.saveSettings({ ...snapshot }),
  )
  settingsSaveChain = nextSave.then(
    () => undefined,
    () => undefined,
  )
  return nextSave
}

async function chooseVideoFolder() {
  const nextState = await window.bodyReset.chooseVideoFolder()
  applyState(nextState)
  showToast('视频文件夹已更新')
}

async function chooseExternalLogFolder() {
  const nextState = await window.bodyReset.chooseExternalLogFolder()
  applyState(nextState)
  showToast('外部日志同步文件夹已更新')
}

async function openInternalLogFolder() {
  await window.bodyReset.openDataFolder()
  showToast('已打开程序内部日志文件夹')
}

async function openExternalLogFolder() {
  const status = await window.bodyReset.openExternalLogFolder()
  externalLogSyncStatus.value = status
  if (!status.configured) {
    showToast('请先选择外部日志同步文件夹')
    return
  }
  showToast('已打开外部日志同步文件夹')
}

async function syncExternalLogs() {
  const status = await window.bodyReset.syncExternalLogs()
  externalLogSyncStatus.value = status
  showToast(status.lastError ? '外部同步失败，内部日志仍已保留' : '外部日志已同步')
}

function queueMediaVolumeSave(key: 'resetVolume' | 'sleepReminderVolume', value: number) {
  pendingMediaVolumeSave = { key, value }
  if (mediaVolumeSaveHandle) {
    window.clearTimeout(mediaVolumeSaveHandle)
  }

  mediaVolumeSaveHandle = window.setTimeout(() => {
    const pending = pendingMediaVolumeSave
    pendingMediaVolumeSave = null
    mediaVolumeSaveHandle = null
    if (!pending) return

    const payloadSettings = resetPayload.value?.settings || reminderPayload.value?.settings
    const baseSettings = payloadSettings || settings.value
    if (payloadSettings) {
      payloadSettings[pending.key] = pending.value
    } else {
      settings.value[pending.key] = pending.value
    }
    void queueSettingsSave({ ...baseSettings, [pending.key]: pending.value })
  }, 250)
}

async function openVideoFolder() {
  const library = await window.bodyReset.openVideoFolder()
  videoCount.value = library.count
  videoFolderPath.value = library.folderPath
  baseVideoFolderPath.value = library.baseFolderPath || library.folderPath
  videoSourceLabel.value = library.sourceLabel || '今日使用：默认 videos 文件夹'
}

async function refreshVideos(showMessage = true) {
  const library = await window.bodyReset.scanVideos()
  videoCount.value = library.count
  videoFolderPath.value = library.folderPath
  baseVideoFolderPath.value = library.baseFolderPath || library.folderPath
  videoSourceLabel.value = library.sourceLabel || '今日使用：默认 videos 文件夹'
  if (showMessage) {
    showToast('视频列表已刷新')
  }
}

async function openSleepReminderFolder() {
  const library = await window.bodyReset.openSleepReminderFolder()
  sleepReminderVideoFolderPath.value = library.folderPath
  sleepReminderVideoCount.value = library.count
  showToast('睡眠提醒视频文件夹已打开')
}

function onFocusMinutesChange() {
  settings.value.focusMinutes = clamp(settings.value.focusMinutes, 1, 240)
  if (timerMode.value === 'idle') {
    remainingMs.value = totalFocusMs.value
  }
  saveSettings()
}

function onResetMinutesChange() {
  settings.value.resetMinutes = clamp(settings.value.resetMinutes, 1, 60)
  saveSettings()
}

function onEarlyResetMinutesChange() {
  settings.value.earlyResetMinutes = clamp(settings.value.earlyResetMinutes, 1, 60)
  void saveSettings()
}

function onEmergencySecondsChange() {
  settings.value.emergencyExitSeconds = clamp(settings.value.emergencyExitSeconds, 3, 20)
  saveSettings()
}

function onSleepReminderIntervalChange() {
  settings.value.sleepReminderInterval = clamp(settings.value.sleepReminderInterval, 5, 240)
  void saveSettings()
}

function clamp(value: number, min: number, max: number) {
  const next = Number.isFinite(value) ? Math.round(value) : min
  return Math.min(max, Math.max(min, next))
}

async function loadResetPayload() {
  resetMediaFailureHandled = false
  clearFallbackTimer()
  resetPayload.value = await window.bodyReset.getResetPayload()
  resetVolume.value = clampVolume(resetPayload.value.settings.resetVolume)
  emergencyLeft.value = resetPayload.value.settings.emergencyExitSeconds

  if (!resetPayload.value.video) {
    clearEarlyResetTimer()
    earlyResetRemainingMs.value = 0
    resetStage.value = 'empty'
    canCompleteReset.value = true
    resetNotice.value = '还没有可播放的视频。'
    return
  }

  resetStage.value = 'playing'
  canCompleteReset.value = false
  startEarlyResetTimer()
  await nextTick()
  const video = videoRef.value
  if (!video) return
  video.volume = resetVolume.value
  video.muted = resetVolume.value <= 0

  try {
    await video.play()
    resetIsPlaying.value = true
  } catch {
    resetStage.value = 'manual-play'
    resetNotice.value = '点击画面开始播放。'
  }
}

function resetStartedAt() {
  return resetPayload.value?.startedAt || Date.now()
}

function updateEarlyResetAvailability() {
  const payload = resetPayload.value
  if (!payload?.video || !payload.settings.earlyResetEnabled) {
    earlyResetRemainingMs.value = 0
    return
  }

  const minimumMs = payload.settings.earlyResetMinutes * 60_000
  const elapsedMs = Math.max(0, Date.now() - resetStartedAt())
  earlyResetRemainingMs.value = Math.max(0, minimumMs - elapsedMs)
  if (earlyResetRemainingMs.value <= 0) {
    canCompleteReset.value = true
    if (resetStage.value !== 'ended') {
      resetNotice.value = '已达到最短复位时间，可以提前回到工作。'
    }
    clearEarlyResetTimer()
  }
}

function startEarlyResetTimer() {
  clearEarlyResetTimer()
  updateEarlyResetAvailability()
  if (
    !resetPayload.value?.video ||
    !resetPayload.value.settings.earlyResetEnabled ||
    earlyResetRemainingMs.value <= 0
  ) {
    return
  }
  earlyResetHandle = window.setInterval(updateEarlyResetAvailability, 250)
}

function clearEarlyResetTimer() {
  if (earlyResetHandle) {
    window.clearInterval(earlyResetHandle)
    earlyResetHandle = null
  }
}

function playResetVideo() {
  const video = videoRef.value
  if (!video) return
  video.volume = resetVolume.value
  video.muted = resetVolume.value <= 0
  video
    .play()
    .then(() => {
      resetStage.value = 'playing'
      resetIsPlaying.value = true
      resetNotice.value = '跟着视频慢慢复位。'
    })
    .catch(() => startFallback())
}

function toggleResetVideo() {
  const video = videoRef.value
  if (!video) return
  if (video.paused) {
    playResetVideo()
    return
  }

  video.pause()
  resetIsPlaying.value = false
  resetNotice.value = '视频已暂停，准备好后继续播放。'
}

function finalizeResetPlayback() {
  clearEarlyResetTimer()
  clearFallbackTimer()
  earlyResetRemainingMs.value = 0
  resetStage.value = 'ended'
  canCompleteReset.value = true
  resetIsPlaying.value = false
  resetNotice.value = '复位完成，可以回到工作。'
}

function onVideoEnded() {
  if (resetStage.value === 'fallback') return
  finalizeResetPlayback()
}

function onVideoError() {
  startFallback()
}

async function loadReminderPayload() {
  reminderPayload.value = await window.bodyReset.getReminderPayload()
  if (reminderPayload.value) {
    reminderVolume.value = clampVolume(reminderPayload.value.settings.sleepReminderVolume)
  }
  if (!reminderPayload.value?.video) return

  await nextTick()
  const video = reminderVideoRef.value
  if (!video) return
  video.volume = reminderVolume.value
  video.muted = reminderVolume.value <= 0
  try {
    await video.play()
    reminderIsPlaying.value = true
  } catch {
    reminderIsPlaying.value = false
  }
}

function toggleReminderVideo() {
  const video = reminderVideoRef.value
  if (!video) return
  if (video.paused) {
    video.play().then(() => {
      reminderIsPlaying.value = true
    }).catch(() => {
      reminderIsPlaying.value = false
    })
    return
  }

  video.pause()
  reminderIsPlaying.value = false
}

function emergencyCloseReminder() {
  void window.bodyReset.emergencyCloseReminder()
}

function onReminderKeyDown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    event.stopPropagation()
    adjustReminderVolume(event.key === 'ArrowUp' ? 1 : -1)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    if (reminderEmergencyHolding.value) return
    reminderEmergencyHolding.value = true
    reminderEmergencyLeft.value = reminderPayload.value?.settings.emergencyExitSeconds || 5
    reminderEmergencyHandle = window.setInterval(() => {
      reminderEmergencyLeft.value -= 1
      if (reminderEmergencyLeft.value <= 0) {
        clearReminderEmergencyHold()
        emergencyCloseReminder()
      }
    }, 1000)
    return
  }

  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    toggleReminderVideo()
  }
}

function onReminderKeyUp(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    clearReminderEmergencyHold()
  }
}

function clearReminderEmergencyHold() {
  reminderEmergencyHolding.value = false
  if (reminderEmergencyHandle) {
    window.clearInterval(reminderEmergencyHandle)
    reminderEmergencyHandle = null
  }
}

function stopResetVideoSource() {
  const video = videoRef.value
  if (!video) return
  video.pause()
  video.removeAttribute('autoplay')
  video.removeAttribute('src')
  video.load()
  resetIsPlaying.value = false
}

function clearFallbackTimer() {
  if (fallbackHandle) {
    window.clearInterval(fallbackHandle)
    fallbackHandle = null
  }
}

function startFallback() {
  if (
    resetMediaFailureHandled ||
    resetStage.value === 'fallback' ||
    resetStage.value === 'ended' ||
    resetStage.value === 'empty'
  ) {
    return
  }
  resetMediaFailureHandled = true
  stopResetVideoSource()
  resetStage.value = 'fallback'
  updateEarlyResetAvailability()
  if (earlyResetRemainingMs.value > 0) {
    canCompleteReset.value = false
  }
  fallbackRemaining.value = Math.max(15, (resetPayload.value?.settings.resetMinutes || 1) * 60)
  resetNotice.value = '视频无法播放，等待结束后可返回。'
  clearFallbackTimer()
  fallbackHandle = window.setInterval(() => {
    fallbackRemaining.value -= 1
    if (fallbackRemaining.value <= 0) {
      clearFallbackTimer()
      finalizeResetPlayback()
    }
  }, 1000)
}

async function completeReset() {
  if (!canCompleteReset.value) return
  const result = await window.bodyReset.completeReset({
    videoName: resetPayload.value?.video?.name || '',
    videoEnded: resetStage.value === 'ended' || resetStage.value === 'empty',
  })
  if (!result.completed && result.reason === 'not-ready') {
    updateEarlyResetAvailability()
    showToast('还没有达到可返回的复位时长')
  }
}

function adjustResetVolume(direction: 1 | -1) {
  const video = videoRef.value
  if (!video) return

  const currentVolume = video.muted ? resetVolume.value : video.volume
  const nextVolume = clampVolume(currentVolume + direction * 0.1)
  video.volume = nextVolume
  video.muted = nextVolume <= 0
  resetVolume.value = nextVolume
  queueMediaVolumeSave('resetVolume', nextVolume)
}

function adjustReminderVolume(direction: 1 | -1) {
  const video = reminderVideoRef.value
  if (!video) return

  const currentVolume = video.muted ? reminderVolume.value : video.volume
  const nextVolume = clampVolume(currentVolume + direction * 0.1)
  video.volume = nextVolume
  video.muted = nextVolume <= 0
  reminderVolume.value = nextVolume
  queueMediaVolumeSave('sleepReminderVolume', nextVolume)
}

function clampVolume(value: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return 1
  return Math.min(1, Math.max(0, Math.round(next * 10) / 10))
}

function onResetKeyDown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    event.stopPropagation()
    adjustResetVolume(event.key === 'ArrowUp' ? 1 : -1)
    return
  }

  if (event.key !== 'Escape' || emergencyHolding.value) return
  event.preventDefault()
  emergencyHolding.value = true
  emergencyLeft.value = resetPayload.value?.settings.emergencyExitSeconds || 5
  emergencyHandle = window.setInterval(async () => {
    emergencyLeft.value -= 1
    if (emergencyLeft.value <= 0) {
      clearEmergencyHold()
      await window.bodyReset.emergencyCloseReset()
    }
  }, 1000)
}

function onResetKeyUp(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    clearEmergencyHold()
  }
}

function clearEmergencyHold() {
  emergencyHolding.value = false
  if (emergencyHandle) {
    window.clearInterval(emergencyHandle)
    emergencyHandle = null
  }
}

watch(
  () => settings.value.autoStart,
  async (enabled) => {
    await window.bodyReset.setAutoStart(enabled)
  },
)

watch(
  () => settings.value.autoStartWhenUnlocked,
  (enabled) => {
    if (!mainStateLoaded) return
    if (!enabled) {
      clearAutoResume()
      return
    }
    maybeAutoStartWhenUnlocked()
  },
)

onMounted(() => {
  if (isReminderView) {
    loadReminderPayload()
    document.addEventListener('keydown', onReminderKeyDown, true)
    document.addEventListener('keyup', onReminderKeyUp, true)
    return
  }

  if (isResetView) {
    loadResetPayload()
    document.addEventListener('keydown', onResetKeyDown, true)
    document.addEventListener('keyup', onResetKeyUp, true)
    return
  }

  loadMainState()
  removeSuspendListener = window.bodyReset.onSystemSuspend(handleSystemSuspend)
  removeResumeListener = window.bodyReset.onSystemResume(handleSystemResume)
  removeLockListener = window.bodyReset.onSystemLock(handleSystemLock)
  removeUnlockListener = window.bodyReset.onSystemUnlock(handleSystemUnlock)
  removeResetListener = window.bodyReset.onResetCompleted((payload) => {
    remainingMs.value = totalFocusMs.value
    if (payload.todayStats) {
      todayStats.value = payload.todayStats
    }
    if (payload.completed) {
      timerMode.value = 'running'
      lastReset.value = '复位完成，已开始下一轮专注'
      startTicker()
    } else {
      timerMode.value = 'idle'
      lastReset.value = '上次复位已紧急退出'
    }
    void loadStatsTable(false)
    void refreshVideos(false)
  })
})

onBeforeUnmount(() => {
  clearTicker()
  void flushFocusStats()
  if (mediaVolumeSaveHandle) {
    window.clearTimeout(mediaVolumeSaveHandle)
    mediaVolumeSaveHandle = null
  }
  if (pendingMediaVolumeSave) {
    const pending = pendingMediaVolumeSave
    pendingMediaVolumeSave = null
    const payloadSettings = resetPayload.value?.settings || reminderPayload.value?.settings
    const baseSettings = payloadSettings || settings.value
    void queueSettingsSave({ ...baseSettings, [pending.key]: pending.value })
  }
  clearEmergencyHold()
  clearFallbackTimer()
  if (toastHandle) window.clearTimeout(toastHandle)
  if (removeResetListener) removeResetListener()
  if (removeSuspendListener) removeSuspendListener()
  if (removeResumeListener) removeResumeListener()
  if (removeLockListener) removeLockListener()
  if (removeUnlockListener) removeUnlockListener()
  clearAutoResume()
  clearEarlyResetTimer()
  document.removeEventListener('keydown', onResetKeyDown, true)
  document.removeEventListener('keyup', onResetKeyUp, true)
  document.removeEventListener('keydown', onReminderKeyDown, true)
  document.removeEventListener('keyup', onReminderKeyUp, true)
  clearReminderEmergencyHold()
})
</script>

<template>
  <main v-if="!isResetView && !isReminderView" class="app-shell">
    <section class="focus-surface" aria-label="专注计时">
      <div class="topbar">
        <div class="brand-block">
        <span class="brand-mark">复</span>
          <div>
            <p class="caption">身体复位提醒器</p>
            <h1>先专注，到点复位身体</h1>
          </div>
        </div>
        <button class="icon-button" type="button" title="设置" @click="isSettingsOpen = !isSettingsOpen">
          <Settings :size="20" />
        </button>
      </div>

      <div class="main-grid">
        <section class="timer-panel">
          <div class="status-line">
            <span>{{ statusTitle }}</span>
            <small>{{ statusBody }}</small>
          </div>

          <div class="time-stage" :style="{ '--focus': `${focusPercent}%` }">
            <div class="breath-field" aria-hidden="true"></div>
            <p class="time-readout">{{ timeText }}</p>
            <p class="focus-copy">专注时长 {{ settings.focusMinutes }} 分钟</p>
          </div>

          <div class="primary-actions">
            <button class="primary-button" type="button" @click="runPrimaryAction">
              <component :is="primaryActionIcon" :size="20" />
              <span>{{ primaryActionText }}</span>
            </button>
            <button class="ghost-button" type="button" @click="resetTimer">
              <RotateCcw :size="19" />
              <span>重置</span>
            </button>
            <button class="ghost-button strong" type="button" @click="beginReset">
              <TimerReset :size="19" />
              <span>立即复位</span>
            </button>
          </div>

          <p v-if="lastReset" class="subtle-note">{{ lastReset }}</p>
        </section>

        <aside class="side-panel" aria-label="视频和设置">
          <div class="rhythm-card">
            <div class="panel-heading">
              <Activity :size="20" />
              <div>
                <h2>今日节奏</h2>
                <p>{{ todayStats.date || '今天' }}</p>
              </div>
            </div>

            <div class="rhythm-meter" aria-hidden="true">
              <span class="work" :style="{ flexGrow: rhythmWorkFlex }"></span>
              <span class="reset" :style="{ flexGrow: rhythmResetFlex }"></span>
            </div>

            <div class="rhythm-stats">
              <div class="stat-pill work">
                <span>今日工作</span>
                <strong>{{ todayFocusText }}</strong>
              </div>
              <div class="stat-pill reset">
                <span>运动休息</span>
                <strong>{{ todayResetCountText }}</strong>
              </div>
              <div class="stat-pill rest-time">
                <span>复位总时长</span>
                <strong>{{ todayResetText }}</strong>
              </div>
            </div>

            <div class="rest-frequency" aria-label="今日运动休息频次">
              <span
                v-for="(active, index) in resetDots"
                :key="index"
                :class="{ active }"
              ></span>
              <em v-if="extraResetCount">+{{ extraResetCount }}</em>
            </div>
          </div>

          <div class="ledger-card">
            <div class="panel-heading ledger-heading">
              <CalendarDays :size="20" />
              <div>
                <h2>身体账本</h2>
                <p>{{ statsRangeText }}</p>
              </div>
            </div>

            <div class="period-switch" aria-label="数据表周期">
              <button
                type="button"
                :class="{ active: statsPeriod === 'week' }"
                @click="setStatsPeriod('week')"
              >
                本周
              </button>
              <button
                type="button"
                :class="{ active: statsPeriod === 'month' }"
                @click="setStatsPeriod('month')"
              >
                本月
              </button>
            </div>

            <div class="ledger-summary">
              <div>
                <span>工作</span>
                <strong>{{ statsTotalFocusText }}</strong>
              </div>
              <div>
                <span>复位</span>
                <strong>{{ statsTotalResetText }}</strong>
              </div>
              <div>
                <span>完成</span>
                <strong>{{ statsCompletedText }}</strong>
              </div>
              <div>
                <span>完成率</span>
                <strong>{{ statsCompletionText }}</strong>
              </div>
            </div>

            <div class="ledger-table-wrap">
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>工作</th>
                    <th>复位</th>
                    <th>时长</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="day in statsRows" :key="day.date">
                    <td>
                      <strong>{{ formatShortDate(day.date) }}</strong>
                      <span>{{ day.weekday }}</span>
                    </td>
                    <td>{{ formatCompactDuration(day.focusMs) }}</td>
                    <td class="reset-cell">
                      <strong>{{ day.completedResetCount }}/{{ day.resetCount }}</strong>
                      <span>{{ getCompletionText(day) }}</span>
                    </td>
                    <td>{{ formatCompactDuration(day.resetMs) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="video-card">
            <div class="panel-heading">
              <Video :size="20" />
              <div>
                <h2>复位视频</h2>
                <p>{{ videoCount }} 个视频可用</p>
              </div>
            </div>
            <p class="video-source">{{ videoSourceLabel }}</p>
            <p class="folder-path">{{ videoFolderPath || '正在准备视频文件夹' }}</p>
            <div class="inline-actions">
              <button class="secondary-button" type="button" @click="openVideoFolder">
                <FolderOpen :size="18" />
                <span>打开总文件夹</span>
              </button>
              <button class="plain-button" type="button" @click="refreshVideos()">刷新</button>
            </div>
          </div>

          <div v-if="videoCount === 0" class="empty-video">
            <CircleAlert :size="18" />
            <p>当前规则文件夹里还没有可用视频。可以把视频放进上面的文件夹，或在总文件夹里建立“周一到周五”“周末”等文件夹。</p>
          </div>

          <section class="settings-panel" :class="{ open: isSettingsOpen }" aria-label="设置">
            <div class="settings-head">
              <h2>设置</h2>
              <button class="icon-button small" type="button" title="关闭设置" @click="isSettingsOpen = false">
                <X :size="18" />
              </button>
            </div>

            <label class="setting-row">
              <span>专注时长</span>
              <input
                v-model.number="settings.focusMinutes"
                type="number"
                min="1"
                max="240"
                @change="onFocusMinutesChange"
              />
              <small>分钟</small>
            </label>

            <label class="setting-row">
              <span class="setting-copy">
                <strong>视频异常等待</strong>
                <em>视频打不开时，等待后可返回</em>
              </span>
              <input
                v-model.number="settings.resetMinutes"
                type="number"
                min="1"
                max="60"
                @change="onResetMinutesChange"
              />
              <small>分钟</small>
            </label>

            <button class="wide-button" type="button" @click="chooseVideoFolder">
              <FolderOpen :size="18" />
              <span>更换视频文件夹</span>
            </button>

            <div class="rule-card">
              <strong>按星期自动选视频</strong>
              <span>在总文件夹里建“周一到周五”和“周末”，或建“周一”“周二”等每天专属文件夹。当天专属优先。</span>
              <em>{{ baseVideoFolderPath || '正在准备总文件夹' }}</em>
            </div>

            <label class="toggle-row">
              <span>
                <strong>严格模式</strong>
                <small>复位窗口不允许直接关闭</small>
              </span>
              <input v-model="settings.strictMode" type="checkbox" @change="saveSettings" />
            </label>

            <label class="toggle-row">
              <span>
                <strong>允许提前结束普通复位</strong>
                <small>达到设定时长后即可回到工作，不必等视频结束</small>
              </span>
              <input v-model="settings.earlyResetEnabled" type="checkbox" @change="saveSettings" />
            </label>

            <div class="setting-group" :class="{ disabled: !settings.earlyResetEnabled }">
              <label class="setting-row">
                <span>最短复位时长</span>
                <input
                  v-model.number="settings.earlyResetMinutes"
                  type="number"
                  min="1"
                  max="60"
                  @change="onEarlyResetMinutesChange"
                />
                <small>分钟</small>
              </label>
              <p class="setting-help">例如设置为 3 分钟，普通复位开始 3 分钟后就可以提前返回。</p>
            </div>

            <label class="toggle-row">
              <span>
                <strong>睡眠提醒</strong>
                <small>在设定时段内，电脑仍在使用时全屏提醒</small>
              </span>
              <input v-model="settings.sleepReminderEnabled" type="checkbox" @change="saveSettings" />
            </label>

            <div class="setting-group" :class="{ disabled: !settings.sleepReminderEnabled }">
              <div class="setting-group-title">睡眠提醒时段</div>
              <div class="time-range-row">
                <label class="setting-row compact">
                  <span>从</span>
                  <input v-model="settings.sleepReminderStart" type="time" @change="saveSettings" />
                </label>
                <label class="setting-row compact">
                  <span>到</span>
                  <input v-model="settings.sleepReminderEnd" type="time" @change="saveSettings" />
                </label>
              </div>
              <label class="setting-row">
                <span>提醒间隔</span>
                <input
                  v-model.number="settings.sleepReminderInterval"
                  type="number"
                  min="5"
                  max="240"
                  @change="onSleepReminderIntervalChange"
                />
                <small>分钟</small>
              </label>
              <button class="wide-button" type="button" @click="openSleepReminderFolder">
                <FolderOpen :size="18" />
                <span>打开睡眠提醒视频（{{ sleepReminderVideoCount }} 个）</span>
              </button>
              <p class="folder-path compact-path">
                {{ sleepReminderVideoFolderPath || settings.sleepReminderFolder }}
              </p>
            </div>

            <label class="toggle-row">
              <span>
                <strong>最小化到托盘</strong>
                <small>关闭窗口时留在后台</small>
              </span>
              <input v-model="settings.minimizeToTray" type="checkbox" @change="saveSettings" />
            </label>

            <label class="toggle-row">
              <span>
                <strong>开机启动</strong>
                <small>跟随系统自动打开</small>
              </span>
              <input v-model="settings.autoStart" type="checkbox" @change="saveSettings" />
            </label>

            <label class="toggle-row">
              <span>
                <strong>解锁后自动开始</strong>
                <small>电脑保持解锁时自动开始；手动暂停 5 分钟后会自动恢复</small>
              </span>
              <input v-model="settings.autoStartWhenUnlocked" type="checkbox" @change="saveSettings" />
            </label>

            <div class="setting-group external-log-group">
              <div class="setting-group-title">外部日志同步（可选）</div>
              <p class="setting-help">
                程序始终把完整日志保存在自己的 data 文件夹。开启后，再复制一份到你选择的文件夹；别人可以保持关闭。
              </p>
              <label class="toggle-row">
                <span>
                  <strong>启用外部同步</strong>
                  <small>适合个人复盘或备份</small>
                </span>
                <input v-model="settings.externalLogSyncEnabled" type="checkbox" @change="saveSettings" />
              </label>
              <button class="wide-button" type="button" @click="chooseExternalLogFolder">
                <FolderOpen :size="18" />
                <span>选择外部同步文件夹</span>
              </button>
              <p class="folder-path compact-path">
                {{ settings.externalLogSyncFolder || '尚未选择外部文件夹' }}
              </p>
              <p class="sync-status" :class="{ error: externalLogSyncStatus.lastError }">
                {{ externalLogSyncStatusText }}
              </p>
              <div class="inline-actions">
                <button class="secondary-button" type="button" @click="syncExternalLogs">
                  立即同步
                </button>
                <button class="plain-button" type="button" @click="openInternalLogFolder">
                  内部日志
                </button>
              </div>
              <button class="wide-button" type="button" @click="openExternalLogFolder">
                打开外部同步文件夹
              </button>
            </div>

            <label class="setting-row">
              <span>紧急退出</span>
              <input
                v-model.number="settings.emergencyExitSeconds"
                type="number"
                min="3"
                max="20"
                @change="onEmergencySecondsChange"
              />
              <small>秒</small>
            </label>
          </section>
        </aside>
      </div>
    </section>

    <p v-if="toast" class="toast">{{ toast }}</p>
  </main>

  <main v-else-if="isResetView" class="reset-shell" :class="resetStage">
    <video
      v-if="resetPayload?.video"
      ref="videoRef"
      class="reset-video"
      :src="resetPayload.video.url"
      :autoplay="resetStage === 'playing'"
      playsinline
      @click="toggleResetVideo"
      @play="resetIsPlaying = true"
      @pause="resetIsPlaying = false"
      @ended="onVideoEnded"
      @error="onVideoError"
    ></video>

    <section v-if="resetStage === 'empty'" class="empty-reset">
      <div class="empty-reset-inner">
        <ShieldCheck :size="30" />
        <h1>还没有复位视频</h1>
        <p>把 mp4、mov、wmv、avi、mkv 或 m4v 放进视频文件夹。</p>
        <div class="reset-actions">
          <button class="secondary-button light" type="button" @click="openVideoFolder">
            <FolderOpen :size="18" />
            <span>打开文件夹</span>
          </button>
          <button class="primary-button light" type="button" @click="completeReset">
            <Check :size="18" />
            <span>返回工作</span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="resetStage === 'fallback'" class="fallback-reset">
      <p>视频无法播放</p>
      <h1>{{ formatTime(fallbackRemaining * 1000) }}</h1>
      <span>等待结束后可返回</span>
    </section>

    <button v-if="resetStage === 'manual-play'" class="play-overlay" type="button" @click="playResetVideo">
      <Play :size="28" />
      <span>开始播放</span>
    </button>

    <div v-if="resetStage !== 'empty'" class="reset-chrome">
      <div class="reset-copy">
        <p>{{ resetNotice }}</p>
        <strong v-if="resetVideoName">{{ resetVideoName }}</strong>
        <small v-if="resetPayload?.settings.earlyResetEnabled && !canCompleteReset">
          达到 {{ resetPayload.settings.earlyResetMinutes }} 分钟后可提前返回工作
        </small>
      </div>

      <button class="complete-button" type="button" :disabled="!canCompleteReset" @click="completeReset">
        <Check :size="18" />
        <span>{{ resetButtonText }}</span>
      </button>
      <div v-if="resetPayload?.video && resetStage !== 'fallback'" class="reset-media-controls">
        <button class="video-toggle-button" type="button" @click="toggleResetVideo">
          <Pause v-if="resetIsPlaying" :size="16" />
          <Play v-else :size="16" />
          <span>{{ resetIsPlaying ? '暂停视频' : '继续播放' }}</span>
        </button>
        <div class="volume-controls" aria-label="普通复位视频音量">
          <button type="button" title="降低音量" @click="adjustResetVolume(-1)">−</button>
          <span>音量 {{ resetVolumeText }}</span>
          <button type="button" title="提高音量" @click="adjustResetVolume(1)">+</button>
        </div>
      </div>
    </div>
  </main>

  <main v-else class="reminder-shell">
    <video
      v-if="reminderPayload?.video"
      ref="reminderVideoRef"
      class="reminder-video"
      :src="reminderPayload.video.url"
      autoplay
      playsinline
      loop
      @click="toggleReminderVideo"
      @play="reminderIsPlaying = true"
      @pause="reminderIsPlaying = false"
    ></video>

    <div class="reminder-overlay">
      <div class="reminder-copy">
        <span class="reminder-kicker">睡眠提醒</span>
        <h1>该睡觉了，先把身体放回去。</h1>
        <p>视频会循环播放，只有长按 Esc 才能紧急退出。退出后 5 分钟，如果电脑仍在使用，会再次提醒。</p>
      </div>
      <div class="reminder-actions">
        <div class="reminder-media-controls">
          <button class="reminder-play-button" type="button" @click="toggleReminderVideo">
            <Pause v-if="reminderIsPlaying" :size="18" />
            <Play v-else :size="18" />
            <span>{{ reminderIsPlaying ? '暂停视频' : '继续播放' }}</span>
          </button>
          <div class="volume-controls" aria-label="睡眠提醒视频音量">
            <button type="button" title="降低音量" @click="adjustReminderVolume(-1)">−</button>
            <span>音量 {{ reminderVolumeText }}</span>
            <button type="button" title="提高音量" @click="adjustReminderVolume(1)">+</button>
          </div>
        </div>
        <div class="reminder-emergency-note">
          <span v-if="reminderEmergencyHolding">继续按住 Esc：{{ reminderEmergencyLeft }} 秒</span>
          <span v-else>必须离开时长按 Esc 紧急退出</span>
        </div>
      </div>
    </div>
  </main>
</template>
