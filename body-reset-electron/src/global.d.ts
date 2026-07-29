export {}

declare global {
  interface Window {
    bodyReset: {
      getState: () => Promise<AppState>
      saveSettings: (settings: AppSettings) => Promise<{ settings: AppSettings; state: AppState }>
      chooseVideoFolder: () => Promise<AppState>
      openVideoFolder: () => Promise<VideoLibrary>
      scanVideos: () => Promise<VideoLibrary>
      addFocusTime: (ms: number) => Promise<TodayStats>
      getStatsTable: (period: StatsPeriod) => Promise<StatsTable>
      beginReset: () => Promise<ResetPayload>
      getResetPayload: () => Promise<ResetPayload>
      completeReset: (payload: { videoName?: string }) => Promise<{ completed: boolean }>
      emergencyCloseReset: () => Promise<{ completed: boolean }>
      setAutoStart: (enabled: boolean) => Promise<AppSettings>
      onResetCompleted: (
        callback: (payload: { completed: boolean; videoName?: string; todayStats?: TodayStats }) => void,
      ) => () => void
    }
  }

  type AppSettings = {
    focusMinutes: number
    resetMinutes: number
    videoFolder: string
    strictMode: boolean
    minimizeToTray: boolean
    autoStart: boolean
    emergencyExitSeconds: number
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
    video: VideoItem | null
    settings: AppSettings
    canClose: boolean
  }
}
