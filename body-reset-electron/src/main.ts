import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

if (!window.bodyReset) {
  const mockSettings = {
    focusMinutes: 50,
    resetMinutes: 6,
    videoFolder: 'videos',
    strictMode: true,
    minimizeToTray: true,
    autoStart: false,
    emergencyExitSeconds: 5,
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
    todayStats: {
      date: new Date().toISOString().slice(0, 10),
      focusMs: 0,
      resetMs: 0,
      resetCount: 0,
      completedResetCount: 0,
      skippedResetCount: 0,
    },
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
    setAutoStart: async () => mockSettings,
    onResetCompleted: () => () => undefined,
  }
}

createApp(App).mount('#app')
