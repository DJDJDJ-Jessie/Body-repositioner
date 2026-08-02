const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bodyReset', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  chooseVideoFolder: () => ipcRenderer.invoke('videos:choose-folder'),
  openVideoFolder: () => ipcRenderer.invoke('videos:open-folder'),
  scanVideos: () => ipcRenderer.invoke('videos:scan'),
  scanSleepReminderVideos: () => ipcRenderer.invoke('sleep-reminders:scan'),
  openSleepReminderFolder: () => ipcRenderer.invoke('sleep-reminders:open-folder'),
  openDataFolder: () => ipcRenderer.invoke('logs:open-data-folder'),
  chooseExternalLogFolder: () => ipcRenderer.invoke('logs:choose-external-folder'),
  openExternalLogFolder: () => ipcRenderer.invoke('logs:open-external-folder'),
  syncExternalLogs: () => ipcRenderer.invoke('logs:sync-external'),
  addFocusTime: (ms) => ipcRenderer.invoke('stats:add-focus-time', ms),
  getStatsTable: (period) => ipcRenderer.invoke('stats:get-table', period),
  beginReset: () => ipcRenderer.invoke('reset:begin'),
  getResetPayload: () => ipcRenderer.invoke('reset:get-payload'),
  completeReset: (payload) => ipcRenderer.invoke('reset:complete', payload),
  emergencyCloseReset: () => ipcRenderer.invoke('reset:emergency-close'),
  getReminderPayload: () => ipcRenderer.invoke('reminder:get-payload'),
  emergencyCloseReminder: () => ipcRenderer.invoke('reminder:emergency-close'),
  setAutoStart: (enabled) => ipcRenderer.invoke('app:set-auto-start', enabled),
  onResetCompleted: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('reset:completed', listener);
    return () => ipcRenderer.removeListener('reset:completed', listener);
  },
  onSystemSuspend: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('system:suspend', listener);
    return () => ipcRenderer.removeListener('system:suspend', listener);
  },
  onSystemResume: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('system:resume', listener);
    return () => ipcRenderer.removeListener('system:resume', listener);
  },
  onSystemLock: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('system:lock', listener);
    return () => ipcRenderer.removeListener('system:lock', listener);
  },
  onSystemUnlock: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('system:unlock', listener);
    return () => ipcRenderer.removeListener('system:unlock', listener);
  },
});
