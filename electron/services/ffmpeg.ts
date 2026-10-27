import { app } from 'electron'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface BinPaths {
  ffmpeg: string
  ffprobe: string
  found: boolean
}

let cached: BinPaths | null = null

function exeName(base: string): string {
  return process.platform === 'win32' ? `${base}.exe` : base
}

/**
 * Look for a bundled binary first (so the packaged app works on machines
 * without FFmpeg installed), then fall back to whatever is on PATH.
 */
function locate(base: 'ffmpeg' | 'ffprobe'): { bin: string; found: boolean } {
  const exe = exeName(base)
  const envKey = base === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH'
  const candidates = [
    process.env[envKey],
    path.join(process.resourcesPath || '', 'bin', exe),
    path.join(app.getAppPath(), 'bin', exe),
    path.join(app.getAppPath(), '..', 'bin', exe),
  ].filter((p): p is string => Boolean(p && p.length > 0))

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return { bin: c, found: true }
    } catch {
      /* ignore */
    }
  }
  // Last resort: rely on PATH resolution by the OS.
  return { bin: exe, found: false }
}

export function resolveBins(): BinPaths {
  if (cached) return cached
  const ffmpeg = locate('ffmpeg')
  const ffprobe = locate('ffprobe')
  cached = {
    ffmpeg: ffmpeg.bin,
    ffprobe: ffprobe.bin,
    found: ffmpeg.found || ffprobe.found,
  }
  return cached
}

let versionCache = ''

export async function ffmpegVersion(): Promise<string> {
  if (versionCache) return versionCache
  const { ffmpeg } = resolveBins()
  try {
    const out = await runCapture(ffmpeg, ['-hide_banner', '-version'])
    const first = out.split(/\r?\n/)[0] || ''
    // "ffmpeg version 7.0.2-full_build-www.gyan.dev Copyright ..." -> "7.0.2"
    const m = /version\s+([\d.]+)/i.exec(first)
    versionCache = m ? m[1] : first.replace(/^ffmpeg version\s*/i, '').split(' ')[0]
  } catch {
    versionCache = ''
  }
  return versionCache
}

/** Run a binary to completion and capture stdout+stderr. */
export function runCapture(bin: string, args: string[], timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const e = err as NodeJS.ErrnoException
          if (e.code === 'ENOENT') {
            reject(new Error(`未找到 ${path.basename(bin)}，请安装 FFmpeg 或将其放入项目的 bin/ 目录`))
            return
          }
          // FFmpeg writes progress/errors on stderr but still exits 0 on success,
          // so only reject on a real non-zero exit.
          const msg = (stderr || stdout || e.message || '').toString().trim()
          reject(new Error(msg.split(/\r?\n/).slice(-6).join('\n') || e.message))
          return
        }
        resolve(`${stdout}\n${stderr}`)
      },
    )
  })
}

export interface SpawnedRun {
  child: ChildProcess
  done: Promise<{ code: number | null; stderr: string }>
}

/**
 * Spawn FFmpeg with machine-readable progress on stdout.
 * `-progress pipe:1` emits key=value blocks we can parse for a smooth progress bar.
 */
export function spawnFfmpegProgress(args: string[]): SpawnedRun {
  const { ffmpeg } = resolveBins()
  const child = spawn(ffmpeg, args, { windowsHide: true })
  let stderrTail = ''

  child.stderr?.on('data', (buf: Buffer) => {
    stderrTail += buf.toString()
    if (stderrTail.length > 24_000) stderrTail = stderrTail.slice(-16_000)
  })

  const done = new Promise<{ code: number | null; stderr: string }>((resolve) => {
    child.on('error', (err) => resolve({ code: -1, stderr: String(err) }))
    child.on('close', (code) => resolve({ code, stderr: stderrTail }))
  })

  return { child, done }
}

/** Ask Windows to kill the whole process tree (ffmpeg can spawn helpers). */
export function killTree(child: ChildProcess): void {
  if (!child.pid) return
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    } catch {
      child.kill('SIGKILL')
    }
  } else {
    child.kill('SIGKILL')
  }
}
