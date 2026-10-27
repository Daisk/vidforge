import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { HardwareInfo } from '../../shared/types'
import { runCapture } from './ffmpeg'

const CANDIDATES: Array<{ id: string; vendor: string; family: 'h264' | 'hevc' }> = [
  { id: 'h264_nvenc', vendor: 'NVIDIA', family: 'h264' },
  { id: 'hevc_nvenc', vendor: 'NVIDIA', family: 'hevc' },
  { id: 'h264_qsv', vendor: 'Intel', family: 'h264' },
  { id: 'hevc_qsv', vendor: 'Intel', family: 'hevc' },
  { id: 'h264_amf', vendor: 'AMD', family: 'h264' },
  { id: 'hevc_amf', vendor: 'AMD', family: 'hevc' },
  { id: 'h264_videotoolbox', vendor: 'Apple', family: 'h264' },
  { id: 'hevc_videotoolbox', vendor: 'Apple', family: 'hevc' },
]

function cacheFile(): string {
  return path.join(app.getPath('userData'), 'hardware.json')
}

export function readCachedHardware(): HardwareInfo | null {
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFile(), 'utf8')) as HardwareInfo
    // re-probe once a day at most
    if (Date.now() - raw.probedAt < 24 * 3600 * 1000) return raw
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Listing encoders is not proof that a GPU encoder works — NVENC/QSV/AMF all
 * fail at runtime on unsupported drivers or when the GPU is blacklisted.
 * So we run a real 0.2s encode against a synthetic source for each candidate.
 */
export async function probeHardware(ffmpegBin: string): Promise<HardwareInfo> {
  let encodersOut = ''
  try {
    encodersOut = await runCapture(ffmpegBin, ['-hide_banner', '-encoders'], 15_000)
  } catch {
    return { vendor: 'unknown', workingEncoders: [], probedAt: Date.now() }
  }

  const present = CANDIDATES.filter((c) => new RegExp(`\\b${c.id}\\b`).test(encodersOut))

  const results = await Promise.all(
    present.map(async (c) => {
      try {
        await runCapture(
          ffmpegBin,
          [
            '-hide_banner', '-loglevel', 'error',
            '-f', 'lavfi', '-i', 'color=c=black:s=256x144:r=25',
            '-t', '0.2',
            '-c:v', c.id,
            '-f', 'null', '-',
          ],
          20_000,
        )
        return c
      } catch {
        return null
      }
    }),
  )

  const working = results.filter((r): r is NonNullable<typeof r> => r !== null)
  const vendor = working[0]?.vendor ?? 'unknown'
  const info: HardwareInfo = {
    vendor,
    workingEncoders: working.map((w) => w.id),
    probedAt: Date.now(),
  }

  try {
    fs.writeFileSync(cacheFile(), JSON.stringify(info))
  } catch {
    /* non fatal */
  }
  return info
}
