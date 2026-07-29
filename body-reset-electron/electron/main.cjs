const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('local.body-reset-reminder');

const videoExtensions = new Set(['.mp4', '.mov', '.wmv', '.avi', '.mkv', '.m4v']);
const weekdayGroupAliases = [
  '工作日',
  '周一到周五',
  '周一至周五',
  '周一-周五',
  '周一_周五',
  '周一周五',
  'weekday',
  'weekdays',
  'mon-fri',
  'monday-friday',
];
const weekendGroupAliases = [
  '周末',
  '双休日',
  '周六周日',
  '周六到周日',
  '周六至周日',
  'weekend',
  'weekends',
  'sat-sun',
  'saturday-sunday',
];
const dayFolderRules = [
  { day: 1, label: '周一', aliases: ['周一', '星期一', '礼拜一', 'monday', 'mon'] },
  { day: 2, label: '周二', aliases: ['周二', '星期二', '礼拜二', 'tuesday', 'tue'] },
  { day: 3, label: '周三', aliases: ['周三', '星期三', '礼拜三', 'wednesday', 'wed'] },
  { day: 4, label: '周四', aliases: ['周四', '星期四', '礼拜四', 'thursday', 'thu'] },
  { day: 5, label: '周五', aliases: ['周五', '星期五', '礼拜五', 'friday', 'fri'] },
  { day: 6, label: '周六', aliases: ['周六', '星期六', '礼拜六', 'saturday', 'sat'] },
  { day: 0, label: '周日', aliases: ['周日', '周天', '星期日', '星期天', '礼拜日', '礼拜天', 'sunday', 'sun'] },
];
const appIconDataUrl =
  'data:image/png;base64,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';
const defaultSettings = {
  focusMinutes: 50,
  resetMinutes: 6,
  videoFolder: 'videos',
  strictMode: true,
  minimizeToTray: true,
  autoStart: false,
  emergencyExitSeconds: 5,
};

let mainWindow = null;
let resetWindow = null;
let tray = null;
let isQuitting = false;
let pendingResetPayload = null;
let settingsCache = null;
let appIcon = null;

function getAppIcon(size = 32) {
  if (!appIcon) {
    appIcon = nativeImage.createFromDataURL(appIconDataUrl);
  }

  return appIcon.resize({ width: size, height: size, quality: 'best' });
}

function getPortableRoot() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }

  if (process.env.PORTABLE_EXECUTABLE_FILE) {
    return path.dirname(process.env.PORTABLE_EXECUTABLE_FILE);
  }

  if (app.isPackaged) {
    return path.dirname(process.execPath);
  }

  return path.resolve(__dirname, '..', '..');
}

function getLaunchExecutablePath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function getDataDir() {
  return path.join(getPortableRoot(), 'data');
}

function getSettingsPath() {
  return path.join(getDataDir(), 'settings.json');
}

function getVideoStatePath() {
  return path.join(getDataDir(), 'video-state.json');
}

function getLogPath() {
  return path.join(getDataDir(), 'reset-log.csv');
}

function getStatsPath() {
  return path.join(getDataDir(), 'daily-stats.json');
}

function getStatsCsvPath() {
  return path.join(getDataDir(), 'daily-stats.csv');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensurePortableDirs() {
  ensureDir(getDataDir());
  ensureDir(getVideoFolderPath(loadSettings()));
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function normalizeSettings(input) {
  const merged = { ...defaultSettings, ...(input || {}) };
  return {
    focusMinutes: clampInt(merged.focusMinutes, 1, 240, defaultSettings.focusMinutes),
    resetMinutes: clampInt(merged.resetMinutes, 1, 60, defaultSettings.resetMinutes),
    videoFolder:
      typeof merged.videoFolder === 'string' && merged.videoFolder.trim()
        ? merged.videoFolder.trim()
        : defaultSettings.videoFolder,
    strictMode: Boolean(merged.strictMode),
    minimizeToTray: Boolean(merged.minimizeToTray),
    autoStart: Boolean(merged.autoStart),
    emergencyExitSeconds: clampInt(
      merged.emergencyExitSeconds,
      3,
      20,
      defaultSettings.emergencyExitSeconds,
    ),
  };
}

function clampInt(value, min, max, fallback) {
  const next = Number.parseInt(value, 10);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function loadSettings() {
  if (settingsCache) return settingsCache;
  settingsCache = normalizeSettings(readJson(getSettingsPath(), defaultSettings));
  writeJson(getSettingsPath(), settingsCache);
  return settingsCache;
}

function saveSettings(nextSettings) {
  settingsCache = normalizeSettings(nextSettings);
  writeJson(getSettingsPath(), settingsCache);
  ensureDir(getVideoFolderPath(settingsCache));
  applyAutoStart(settingsCache.autoStart);
  return settingsCache;
}

function getVideoFolderPath(settings = loadSettings()) {
  if (path.isAbsolute(settings.videoFolder)) {
    return settings.videoFolder;
  }

  return path.join(getPortableRoot(), settings.videoFolder);
}

function normalizeFolderName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[＿_—–]/g, '-')
    .replace(/至/g, '到');
}

function expandedAliases(aliases) {
  return aliases.flatMap((alias) => {
    const normalized = normalizeFolderName(alias);
    return [normalized, `${normalized}视频`, `${normalized}复位`, `${normalized}运动`];
  });
}

function listSubfolders(folderPath) {
  if (!fs.existsSync(folderPath)) return [];

  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(folderPath, entry.name),
      normalizedName: normalizeFolderName(entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

function findFolderByAliases(baseFolderPath, aliases) {
  const aliasSet = new Set(expandedAliases(aliases));
  return listSubfolders(baseFolderPath).find((folder) => aliasSet.has(folder.normalizedName)) || null;
}

function resolveActiveVideoSource(date = new Date()) {
  const baseFolderPath = getVideoFolderPath();
  ensureDir(baseFolderPath);

  const day = date.getDay();
  const dayRule = dayFolderRules.find((rule) => rule.day === day);
  const dayFolder = dayRule ? findFolderByAliases(baseFolderPath, dayRule.aliases) : null;

  if (dayFolder && dayRule) {
    return {
      baseFolderPath,
      folderPath: dayFolder.path,
      sourceLabel: `今日使用：${dayRule.label}文件夹`,
      sourceKind: 'day',
      matchedFolderName: dayFolder.name,
    };
  }

  const isWeekday = day >= 1 && day <= 5;
  const groupFolder = findFolderByAliases(
    baseFolderPath,
    isWeekday ? weekdayGroupAliases : weekendGroupAliases,
  );

  if (groupFolder) {
    return {
      baseFolderPath,
      folderPath: groupFolder.path,
      sourceLabel: `今日使用：${isWeekday ? '工作日' : '周末'}文件夹`,
      sourceKind: isWeekday ? 'weekday' : 'weekend',
      matchedFolderName: groupFolder.name,
    };
  }

  return {
    baseFolderPath,
    folderPath: baseFolderPath,
    sourceLabel: '今日使用：默认 videos 文件夹',
    sourceKind: 'default',
    matchedFolderName: null,
  };
}

function toPublicVideo(videoPath) {
  const stat = fs.statSync(videoPath);
  return {
    name: path.basename(videoPath),
    path: videoPath,
    url: pathToFileURL(videoPath).toString(),
    updatedAt: stat.mtimeMs,
    size: stat.size,
  };
}

function scanVideos() {
  const source = resolveActiveVideoSource();
  const folderPath = source.folderPath;
  ensureDir(folderPath);

  const videos = fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && videoExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => toPublicVideo(path.join(folderPath, entry.name)))
    .filter((video) => video.size > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

  return {
    baseFolderPath: source.baseFolderPath,
    folderPath,
    sourceLabel: source.sourceLabel,
    sourceKind: source.sourceKind,
    matchedFolderName: source.matchedFolderName,
    count: videos.length,
    videos,
  };
}

function readVideoState() {
  return readJson(getVideoStatePath(), { playedPaths: [], lastPath: null });
}

function writeVideoState(state) {
  writeJson(getVideoStatePath(), {
    playedPaths: Array.isArray(state.playedPaths) ? state.playedPaths : [],
    lastPath: typeof state.lastPath === 'string' ? state.lastPath : null,
  });
}

function pickNextVideo() {
  const library = scanVideos();
  if (!library.videos.length) return null;

  const currentPaths = new Set(library.videos.map((video) => video.path));
  const state = readVideoState();
  const playedPaths = Array.isArray(state.playedPaths)
    ? state.playedPaths.filter((item) => currentPaths.has(item))
    : [];
  let candidates = library.videos.filter((video) => !playedPaths.includes(video.path));

  if (!candidates.length) {
    candidates = library.videos.slice();
    playedPaths.length = 0;
  }

  if (candidates.length > 1 && state.lastPath) {
    candidates = candidates.filter((video) => video.path !== state.lastPath);
  }

  const next = candidates[Math.floor(Math.random() * candidates.length)];
  const nextPlayedPaths = [...playedPaths, next.path];
  writeVideoState({ playedPaths: nextPlayedPaths, lastPath: next.path });
  return next;
}

function appendResetLog(payload) {
  const filePath = getLogPath();
  const exists = fs.existsSync(filePath);
  const row = [
    new Date().toISOString(),
    payload && payload.completed ? 'completed' : 'skipped',
    payload && payload.videoName ? csv(payload.videoName) : '',
  ].join(',');

  fs.appendFileSync(filePath, `${exists ? '' : 'time,result,video\n'}${row}\n`, 'utf8');
}

function csv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map((part) => Number(part));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function addLocalDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfLocalWeek(date) {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addLocalDays(date, offset);
}

function startOfLocalMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getWeekdayLabel(date) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
}

function createEmptyDay(dateKey = getLocalDateKey()) {
  return {
    date: dateKey,
    focusMs: 0,
    resetMs: 0,
    resetCount: 0,
    completedResetCount: 0,
    skippedResetCount: 0,
  };
}

function normalizeDayStats(raw, dateKey = getLocalDateKey()) {
  const fallback = createEmptyDay(dateKey);
  return {
    date: typeof raw?.date === 'string' ? raw.date : fallback.date,
    focusMs: clampDurationMs(raw?.focusMs, 0),
    resetMs: clampDurationMs(raw?.resetMs, 0),
    resetCount: clampInt(raw?.resetCount, 0, 10000, 0),
    completedResetCount: clampInt(raw?.completedResetCount, 0, 10000, 0),
    skippedResetCount: clampInt(raw?.skippedResetCount, 0, 10000, 0),
  };
}

function clampDurationMs(value, fallback = 0) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(24 * 60 * 60 * 1000, Math.max(0, Math.round(next)));
}

function readStatsStore() {
  const store = readJson(getStatsPath(), { days: {} });
  return {
    days: store && typeof store.days === 'object' && store.days ? store.days : {},
  };
}

function writeStatsStore(store) {
  writeJson(getStatsPath(), {
    days: store.days || {},
  });
  writeStatsCsv(store);
}

function getTodayStats() {
  const dateKey = getLocalDateKey();
  const store = readStatsStore();
  return normalizeDayStats(store.days[dateKey], dateKey);
}

function getSortedStatsDays(store) {
  return Object.keys(store.days || {})
    .sort()
    .map((dateKey) => normalizeDayStats(store.days[dateKey], dateKey));
}

function writeStatsCsv(store) {
  const header = [
    '日期',
    '星期',
    '工作分钟',
    '复位分钟',
    '复位次数',
    '完成复位',
    '紧急退出',
    '完成率',
  ];
  const rows = getSortedStatsDays(store).map((day) => {
    const date = parseLocalDateKey(day.date);
    const completionRate = day.resetCount
      ? `${Math.round((day.completedResetCount / day.resetCount) * 100)}%`
      : '0%';
    return [
      day.date,
      getWeekdayLabel(date),
      Math.round(day.focusMs / 60_000),
      Math.round(day.resetMs / 60_000),
      day.resetCount,
      day.completedResetCount,
      day.skippedResetCount,
      completionRate,
    ].map(csv);
  });

  ensureDir(path.dirname(getStatsCsvPath()));
  fs.writeFileSync(getStatsCsvPath(), `\ufeff${[header.map(csv), ...rows].map((row) => row.join(',')).join('\n')}\n`, 'utf8');
}

function summarizeStats(days) {
  const totals = days.reduce(
    (summary, day) => {
      summary.focusMs += day.focusMs;
      summary.resetMs += day.resetMs;
      summary.resetCount += day.resetCount;
      summary.completedResetCount += day.completedResetCount;
      summary.skippedResetCount += day.skippedResetCount;
      return summary;
    },
    {
      focusMs: 0,
      resetMs: 0,
      resetCount: 0,
      completedResetCount: 0,
      skippedResetCount: 0,
    },
  );

  totals.completionRate = totals.resetCount
    ? Math.round((totals.completedResetCount / totals.resetCount) * 100)
    : 0;
  return totals;
}

function buildStatsTable(period = 'week') {
  const normalizedPeriod = period === 'month' ? 'month' : 'week';
  const today = new Date();
  const startDate = normalizedPeriod === 'month' ? startOfLocalMonth(today) : startOfLocalWeek(today);
  const endDate = today;
  const store = readStatsStore();
  const days = [];

  for (let cursor = startDate; cursor <= endDate; cursor = addLocalDays(cursor, 1)) {
    const dateKey = getLocalDateKey(cursor);
    const stats = normalizeDayStats(store.days[dateKey], dateKey);
    days.push({
      ...stats,
      weekday: getWeekdayLabel(cursor),
    });
  }

  writeStatsCsv(store);

  return {
    period: normalizedPeriod,
    title: normalizedPeriod === 'month' ? '本月数据表' : '本周数据表',
    startDate: getLocalDateKey(startDate),
    endDate: getLocalDateKey(endDate),
    generatedAt: new Date().toISOString(),
    days,
    totals: summarizeStats(days),
  };
}

function updateTodayStats(mutator) {
  const dateKey = getLocalDateKey();
  const store = readStatsStore();
  const day = normalizeDayStats(store.days[dateKey], dateKey);
  mutator(day);
  store.days[dateKey] = normalizeDayStats(day, dateKey);
  writeStatsStore(store);
  return store.days[dateKey];
}

function addFocusTime(ms) {
  return updateTodayStats((day) => {
    day.focusMs = clampDurationMs(day.focusMs + clampDurationMs(ms, 0));
  });
}

function addResetSession(completed, durationMs) {
  return updateTodayStats((day) => {
    day.resetCount = clampInt(day.resetCount + 1, 0, 10000, day.resetCount);
    if (completed) {
      day.completedResetCount = clampInt(
        day.completedResetCount + 1,
        0,
        10000,
        day.completedResetCount,
      );
      day.resetMs = clampDurationMs(day.resetMs + clampDurationMs(durationMs, 0));
    } else {
      day.skippedResetCount = clampInt(
        day.skippedResetCount + 1,
        0,
        10000,
        day.skippedResetCount,
      );
    }
  });
}

function shouldAutoStartTimer() {
  const settings = loadSettings();
  if (!settings.autoStart) return false;
  if (process.argv.includes('--auto-start-timer')) return true;

  try {
    return Boolean(app.getLoginItemSettings().wasOpenedAtLogin);
  } catch {
    return false;
  }
}

function buildAppState() {
  const settings = loadSettings();
  const library = scanVideos();
  return {
    appRoot: getPortableRoot(),
    dataDir: getDataDir(),
    settings,
    videoFolderPath: library.folderPath,
    baseVideoFolderPath: library.baseFolderPath,
    videoSourceLabel: library.sourceLabel,
    videoSourceKind: library.sourceKind,
    matchedVideoFolderName: library.matchedFolderName,
    videos: library.videos,
    videoCount: library.count,
    todayStats: getTodayStats(),
    shouldAutoStartTimer: shouldAutoStartTimer(),
  };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 860,
    minHeight: 620,
    title: '身体复位提醒器',
    backgroundColor: '#f7faf6',
    show: true,
    icon: getAppIcon(64),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f7faf6',
      symbolColor: '#17332c',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  loadRenderer(mainWindow);

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && loadSettings().minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
      ensureTray();
    }
  });
}

function createResetWindow() {
  if (resetWindow && !resetWindow.isDestroyed()) {
    resetWindow.focus();
    return;
  }

  const display =
    mainWindow && !mainWindow.isDestroyed()
      ? screen.getDisplayMatching(mainWindow.getBounds())
      : screen.getPrimaryDisplay();
  const bounds = display.bounds;

  resetWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    title: '身体复位',
    backgroundColor: '#050807',
    icon: getAppIcon(64),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  resetWindow.setBounds(bounds);
  resetWindow.setFullScreen(true);
  resetWindow.setAlwaysOnTop(true, 'screen-saver');
  resetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  loadRenderer(resetWindow, 'reset');

  resetWindow.on('close', (event) => {
    if (loadSettings().strictMode && pendingResetPayload && !pendingResetPayload.canClose) {
      event.preventDefault();
    }
  });

  resetWindow.on('closed', () => {
    resetWindow = null;
  });
}

function loadRenderer(win, view = 'main') {
  if (!app.isPackaged) {
    win.loadURL(`http://127.0.0.1:5173?view=${view}`);
    return;
  }

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
    query: { view },
  });
}

function ensureTray() {
  if (tray) return tray;

  tray = new Tray(getAppIcon(32));
  tray.setToolTip('身体复位提醒器');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '打开',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

function applyAutoStart(enabled) {
  if (!app.isPackaged) return;

  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: getLaunchExecutablePath(),
    args: ['--auto-start-timer'],
  });
}

ipcMain.handle('app:get-state', () => buildAppState());

ipcMain.handle('stats:add-focus-time', (_event, ms) => addFocusTime(ms));

ipcMain.handle('stats:get-table', (_event, period) => buildStatsTable(period));

ipcMain.handle('settings:save', (_event, nextSettings) => {
  return {
    settings: saveSettings(nextSettings),
    state: buildAppState(),
  };
});

ipcMain.handle('app:set-auto-start', (_event, enabled) => {
  const settings = saveSettings({ ...loadSettings(), autoStart: Boolean(enabled) });
  return settings;
});

ipcMain.handle('videos:scan', () => scanVideos());

ipcMain.handle('videos:open-folder', async () => {
  const folderPath = getVideoFolderPath();
  ensureDir(folderPath);
  await shell.openPath(folderPath);
  return scanVideos();
});

ipcMain.handle('videos:choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择视频文件夹',
    defaultPath: getVideoFolderPath(),
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || !result.filePaths[0]) {
    return buildAppState();
  }

  saveSettings({ ...loadSettings(), videoFolder: result.filePaths[0] });
  return buildAppState();
});

ipcMain.handle('reset:begin', () => {
  const video = pickNextVideo();
  pendingResetPayload = {
    id: Date.now(),
    startedAt: Date.now(),
    video,
    settings: loadSettings(),
    canClose: false,
  };
  createResetWindow();
  return pendingResetPayload;
});

ipcMain.handle('reset:get-payload', () => {
  if (!pendingResetPayload) {
    pendingResetPayload = {
      id: Date.now(),
      startedAt: Date.now(),
      video: pickNextVideo(),
      settings: loadSettings(),
      canClose: false,
    };
  }
  return pendingResetPayload;
});

ipcMain.handle('reset:complete', (_event, payload = {}) => {
  if (pendingResetPayload) {
    pendingResetPayload.canClose = true;
  }

  const videoName =
    payload.videoName ||
    (pendingResetPayload && pendingResetPayload.video && pendingResetPayload.video.name) ||
    '';
  const durationMs = pendingResetPayload?.startedAt ? Date.now() - pendingResetPayload.startedAt : 0;
  const todayStats = addResetSession(true, durationMs);
  appendResetLog({ completed: true, videoName });

  if (resetWindow && !resetWindow.isDestroyed()) {
    resetWindow.close();
  }

  pendingResetPayload = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('reset:completed', { completed: true, videoName, todayStats });
    mainWindow.show();
  }

  return { completed: true };
});

ipcMain.handle('reset:emergency-close', () => {
  const durationMs = pendingResetPayload?.startedAt ? Date.now() - pendingResetPayload.startedAt : 0;
  const todayStats = addResetSession(false, durationMs);
  if (pendingResetPayload) {
    pendingResetPayload.canClose = true;
  }
  appendResetLog({
    completed: false,
    videoName: pendingResetPayload && pendingResetPayload.video ? pendingResetPayload.video.name : '',
  });
  if (resetWindow && !resetWindow.isDestroyed()) {
    resetWindow.close();
  }
  pendingResetPayload = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('reset:completed', { completed: false, todayStats });
    mainWindow.show();
  }
  return { completed: false };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensurePortableDirs();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
