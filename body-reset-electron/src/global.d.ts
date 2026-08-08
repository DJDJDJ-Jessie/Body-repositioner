export {}

declare global {
  interface Window {
    bodyResetPreview?: boolean
    bodyReset: {
      getState: () => Promise<AppState>
      saveSettings: (settings: AppSettings) => Promise<{ settings: AppSettings; state: AppState }>
      chooseVideoFolder: () => Promise<AppState>
      openVideoFolder: () => Promise<VideoLibrary>
      scanVideos: () => Promise<VideoLibrary>
      scanSleepReminderVideos: () => Promise<ReminderVideoLibrary>
      openSleepReminderFolder: () => Promise<ReminderVideoLibrary>
      openDataFolder: () => Promise<ExternalLogSyncStatus>
      chooseExternalLogFolder: () => Promise<AppState>
      openExternalLogFolder: () => Promise<ExternalLogSyncStatus>
      syncExternalLogs: () => Promise<ExternalLogSyncStatus>
      addFocusTime: (ms: number) => Promise<TodayStats>
      getStatsTable: (period: StatsPeriod) => Promise<StatsTable>
      beginReset: () => Promise<ResetPayload>
      getResetPayload: () => Promise<ResetPayload>
      completeReset: (payload: { videoName?: string; videoEnded?: boolean }) => Promise<{
        completed: boolean
        reason?: 'not-ready'
      }>
      emergencyCloseReset: () => Promise<{ completed: boolean }>
      getReminderPayload: () => Promise<ReminderPayload | null>
      emergencyCloseReminder: () => Promise<{ closed: boolean; nextReminderAt: number }>
      setAutoStart: (enabled: boolean) => Promise<AppSettings>
      onResetCompleted: (
        callback: (payload: { completed: boolean; videoName?: string; todayStats?: TodayStats }) => void,
      ) => () => void
      onSleepReminderStarted: (
        callback: (payload: { intervalMinutes: number; nextIntervalMinutes: number }) => void,
      ) => () => void
      onSystemSuspend: (callback: () => void) => () => void
      onSystemResume: (callback: () => void) => () => void
      onSystemResumeFromSleep: (callback: () => void) => () => void
      onSystemLock: (callback: () => void) => () => void
      onSystemUnlock: (callback: () => void) => () => void
    }
  }

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
    autoStartAfterSleep: boolean
    earlyResetEnabled: boolean
    earlyResetMinutes: number
    minimizeToTray: boolean
    autoStart: boolean
    emergencyExitSeconds: number
    externalLogSyncEnabled: boolean
    externalLogSyncFolder: string
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

  type VideoLibrary = {
    baseFolderPath: string
    folderPath: string
    sourceLabel: string
    sourceKind: string
    matchedFolderName: string | null
    count: number
    videos: VideoItem[]
  }

  type ReminderVideoLibrary = {
    folderPath: string
    count: number
    videos: VideoItem[]
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
}
