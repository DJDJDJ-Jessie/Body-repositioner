const screen = document.querySelector('#screen')
const modalRoot = document.querySelector('#modal-root')
const toast = document.querySelector('#toast')
const videoInput = document.querySelector('#video-input')
const settingsButton = document.querySelector('#settings-button')
const STORAGE_KEY = 'body-reset-mobile-state-v1'

const library = [
  {
    id: 'neck',
    title: '颈肩松开',
    description: '把头从屏幕前拿回来，给肩颈一点空间。',
    duration: 6,
    tag: '肩颈 / 坐姿',
    icon: '↗',
    accent: '#f37c58',
    steps: ['落肩', '开胸', '颈侧'],
  },
  {
    id: 'spine',
    title: '背部开窗',
    description: '从胸椎到腰背，恢复一条能呼吸的背。',
    duration: 4,
    tag: '背部 / 呼吸',
    icon: '◌',
    accent: '#e3b46d',
    steps: ['呼吸', '旋转', '伸展'],
  },
  {
    id: 'sleep',
    title: '睡前卸载',
    description: '把今天的紧绷交还给地面，再去睡觉。',
    duration: 8,
    tag: '睡前 / 放松',
    icon: '☾',
    accent: '#8db8a2',
    steps: ['放下', '松开', '安静'],
  },
]

const initialState = {
  view: 'today',
  settings: {
    focusMinutes: 50,
    notifications: false,
  },
  focus: {
    mode: 'idle',
    remainingMs: 50 * 60 * 1000,
    totalMs: 50 * 60 * 1000,
  },
  history: [],
}

let state = loadState()
let activeView = state.view || 'today'
let resetSession = null
let resetTimerHandle = null
let focusTimerHandle = null
let toastHandle = null
let customVideos = []

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(initialState)
    const parsed = JSON.parse(raw)
    return {
      ...structuredClone(initialState),
      ...parsed,
      settings: { ...initialState.settings, ...(parsed.settings || {}) },
      focus: { ...initialState.focus, ...(parsed.focus || {}) },
      history: Array.isArray(parsed.history) ? parsed.history : [],
    }
  } catch {
    return structuredClone(initialState)
  }
}

function saveState() {
  state.view = activeView
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function todayKey() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return date.getFullYear() + '-' + month + '-' + day
}

function dateLabel(key) {
  if (!key) return ''
  const parts = key.split('-')
  return parts.length === 3 ? parts[1] + '/' + parts[2] : key
}

function weekdayLabel(key) {
  const date = new Date(key + 'T12:00:00')
  return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
}

function formatMinutes(minutes) {
  const safe = Math.max(0, Math.round(minutes || 0))
  if (safe < 60) return safe + ' 分钟'
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  return rest ? hours + ' 小时 ' + rest + ' 分钟' : hours + ' 小时'
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 19) return '下午好'
  return '晚上好'
}

function currentRecord() {
  const key = todayKey()
  let record = state.history.find((item) => item.date === key)
  if (!record) {
    record = { date: key, focusMinutes: 0, resetMinutes: 0, completedResets: 0 }
    state.history.push(record)
  }
  return record
}

function allStats() {
  return state.history.reduce(
    (total, item) => ({
      focusMinutes: total.focusMinutes + (item.focusMinutes || 0),
      resetMinutes: total.resetMinutes + (item.resetMinutes || 0),
      completedResets: total.completedResets + (item.completedResets || 0),
    }),
    { focusMinutes: 0, resetMinutes: 0, completedResets: 0 },
  )
}

function render() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === activeView)
  })
  if (activeView === 'reset') renderLibrary()
  else if (activeView === 'ledger') renderLedger()
  else renderToday()
}

function renderToday() {
  const record = currentRecord()
  const focus = state.focus
  const progress = focus.totalMs ? ((focus.totalMs - focus.remainingMs) / focus.totalMs) * 360 : 0
  const resetRatio = record.focusMinutes ? Math.min(1, record.resetMinutes / Math.max(1, record.focusMinutes * 0.18)) : 0
  const focusStatus = focus.mode === 'running' ? '专注进行中' : focus.mode === 'paused' ? '已暂停' : '准备开始'
  const focusButton = focus.mode === 'running' ? '暂停专注' : focus.mode === 'paused' ? '继续专注' : '开始专注'
  const focusCaption = focus.mode === 'running' ? '到点后进入一次身体复位' : '先让注意力落在一件事上'

  screen.innerHTML =
    '<div class="topline">' +
      '<div><p>' + greeting() + '，今天也先照顾一下身体。</p><strong>' + dateLabel(todayKey()) + ' · 周' + weekdayLabel(todayKey()) + '</strong></div>' +
      '<span class="soft-badge">本地保存</span>' +
    '</div>' +
    '<section class="hero-card">' +
      '<p class="hero-overline">01 / FOCUS → RESET</p>' +
      '<h2 class="hero-title">把身体带回<br />工作现场。</h2>' +
      '<p class="hero-note">每一次专注之后，都留一小段时间给肩颈、背部和呼吸。</p>' +
      '<div class="pulse-orb"><span>呼吸灯</span></div>' +
      '<div class="focus-stage">' +
        '<div class="focus-ring" style="--progress:' + progress + 'deg">' +
          '<span class="focus-time">' + formatTime(focus.remainingMs) + '</span>' +
        '</div>' +
        '<span class="focus-status">' + focusStatus + '</span>' +
      '</div>' +
      '<div class="hero-actions">' +
        '<button class="button button-primary" data-action="focus-toggle">' + focusButton + '</button>' +
        '<button class="button button-quiet" data-action="immediate-reset">立即复位</button>' +
      '</div>' +
      '<p class="mini-caption">' + focusCaption + ' · ' + state.settings.focusMinutes + ' 分钟一轮</p>' +
    '</section>' +
    '<div class="section-heading"><div><p class="section-kicker">TODAY / RHYTHM</p><h2>今天的节奏</h2></div><button class="text-button" data-view="ledger">查看账本 →</button></div>' +
    '<section class="rhythm-card">' +
      '<div class="rhythm-meta"><span>专注 ' + formatMinutes(record.focusMinutes) + '</span><span>复位 ' + formatMinutes(record.resetMinutes) + '</span></div>' +
      '<div class="rhythm-track"><span class="work" style="flex:' + Math.max(1, record.focusMinutes) + '"></span><span class="reset" style="flex:' + Math.max(0.18, record.resetMinutes) + '"></span><span class="empty" style="flex:' + Math.max(0.18, 1 - resetRatio) + '"></span></div>' +
      '<div class="rhythm-meta"><span>工作时不忘身体</span><strong>' + record.completedResets + ' 次完成复位</strong></div>' +
    '</section>' +
    '<div class="section-heading"><div><p class="section-kicker">SMALL SIGNALS</p><h2>今日信号</h2></div></div>' +
    '<section class="stats-grid">' +
      '<article class="stat-card"><span>专注时间</span><strong>' + formatMinutes(record.focusMinutes) + '</strong></article>' +
      '<article class="stat-card"><span>复位次数</span><strong>' + record.completedResets + ' 次</strong></article>' +
      '<article class="stat-card"><span>复位总长</span><strong>' + formatMinutes(record.resetMinutes) + '</strong></article>' +
    '</section>' +
    '<div class="section-heading"><div><p class="section-kicker">ONE GOOD NEXT STEP</p><h2>现在就做什么</h2></div></div>' +
    '<button class="library-card" data-action="start-reset" data-reset-id="neck" style="--accent:#f37c58">' +
      '<span class="library-visual">↗</span><span class="library-copy"><span class="card-label">6 分钟 · 肩颈 / 坐姿</span><h3>让肩膀先下来</h3><p>不用换衣服，站起来就能开始。</p></span><span class="duration-badge">开始</span>' +
    '</button>'
}

function renderLibrary() {
  const cards = [...library, ...customVideos]
    .map((item) =>
      '<button class="library-card" data-action="start-reset" data-reset-id="' + escapeHtml(item.id) + '" style="--accent:' + escapeHtml(item.accent || '#a7d2bc') + '">' +
        '<span class="library-visual">' + escapeHtml(item.icon || '◌') + '</span>' +
        '<span class="library-copy"><span class="card-label">' + escapeHtml(item.duration) + ' 分钟 · ' + escapeHtml(item.tag || '我的视频') + '</span><h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.description || '把你自己的复位方式放进来。') + '</p></span>' +
        '<span class="duration-badge">开始</span>' +
      '</button>',
    )
    .join('')

  screen.innerHTML =
    '<div class="topline"><div><p>不是课程库，是你真正会用的几段复位。</p><strong>复位库</strong></div><span class="soft-badge">短 · 轻 · 可完成</span></div>' +
    '<section class="empty-note" style="text-align:left;margin-bottom:16px"><strong style="color:var(--ink);display:block;margin-bottom:6px">复位不是奖励，是工作的一部分。</strong>默认动作先用呼吸、肩颈和背部三条路径覆盖大多数久坐场景。你也可以把现有的复位视频导入这里。</section>' +
    '<div class="library-grid">' + cards + '</div>' +
    '<section class="add-video"><div><strong>带入你的复位视频</strong><p>视频只在当前设备使用，不会上传。</p></div><button data-action="upload-video">选择视频</button></section>' +
    '<div class="section-heading"><div><p class="section-kicker">RULE OF THE LIBRARY</p><h2>一段视频只做一件事</h2></div></div>' +
    '<p class="empty-note">手机端不再依赖电脑文件夹。内容以动作目标、时长和完成记录为中心，先让体验足够轻，再逐步扩充内容。</p>'
}

function renderLedger() {
  const totals = allStats()
  const rows = state.history
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14)
  const maxFocus = Math.max(1, ...rows.map((item) => item.focusMinutes || 0))
  const history =
    rows.length === 0
      ? '<p class="empty-note">完成第一轮专注或复位后，这里会长出你的身体节奏。</p>'
      : '<div class="history-list">' +
        rows
          .map(
            (item) =>
              '<div class="history-row"><div class="history-date"><strong>' + dateLabel(item.date) + '</strong><span>周' + weekdayLabel(item.date) + '</span></div><div class="history-bar"><span style="width:' + Math.max(4, ((item.focusMinutes || 0) / maxFocus) * 100) + '%"></span></div><strong>' + (item.completedResets || 0) + ' 次</strong></div>',
          )
          .join('') +
        '</div>'

  screen.innerHTML =
    '<div class="topline"><div><p>不记录体重，也不打分。</p><strong>身体账本</strong></div><span class="soft-badge">最近 ' + Math.max(rows.length, 1) + ' 天</span></div>' +
    '<section class="ledger-summary"><article class="ledger-card"><p class="card-label">累计专注</p><div class="ledger-big-number"><strong>' + formatMinutes(totals.focusMinutes) + '</strong></div><p class="topline" style="margin:7px 0 0"><span>把时间用在值得的地方</span></p></article><article class="ledger-card"><p class="card-label">累计复位</p><div class="ledger-big-number"><strong>' + totals.completedResets + '</strong><span>次</span></div><p class="topline" style="margin:7px 0 0"><span>身体有被叫回来</span></p></article></section>' +
    '<section class="ledger-card"><div class="section-heading" style="margin:0 0 10px"><div><p class="section-kicker">RECOVERY RHYTHM</p><h2>复位完成记录</h2></div></div>' + history + '</section>' +
    '<div class="section-heading"><div><p class="section-kicker">WHY THIS MATTERS</p><h2>看趋势，不看输赢</h2></div></div>' +
    '<p class="empty-note" style="text-align:left">最有价值的指标不是“今天坐了多久”，而是你有没有在身体发出信号时，真的停下来一次。</p>'
}

function renderSettings() {
  modalRoot.innerHTML =
    '<div class="modal-backdrop" data-action="close-settings">' +
      '<section class="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-sheet="true">' +
        '<div class="sheet-head"><h2 id="settings-title">设置节奏</h2><button class="sheet-close" data-action="close-settings" aria-label="关闭">×</button></div>' +
        '<label class="setting-row"><span><strong>每轮专注时长</strong><small>到点后提醒你进入复位</small></span><input data-setting="focusMinutes" type="number" min="15" max="120" step="5" value="' + state.settings.focusMinutes + '" /></label>' +
        '<label class="setting-row"><span><strong>允许通知</strong><small>浏览器会尽力在到点时提醒</small></span><input data-setting="notifications" type="checkbox" ' + (state.settings.notifications ? 'checked' : '') + ' /></label>' +
        '<p class="sheet-note">手机版不能像 Windows 桌面程序一样强制覆盖系统界面。第一版采用“通知 + 打开复位页 + 完成记录”的轻介入方式；如果需要可靠的后台提醒，再封装为原生 App。</p>' +
      '</section>' +
    '</div>'
}

function renderResetOverlay() {
  if (!resetSession) return
  const item = resetSession.item
  const progress = item.duration * 60 ? resetSession.elapsed / (item.duration * 60) : 0
  const activeStep = Math.min(item.steps.length - 1, Math.floor(progress * item.steps.length))
  const content = item.videoUrl
    ? '<video class="video-preview" src="' + escapeHtml(item.videoUrl) + '" controls autoplay playsinline></video>'
    : '<div class="reset-visual"><span>慢一点</span></div>'

  modalRoot.innerHTML =
    '<div class="reset-overlay">' +
      '<div class="reset-topbar"><div><p class="eyebrow">RESET / ' + escapeHtml(item.tag || 'MY VIDEO') + '</p></div><button class="reset-close" data-action="close-reset" aria-label="退出复位">×</button></div>' +
      '<div class="reset-main">' +
        content +
        '<div class="reset-copy"><p class="eyebrow">' + (resetSession.playing ? 'BODY IS COMING BACK' : 'PAUSED') + '</p><h2 class="overlay-title">' + escapeHtml(item.title) + '</h2><p>' + escapeHtml(item.description || '跟着自己的节奏完成这一小段。') + '</p>' +
          (item.videoUrl ? '<p class="video-file-note">正在播放你导入的本地视频</p>' : '') +
          '<div class="step-track">' + item.steps.map((_step, index) => '<span class="' + (index <= activeStep ? 'active' : '') + '"></span>').join('') + '</div><p class="step-label">现在：' + escapeHtml(item.steps[activeStep]) + '</p><div class="reset-clock">' + formatTime(resetSession.remaining * 1000) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="reset-bottom"><button class="button button-primary" data-action="complete-reset">' + (resetSession.playing ? '完成这次复位' : '完成并记录') + '</button><button class="button button-quiet" data-action="pause-reset">' + (resetSession.playing ? '暂时停一下' : '继续复位') + '</button></div>' +
    '</div>'
}

function showToast(message) {
  toast.textContent = message
  toast.classList.add('show')
  window.clearTimeout(toastHandle)
  toastHandle = window.setTimeout(() => toast.classList.remove('show'), 2800)
}

function setView(view) {
  activeView = view
  saveState()
  render()
  screen.focus({ preventScroll: true })
}

function startFocusTimer() {
  stopFocusTimer()
  state.focus.mode = 'running'
  focusTimerHandle = window.setInterval(() => {
    state.focus.remainingMs = Math.max(0, state.focus.remainingMs - 1000)
    currentRecord().focusMinutes += 1 / 60
    if (state.focus.remainingMs <= 0) {
      stopFocusTimer()
      state.focus.mode = 'idle'
      saveState()
      showToast('专注完成，身体复位时间到了。')
      startReset('neck')
      return
    }
    if (Math.round(state.focus.remainingMs / 1000) % 10 === 0) saveState()
    render()
  }, 1000)
  render()
}

function stopFocusTimer() {
  if (focusTimerHandle) {
    window.clearInterval(focusTimerHandle)
    focusTimerHandle = null
  }
}

function toggleFocus() {
  if (state.focus.mode === 'running') {
    state.focus.mode = 'paused'
    stopFocusTimer()
    saveState()
    render()
    return
  }
  if (state.focus.remainingMs <= 0) {
    resetFocus()
  }
  startFocusTimer()
}

function resetFocus() {
  stopFocusTimer()
  state.focus.mode = 'idle'
  state.focus.totalMs = state.settings.focusMinutes * 60 * 1000
  state.focus.remainingMs = state.focus.totalMs
  saveState()
}

function findResetItem(id) {
  return [...library, ...customVideos].find((item) => item.id === id)
}

function startReset(id) {
  const item = findResetItem(id) || library[0]
  stopResetTimer()
  resetSession = {
    item,
    remaining: item.duration * 60,
    elapsed: 0,
    playing: true,
  }
  renderResetOverlay()
  resetTimerHandle = window.setInterval(() => {
    if (!resetSession || !resetSession.playing) return
    resetSession.remaining = Math.max(0, resetSession.remaining - 1)
    resetSession.elapsed += 1
    if (resetSession.remaining <= 0) {
      completeReset()
      return
    }
    renderResetOverlay()
  }, 1000)
}

function stopResetTimer() {
  if (resetTimerHandle) {
    window.clearInterval(resetTimerHandle)
    resetTimerHandle = null
  }
}

function completeReset() {
  if (!resetSession) return
  const item = resetSession.item
  const record = currentRecord()
  record.resetMinutes += item.duration
  record.completedResets += 1
  stopResetTimer()
  resetSession = null
  resetFocus()
  modalRoot.innerHTML = ''
  saveState()
  setView('today')
  showToast('这次复位已记录，身体回来了。')
}

function closeReset() {
  stopResetTimer()
  resetSession = null
  modalRoot.innerHTML = ''
  showToast('这次复位没有记入账本。')
}

function pauseReset() {
  if (!resetSession) return
  resetSession.playing = !resetSession.playing
  renderResetOverlay()
}

function openSettings() {
  renderSettings()
}

function closeSettings() {
  modalRoot.innerHTML = ''
}

async function updateSetting(input) {
  const key = input.dataset.setting
  if (key === 'focusMinutes') {
    state.settings.focusMinutes = Math.min(120, Math.max(15, Number(input.value) || 50))
    state.focus.totalMs = state.settings.focusMinutes * 60 * 1000
    if (state.focus.mode === 'idle') state.focus.remainingMs = state.focus.totalMs
    input.value = state.settings.focusMinutes
  }
  if (key === 'notifications') {
    state.settings.notifications = input.checked
    if (input.checked) {
      if (!('Notification' in window)) {
        state.settings.notifications = false
        input.checked = false
        showToast('当前浏览器不支持通知，请直接把复位页打开使用。')
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          state.settings.notifications = false
          input.checked = false
          showToast('通知权限未开启，仍可以使用页内提醒。')
        } else {
          showToast('通知已开启。')
        }
      }
    }
  }
  saveState()
  render()
  renderSettings()
}

function uploadVideo() {
  videoInput.click()
}

videoInput.addEventListener('change', () => {
  const file = videoInput.files && videoInput.files[0]
  if (!file) return
  const id = 'local-' + Date.now()
  customVideos.push({
    id,
    title: file.name.replace(/\.[^/.]+$/, ''),
    description: '你导入的本地视频，适合放进自己的复位流程。',
    duration: 3,
    tag: '我的视频',
    icon: '▶',
    accent: '#a7d2bc',
    steps: ['准备', '跟练', '完成'],
    videoUrl: URL.createObjectURL(file),
  })
  setView('reset')
  showToast('视频已加入当前设备的复位库。')
  videoInput.value = ''
})

settingsButton.addEventListener('click', openSettings)

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-view]')
  if (target) {
    setView(target.dataset.view)
    return
  }

  const actionTarget = event.target.closest('[data-action]')
  if (!actionTarget) return
  const action = actionTarget.dataset.action
  if (action === 'focus-toggle') toggleFocus()
  if (action === 'immediate-reset') startReset('neck')
  if (action === 'start-reset') startReset(actionTarget.dataset.resetId)
  if (action === 'upload-video') uploadVideo()
  if (action === 'open-settings') openSettings()
  if (action === 'close-settings') {
    if (event.target.closest('[data-sheet]') && actionTarget.classList.contains('modal-backdrop')) return
    if (actionTarget.dataset.sheet === 'true') return
    closeSettings()
  }
  if (action === 'close-reset') closeReset()
  if (action === 'pause-reset') pauseReset()
  if (action === 'complete-reset') completeReset()
})

document.addEventListener('change', (event) => {
  const input = event.target.closest('[data-setting]')
  if (input) void updateSetting(input)
})

window.addEventListener('beforeunload', () => {
  saveState()
  stopFocusTimer()
  stopResetTimer()
})

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}

render()
