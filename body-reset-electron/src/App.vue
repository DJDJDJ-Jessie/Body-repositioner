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
  videoFolder: string
  strictMode: boolean
  minimizeToTray: boolean
  autoStart: boolean
  emergencyExitSeconds: number
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
  todayStats: TodayStats
  shouldAutoStartTimer: boolean
}

type ResetPayload = {
  id: number
  startedAt?: number
  video: VideoItem | null
  settings: AppSettings
  canClose: boolean
}

const fallbackSettings: AppSettings = {
  focusMinutes: 50,
  resetMinutes: 6,
  videoFolder: 'videos',
  strictMode: true,
  minimizeToTray: true,
  autoStart: false,
  emergencyExitSeconds: 5,
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

const settings = ref<AppSettings>({ ...fallbackSettings })
const remainingMs = ref(fallbackSettings.focusMinutes * 60_000)
const timerMode = ref<'idle' | 'running' | 'paused' | 'waiting'>('idle')
const videoCount = ref(0)
const videoFolderPath = ref('')
const baseVideoFolderPath = ref('')
const videoSourceLabel = ref('')
const todayStats = ref<TodayStats>({ ...fallbackTodayStats })
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
const resetNotice = ref('身体先回来，工作等一下。')

let tickHandle: number | null = null
let lastTickAt = 0
let toastHandle: number | null = null
let fallbackHandle: number | null = null
let emergencyHandle: number | null = null
let removeResetListener: (() => void) | null = null
let focusBufferMs = 0
let isFlushingFocus = false
let autoStartChecked = false

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
const resetButtonText = computed(() => {
  if (resetStage.value === 'ended') return '完成，回到工作'
  if (resetStage.value === 'empty') return '我已知道'
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

function formatTime(ms: number) {
  const safeMs = Math.max(0, ms)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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
  todayStats.value = { ...fallbackTodayStats, ...nextState.todayStats }
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
    return
  }

  if (remainingMs.value <= 0) {
    remainingMs.value = totalFocusMs.value
  }
  timerMode.value = 'running'
  startTicker()
}

function resetTimer() {
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

async function saveSettings() {
  const result = await window.bodyReset.saveSettings(settings.value)
  applyState(result.state)
  showToast('设置已保存')
}

async function chooseVideoFolder() {
  const nextState = await window.bodyReset.chooseVideoFolder()
  applyState(nextState)
  showToast('视频文件夹已更新')
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

function onEmergencySecondsChange() {
  settings.value.emergencyExitSeconds = clamp(settings.value.emergencyExitSeconds, 3, 20)
  saveSettings()
}

function clamp(value: number, min: number, max: number) {
  const next = Number.isFinite(value) ? Math.round(value) : min
  return Math.min(max, Math.max(min, next))
}

async function loadResetPayload() {
  resetPayload.value = await window.bodyReset.getResetPayload()
  emergencyLeft.value = resetPayload.value.settings.emergencyExitSeconds

  if (!resetPayload.value.video) {
    resetStage.value = 'empty'
    canCompleteReset.value = true
    resetNotice.value = '还没有可播放的视频。'
    return
  }

  resetStage.value = 'playing'
  canCompleteReset.value = false
  await nextTick()
  const video = videoRef.value
  if (!video) return
  video.volume = resetVolume.value

  try {
    await video.play()
  } catch {
    resetStage.value = 'manual-play'
    resetNotice.value = '点击画面开始播放。'
  }
}

function playResetVideo() {
  const video = videoRef.value
  if (!video) return
  video.volume = resetVolume.value
  video
    .play()
    .then(() => {
      resetStage.value = 'playing'
      resetNotice.value = '跟着视频慢慢复位。'
    })
    .catch(() => startFallback())
}

function onVideoEnded() {
  resetStage.value = 'ended'
  canCompleteReset.value = true
  resetNotice.value = '复位完成，可以回到工作。'
}

function onVideoError() {
  startFallback()
}

function startFallback() {
  resetStage.value = 'fallback'
  canCompleteReset.value = false
  fallbackRemaining.value = Math.max(15, (resetPayload.value?.settings.resetMinutes || 1) * 60)
  resetNotice.value = '视频无法播放，等待结束后可返回。'
  if (fallbackHandle) window.clearInterval(fallbackHandle)
  fallbackHandle = window.setInterval(() => {
    fallbackRemaining.value -= 1
    if (fallbackRemaining.value <= 0) {
      if (fallbackHandle) window.clearInterval(fallbackHandle)
      fallbackHandle = null
      onVideoEnded()
    }
  }, 1000)
}

async function completeReset() {
  if (!canCompleteReset.value) return
  await window.bodyReset.completeReset({
    videoName: resetPayload.value?.video?.name || '',
  })
}

function adjustResetVolume(direction: 1 | -1) {
  const video = videoRef.value
  if (!video) return

  const nextVolume = clampVolume(video.volume + direction * 0.1)
  video.volume = nextVolume
  video.muted = nextVolume === 0
  resetVolume.value = nextVolume
}

function clampVolume(value: number) {
  return Math.min(1, Math.max(0, Math.round(value * 10) / 10))
}

function onResetKeyDown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    adjustResetVolume(event.key === 'ArrowUp' ? 1 : -1)
    return
  }

  if (event.key !== 'Escape' || emergencyHolding.value) return
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

onMounted(() => {
  if (isResetView) {
    loadResetPayload()
    window.addEventListener('keydown', onResetKeyDown)
    window.addEventListener('keyup', onResetKeyUp)
    return
  }

  loadMainState()
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
  clearEmergencyHold()
  if (fallbackHandle) window.clearInterval(fallbackHandle)
  if (toastHandle) window.clearTimeout(toastHandle)
  if (removeResetListener) removeResetListener()
  window.removeEventListener('keydown', onResetKeyDown)
  window.removeEventListener('keyup', onResetKeyUp)
})
</script>

<template>
  <main v-if="!isResetView" class="app-shell">
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
                <small>视频结束前不能完成</small>
              </span>
              <input v-model="settings.strictMode" type="checkbox" @change="saveSettings" />
            </label>

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

  <main v-else class="reset-shell" :class="resetStage">
    <video
      v-if="resetPayload?.video"
      ref="videoRef"
      class="reset-video"
      :src="resetPayload.video.url"
      autoplay
      playsinline
      @click="playResetVideo"
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
      </div>

      <button class="complete-button" type="button" :disabled="!canCompleteReset" @click="completeReset">
        <Check :size="18" />
        <span>{{ resetButtonText }}</span>
      </button>
    </div>
  </main>
</template>
