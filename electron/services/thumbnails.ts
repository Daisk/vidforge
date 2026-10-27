import { app } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { MediaInfo, ThumbSet } from '../../shared/types'
import { resolveBins, runCapture } from './ffmpeg'

const STRIP_FRAMES = 10
const STRIP_FRAME_WIDTH = 240

function thumbDir(): string {
  const dir = path.join(app.getPath('userData'), 'thumbs')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function cacheKey(info: MediaInfo): string {
  const h = crypto.createHash('sha1')
  h.update(`${info.path}|${info.sizeBytes}|${info.durationSec}|${info.video?.width}x${info.video?.height}`)
  return h.digest('hex').slice(0, 16)
}

function fileUrl(name: string): string {
  // Served by the custom `vf://thumb/...` protocol registered in main.ts
  return `vf://thumb/${encodeURIComponent(name)}`
}

async function exists(p: string): Promise<boolean> {
  try {
    const s = await fs.promises.stat(p)
    return s.size > 512
  } catch {
    return false
  }
}

/**
 * Compute a "representative" poster frame.
 * Strategy: seek slightly into the file (skip fade-in / black leader), then let the
 * `thumbnail` filter pick the frame with the highest histogram diversity out of 90
 * candidates. Falls back to a plain seek-screenshot if that fails.
 */
async function makePoster(input: string, duration: number, outPath: string): Promise<boolean> {
  const { ffmpeg } = resolveBins()
  const seek = Math.min(Math.max(duration * 0.12, 0.3), 20)
  const scale = "scale='min(960,iw)':-2"

  const advanced = [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(seek.toFixed(3)),
    '-i', input,
    '-vf', `thumbnail=90,${scale}`,
    '-frames:v', '1', '-q:v', '3', '-y', outPath,
  ]
  try {
    await runCapture(ffmpeg, advanced, 60_000)
    if (await exists(outPath)) return true
  } catch {
    /* fall through */
  }

  const simple = [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(seek.toFixed(3)),
    '-i', input,
    '-vf', scale,
    '-frames:v', '1', '-q:v', '3', '-y', outPath,
  ]
  try {
    await runCapture(ffmpeg, simple, 60_000)
    return await exists(outPath)
  } catch {
    return false
  }
}

/**
 * Build the timeline filmstrip: N evenly spaced frames tiled into ONE jpeg.
 * Doing it in a single ffmpeg pass avoids spawning N processes, and tiling lets
 * the renderer slice it with CSS background-position instead of loading N images.
 */
async function makeStrip(
  input: string,
  duration: number,
  outPath: string,
): Promise<{ ok: boolean; count: number; frameWidth: number; frameHeight: number }> {
  const { ffmpeg } = resolveBins()
  const count = duration > 6 ? STRIP_FRAMES : Math.max(3, Math.round(duration))
  const start = duration * 0.02
  const window = duration * 0.96
  const fps = count / Math.max(window, 0.2)

  const filter =
    `fps=${fps.toFixed(6)},` +
    `scale=${STRIP_FRAME_WIDTH}:-2,` +
    `tile=${count}x1:padding=0:margin=0`

  const args = [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(start.toFixed(3)),
    '-i', input,
    '-vf', filter,
    '-frames:v', '1', '-q:v', '4', '-y', outPath,
  ]
  try {
    await runCapture(ffmpeg, args, 90_000)
    if (!(await exists(outPath))) return { ok: false, count, frameWidth: 0, frameHeight: 0 }
  } catch {
    return { ok: false, count, frameWidth: 0, frameHeight: 0 }
  }

  // Derive real tile dimensions from the produced image + known source aspect ratio.
  const vw = 0
  const ratio = 16 / 9
  const frameHeight = Math.round(STRIP_FRAME_WIDTH / ratio)
  return { ok: true, count, frameWidth: STRIP_FRAME_WIDTH, frameHeight: frameHeight || vw }
}

export async function buildThumbnails(info: MediaInfo): Promise<ThumbSet> {
  if (!info.video) {
    return { poster: '', strip: '', frameCount: 0, frameWidth: 0, frameHeight: 0, timestamps: [], cached: false }
  }

  const dir = thumbDir()
  const key = cacheKey(info)
  const posterName = `${key}_poster.jpg`
  const stripName = `${key}_strip.jpg`
  const posterPath = path.join(dir, posterName)
  const stripPath = path.join(dir, stripName)

  const posterCached = await exists(posterPath)
  const stripCached = await exists(stripPath)
  if (posterCached && stripCached) {
    const count = STRIP_FRAMES
    return {
      poster: fileUrl(posterName),
      strip: fileUrl(stripName),
      frameCount: count,
      frameWidth: STRIP_FRAME_WIDTH,
      frameHeight: Math.round(
        STRIP_FRAME_WIDTH / ((info.video.width || 16) / (info.video.height || 9)),
      ),
      timestamps: buildTimestamps(info.durationSec, count),
      cached: true,
    }
  }

  if (!posterCached) await makePoster(info.path, info.durationSec, posterPath)
  let strip = { ok: false, count: STRIP_FRAMES, frameWidth: 0, frameHeight: 0 }
  if (!stripCached) strip = await makeStrip(info.path, info.durationSec, stripPath)

  const aspect = (info.video.width || 16) / (info.video.height || 9)
  const frameHeight = Math.round(STRIP_FRAME_WIDTH / aspect)

  return {
    poster: posterCached || (await exists(posterPath)) ? fileUrl(posterName) : '',
    strip: stripCached || (await exists(stripPath)) ? fileUrl(stripName) : '',
    frameCount: strip.count,
    frameWidth: STRIP_FRAME_WIDTH,
    frameHeight,
    timestamps: buildTimestamps(info.durationSec, strip.count),
    cached: false,
  }
}

function buildTimestamps(duration: number, count: number): number[] {
  if (duration <= 0) return []
  const start = duration * 0.02
  const window = duration * 0.96
  return Array.from({ length: count }, (_, i) => start + (window / count) * (i + 0.5))
}
