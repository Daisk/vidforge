import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AppInfo, ConvertJob, ConvertOptions, MediaInfo, ProgressEvent, StartConvertRequest, ThumbSet } from '../shared/types'

/**
 * The only bridge between the renderer and Node land.
 * Everything is explicitly whitelisted — no `require`, no fs, no child_process
 * leaks into the UI process.
 */
const api = {
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  pickFiles: (): Promise<string[]> => ipcRenderer.invoke('files:pick'),
  pickOutputDir: (current?: string): Promise<string> => ipcRenderer.invoke('files:pickDir', current),
  reveal: (p: string): Promise<void> => ipcRenderer.invoke('files:reveal', p),

  probe: (p: string): Promise<MediaInfo> => ipcRenderer.invoke('media:probe', p),
  thumbnails: (p: string): Promise<ThumbSet> => ipcRenderer.invoke('media:thumb', p),

  startConvert: (req: StartConvertRequest): Promise<ConvertJob> => ipcRenderer.invoke('convert:start', req),
  cancelConvert: (id: string): Promise<boolean> => ipcRenderer.invoke('convert:cancel', id),
  listJobs: (): Promise<ConvertJob[]> => ipcRenderer.invoke('convert:list'),
  clearFinished: (): Promise<void> => ipcRenderer.invoke('convert:clear'),

  onProgress: (cb: (e: ProgressEvent) => void): (() => void) => {
    const handler = (_: unknown, payload: ProgressEvent) => cb(payload)
    ipcRenderer.on('convert:update', handler)
    return () => ipcRenderer.removeListener('convert:update', handler)
  },

  onDemoLoad: (cb: (p: string) => void): (() => void) => {
    const handler = (_: unknown, p: string) => cb(p)
    ipcRenderer.on('demo:load', handler)
    return () => ipcRenderer.removeListener('demo:load', handler)
  },

  onDemoConvert: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('demo:convert', handler)
    return () => ipcRenderer.removeListener('demo:convert', handler)
  },

  // Electron >= 32 removed File.path; this is the supported replacement.
  pathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },

  window: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    maximize: () => ipcRenderer.invoke('win:maximize'),
    close: () => ipcRenderer.invoke('win:close'),
    onMaximized: (cb: (v: boolean) => void): (() => void) => {
      const handler = (_: unknown, v: boolean) => cb(v)
      ipcRenderer.on('win:maximized', handler)
      return () => ipcRenderer.removeListener('win:maximized', handler)
    },
  },
}

contextBridge.exposeInMainWorld('vf', api)

export type VfApi = typeof api
