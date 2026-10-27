import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { AppInfo, ConvertOptions, StartConvertRequest } from '../shared/types'
import { PRESET_DEFAULTS } from '../shared/presets'
import { ConversionService } from './services/converter'
import { resolveBins, ffmpegVersion } from './services/ffmpeg'
import { probeHardware, readCachedHardware } from './services/hardware'
import { probeMedia } from './services/probe'
import { buildThumbnails } from './services/thumbnails'

const isDev = !app.isPackaged && process.env.VF_DEV === '1'
const screenshotMode = process.argv.includes('--screenshot')
const selfTestMode = process.argv.includes('--selftest')
const demoFileArg = process.argv.find((a) => a.startsWith('--file='))
const demoFile = demoFileArg ? demoFileArg.slice('--file='.length) : ''

/* Custom protocol so the renderer can stream local media and cached thumbnails
 * without enabling nodeIntegration or disabling webSecurity. */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vf',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true },
  },
])

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

async function serveFile(request: Request, filePath: string): Promise<Response> {
  const stat = await fs.promises.stat(filePath)
  const total = stat.size
  const type = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  const range = request.headers.get('range')

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    if (m) {
      let start = m[1] ? Number(m[1]) : 0
      let end = m[2] ? Number(m[2]) : total - 1
      if (Number.isNaN(start) || start >= total) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } })
      }
      end = Math.min(end, total - 1)
      const stream = fs.createReadStream(filePath, { start, end })
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
        },
      })
    }
  }

  const stream = fs.createReadStream(filePath)
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: { 'Content-Type': type, 'Content-Length': String(total), 'Accept-Ranges': 'bytes' },
  })
}

function registerProtocol(): void {
  protocol.handle('vf', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname === 'thumb') {
        const name = decodeURIComponent(url.pathname.replace(/^\//, ''))
        const p = path.join(app.getPath('userData'), 'thumbs', name)
        return await serveFile(request, p)
      }
      if (url.hostname === 'media') {
        const id = url.pathname.replace(/^\//, '')
        const p = Buffer.from(id, 'base64url').toString('utf8')
        return await serveFile(request, p)
      }
      return new Response('Not found', { status: 404 })
    } catch (err) {
      return new Response(`Error: ${String(err)}`, { status: 500 })
    }
  })
}

let mainWindow: BrowserWindow | null = null
let hardwareCache = readCachedHardware()
const conversions = new ConversionService()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#0b0e13',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  })

  const indexHtml = path.join(app.getAppPath(), 'dist', 'index.html')
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(indexHtml)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (screenshotMode) void runScreenshot()
  })

  mainWindow.webContents.on('console-message', (...args: unknown[]) => {
    const e = args[0] as { message?: string; lineNumber?: number; sourceId?: string } | undefined
    if (e && typeof e === 'object' && 'message' in e) {
      console.log(`[renderer] ${e.message} (${e.sourceId}:${e.lineNumber})`)
    } else {
      console.log('[renderer]', args[1], args[2], args[3])
    }
  })

  const emitMax = () => mainWindow?.webContents.send('win:maximized', mainWindow.isMaximized())
  mainWindow.on('maximize', emitMax)
  mainWindow.on('unmaximize', emitMax)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function runScreenshot(): Promise<void> {
  const win = mainWindow
  if (!win) return
  try {
    if (demoFile) {
      win.webContents.send('demo:load', demoFile)
      await new Promise((r) => setTimeout(r, 3500))
      win.webContents.send('demo:convert')
      await new Promise((r) => setTimeout(r, 2400))
    } else {
      await new Promise((r) => setTimeout(r, 2500))
    }
    const image = await win.webContents.capturePage()
    const dir = path.join(app.getAppPath(), 'screenshots')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'app.png'), image.toPNG())
  } catch (err) {
    console.error('screenshot failed', err)
  }
  app.quit()
}

/* ---------------------------------------------------------------------- IPC */

function registerIpc(): void {
  const service = conversions

  service.on('update', (payload) => {
    mainWindow?.webContents.send('convert:update', payload)
  })

  ipcMain.handle('app:info', async (): Promise<AppInfo> => {
    const bins = resolveBins()
    const version = await ffmpegVersion()
    if (!hardwareCache && version) {
      hardwareCache = await probeHardware(bins.ffmpeg)
      service.setHardware(hardwareCache)
    }
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      ffmpegPath: bins.ffmpeg,
      ffmpegVersion: version || 'not found',
      ffprobePath: bins.ffprobe,
      ffmpegFound: Boolean(version),
      platform: process.platform,
      defaultOutputDir: app.getPath('videos'),
      hardware: hardwareCache ?? { vendor: 'unknown', workingEncoders: [], probedAt: 0 },
    }
  })

  ipcMain.handle('files:pick', async () => {
    const res = await dialog.showOpenDialog({
      title: '选择视频文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '视频文件', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'ts', 'mpg', 'mpeg', '3gp', 'ogv'] },
        { name: '音频文件', extensions: ['mp3', 'aac', 'wav', 'flac', 'm4a', 'ogg', 'opus'] },
        { name: '全部文件', extensions: ['*'] },
      ],
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle('files:pickDir', async (_e, current?: string) => {
    const res = await dialog.showOpenDialog({
      title: '选择输出文件夹',
      defaultPath: current || app.getPath('videos'),
      properties: ['openDirectory', 'createDirectory'],
    })
    return res.canceled ? '' : res.filePaths[0]
  })

  ipcMain.handle('files:reveal', (_e, p: string) => {
    if (p && fs.existsSync(p)) shell.showItemInFolder(p)
  })

  ipcMain.handle('media:probe', async (_e, p: string) => probeMedia(p))

  ipcMain.handle('media:thumb', async (_e, p: string) => {
    const info = await probeMedia(p)
    return buildThumbnails(info)
  })

  ipcMain.handle('convert:start', async (_e, req: StartConvertRequest) => service.enqueue(req))
  ipcMain.handle('convert:cancel', (_e, id: string) => service.cancel(id))
  ipcMain.handle('convert:list', () => service.list())
  ipcMain.handle('convert:clear', () => service.clearFinished())

  ipcMain.handle('win:minimize', () => mainWindow?.minimize())
  ipcMain.handle('win:maximize', () => {
    if (!mainWindow) return
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  })
  ipcMain.handle('win:close', () => mainWindow?.close())
}

/**
 * Headless end-to-end self test (runs without creating a window):
 * probe -> thumbnails -> full conversion through the real queue.
 * Writes test-results.json so CI / humans can inspect the outcome.
 */
async function runSelfTest(): Promise<void> {
  const results: Record<string, unknown> = { startedAt: new Date().toISOString() }
  const sample = path.join(app.getAppPath(), 'test-media', 'sample.mp4')
  const outDir = path.join(app.getAppPath(), 'test-output')

  try {
    const bins = resolveBins()
    const version = await ffmpegVersion()
    if (!version) throw new Error('FFmpeg not available')
    results.ffmpeg = version

    const t0 = Date.now()
    const info = await probeMedia(sample)
    results.probeMs = Date.now() - t0
    results.durationSec = info.durationSec
    results.video = info.video ? `${info.video.codec} ${info.video.width}x${info.video.height}` : null

    const t1 = Date.now()
    const thumbs = await buildThumbnails(info)
    results.thumbMs = Date.now() - t1
    const posterFile = path.join(app.getPath('userData'), 'thumbs', thumbs.poster.split('/').pop() ?? '')
    results.posterBytes = await fs.promises
      .stat(posterFile)
      .then((s) => s.size)
      .catch(() => -1)
    results.stripFrames = thumbs.frameCount

    conversions.on('update', (e) => {
      if (e.status === 'running') {
        process.stdout.write(`\r  progress ${(e.progress ?? 0).toFixed(1)}% speed ${e.speed?.toFixed(2)}x   `)
      }
    })

    const t2 = Date.now()
    const matrix: Array<{ label: string; opts: ConvertOptions }> = [
      { label: 'mp4-h264-720p', opts: { ...PRESET_DEFAULTS['mp4-h264'], resolution: '720', encoderPreset: 'veryfast' } },
      { label: 'gif', opts: { ...PRESET_DEFAULTS.gif, resolution: '480' } },
      { label: 'audio-mp3', opts: { ...PRESET_DEFAULTS['audio-mp3'] } },
      { label: 'webm-vp9-480p', opts: { ...PRESET_DEFAULTS['webm-vp9'], resolution: '480' } },
    ]

    const created: Array<{ label: string; id: string }> = []
    for (const m of matrix) {
      const job = await conversions.enqueue({ sourcePath: sample, outputDir: outDir, options: m.opts })
      created.push({ label: m.label, id: job.id })
    }

    await new Promise<void>((resolve) => {
      const deadline = Date.now() + 240_000
      const timer = setInterval(() => {
        const allDone = created.every(({ id }) => {
          const j = conversions.get(id)
          return j && ['done', 'error', 'cancelled'].includes(j.status)
        })
        if (allDone || Date.now() > deadline) {
          clearInterval(timer)
          resolve()
        }
      }, 300)
    })

    results.convertMs = Date.now() - t2
    const rows: Array<Record<string, unknown>> = []
    for (const { label, id } of created) {
      const j = conversions.get(id)
      if (!j) continue
      const row: Record<string, unknown> = {
        label,
        status: j.status,
        outputSize: j.outputSize,
        error: j.error,
        warning: j.warning,
        ms: (j.finishedAt ?? 0) - (j.startedAt ?? 0),
        command: j.command,
      }
      if (j.status === 'done') {
        const outInfo = await probeMedia(j.outputPath)
        row.output = `${outInfo.container} / ${
          outInfo.video ? `${outInfo.video.codec} ${outInfo.video.width}x${outInfo.video.height}` : 'audio only'
        }`
      }
      rows.push(row)
    }
    results.matrix = rows
  } catch (err) {
    results.fatal = String((err as Error).stack ?? err)
  }

  fs.writeFileSync(path.join(app.getAppPath(), 'test-results.json'), JSON.stringify(results, null, 2))
  console.log('\nSELFTEST_DONE')
  app.exit(0)
}

/* --------------------------------------------------------------------- boot */

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    registerProtocol()
    registerIpc()
    if (hardwareCache) conversions.setHardware(hardwareCache)

    if (selfTestMode) {
      await runSelfTest()
      return
    }

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
