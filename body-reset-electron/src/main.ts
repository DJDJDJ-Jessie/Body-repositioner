import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

if (!window.bodyReset) {
  const mockSettings = {
    focusMinutes: 50,
    resetMinutes: 6,
    resetVolume: 1,
    sleepReminderVolume: 1,
    videoFolder: 'videos',
    sleepReminderEnabled: false,
    sleepReminderStart: '23:00',
    sleepReminderEnd: '07:00',
    sleepReminderInterval: 5,
    sleepReminderFolder: 'sleep-reminders',
    strictMode: true,
    autoStartWhenUnlocked: true,
    autoStartAfterSleep: true,
    earlyResetEnabled: false,
    earlyResetMinutes: 3,
    minimizeToTray: true,
    autoStart: false,
    emergencyExitSeconds: 5,
    externalLogSyncEnabled: false,
    externalLogSyncFolder: '',
  }
  const mockState = {
    appRoot: 'preview',
    dataDir: 'preview/data',
    settings: mockSettings,
    videoFolderPath: 'preview/videos',
    baseVideoFolderPath: 'preview/videos',
    videoSourceLabel: '今日使用：默认 videos 文件夹',
    videoSourceKind: 'default',
    matchedVideoFolderName: null,
    videos: [],
    videoCount: 0,
    sleepReminderVideoFolderPath: 'preview/sleep-reminders',
    sleepReminderVideoCount: 0,
    todayStats: {
      date: new Date().toISOString().slice(0, 10),
      focusMs: 0,
      resetMs: 0,
      resetCount: 0,
      completedResetCount: 0,
      skippedResetCount: 0,
    },
    externalLogSyncStatus: {
      enabled: false,
      folderPath: '',
      configured: false,
      lastSyncedAt: null,
      lastError: null,
    },
    systemLocked: false,
    shouldAutoStartTimer: false,
  }
  const getMockStatsTable = (period: 'week' | 'month') => ({
    period,
    title: period === 'month' ? '本月数据表' : '本周数据表',
    startDate: mockState.todayStats.date,
    endDate: mockState.todayStats.date,
    generatedAt: new Date().toISOString(),
    days: [{ ...mockState.todayStats, weekday: '今天' }],
    totals: {
      focusMs: mockState.todayStats.focusMs,
      resetMs: mockState.todayStats.resetMs,
      resetCount: mockState.todayStats.resetCount,
      completedResetCount: mockState.todayStats.completedResetCount,
      skippedResetCount: mockState.todayStats.skippedResetCount,
      completionRate: mockState.todayStats.resetCount
        ? Math.round((mockState.todayStats.completedResetCount / mockState.todayStats.resetCount) * 100)
        : 0,
    },
  })

  window.bodyReset = {
    getState: async () => mockState,
    saveSettings: async (settings) => ({
      settings,
      state: { ...mockState, settings },
    }),
    chooseVideoFolder: async () => mockState,
    openVideoFolder: async () => ({
      baseFolderPath: mockState.baseVideoFolderPath,
      folderPath: mockState.videoFolderPath,
      sourceLabel: mockState.videoSourceLabel,
      sourceKind: mockState.videoSourceKind,
      matchedFolderName: mockState.matchedVideoFolderName,
      count: 0,
      videos: [],
    }),
    scanVideos: async () => ({
      baseFolderPath: mockState.baseVideoFolderPath,
      folderPath: mockState.videoFolderPath,
      sourceLabel: mockState.videoSourceLabel,
      sourceKind: mockState.videoSourceKind,
      matchedFolderName: mockState.matchedVideoFolderName,
      count: 0,
      videos: [],
    }),
    scanSleepReminderVideos: async () => ({
      folderPath: mockState.sleepReminderVideoFolderPath,
      count: 0,
      videos: [],
    }),
    openSleepReminderFolder: async () => ({
      folderPath: mockState.sleepReminderVideoFolderPath,
      count: 0,
      videos: [],
    }),
    openDataFolder: async () => mockState.externalLogSyncStatus,
    chooseExternalLogFolder: async () => mockState,
    openExternalLogFolder: async () => mockState.externalLogSyncStatus,
    syncExternalLogs: async () => mockState.externalLogSyncStatus,
    addFocusTime: async (ms) => {
      mockState.todayStats.focusMs += Math.max(0, Math.round(ms))
      return mockState.todayStats
    },
    getStatsTable: async (period) => getMockStatsTable(period),
    beginReset: async () => ({
      id: Date.now(),
      video: null,
      settings: mockSettings,
      canClose: false,
    }),
    getResetPayload: async () => ({
      id: Date.now(),
      video: null,
      settings: mockSettings,
      canClose: false,
    }),
    completeReset: async () => ({ completed: true }),
    emergencyCloseReset: async () => ({ completed: false }),
    getReminderPayload: async () => null,
    emergencyCloseReminder: async () => ({ closed: true, nextReminderAt: Date.now() + 300_000 }),
    setAutoStart: async () => mockSettings,
    onResetCompleted: () => () => undefined,
    onSleepReminderStarted: () => () => undefined,
    onSystemSuspend: () => () => undefined,
    onSystemResume: () => () => undefined,
    onSystemResumeFromSleep: () => () => undefined,
    onSystemLock: () => () => undefined,
    onSystemUnlock: () => () => undefined,
  }
}

createApp(App).mount('#app')
