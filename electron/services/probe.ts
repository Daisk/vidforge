import path from 'node:path'
import fs from 'node:fs'
import type { MediaInfo, StreamInfo, StreamKind } from '../../shared/types'
import { resolveBins, runCapture } from './ffmpeg'

interface RawStream {
  index: number
  codec_type?: string
  codec_name?: string
  codec_long_name?: string
  profile?: string
  width?: number
  height?: number
  r_frame_rate?: string
  avg_frame_rate?: string
  bit_rate?: string
  sample_rate?: string
  channels?: number
  channel_layout?: string
  pix_fmt?: string
  duration?: string
  disposition?: Record<string, number>
  tags?: Record<string, string>
}

interface RawProbe {
  streams?: RawStream[]
  format?: {
    filename?: string
    format_name?: string
    format_long_name?: string
    duration?: string
    size?: string
    bit_rate?: string
  }
}

function ratioToNumber(r?: string): number | undefined {
  if (!r) return undefined
  const [a, b] = r.split('/').map(Number)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return undefined
  const v = a / b
  return Number.isFinite(v) && v > 0 ? Math.round(v * 1000) / 1000 : undefined
}

function toNum(v?: string | number): number | undefined {
  if (v == null) return undefined
  const n = typeof v === 'number' ? v : Number.parseFloat(v)
  return Number.isFinite(n) ? n : undefined
}

/** Containers Chromium can demux + codecs it can decode. Used to decide preview strategy. */
const PLAYABLE_CONTAINERS = /(mp4|mov|m4v|webm|ogv|ogg|matroska)/
const PLAYABLE_VIDEO = /^(h264|hevc|vp8|vp9|av1|theora|mpeg4)$/
const PLAYABLE_AUDIO = /^(aac|mp3|opus|vorbis|flac|pcm_s16le)$/

export async function probeMedia(filePath: string): Promise<MediaInfo> {
  const { ffprobe } = resolveBins()
  const out = await runCapture(ffprobe, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ])

  let raw: RawProbe
  try {
    raw = JSON.parse(out.slice(out.indexOf('{'))) as RawProbe
  } catch {
    throw new Error('无法解析视频信息，文件可能已损坏或不是有效的视频文件')
  }

  const stat = await fs.promises.stat(filePath)
  const durationSec = toNum(raw.format?.duration) ?? 0

  const streams: StreamInfo[] = (raw.streams ?? [])
    .map((s) => {
      const kind = (s.codec_type ?? 'data') as StreamKind
      const info: StreamInfo = {
        index: s.index,
        kind,
        codec: s.codec_name ?? 'unknown',
        codecLong: s.codec_long_name,
        profile: s.profile,
        width: s.width,
        height: s.height,
        fps: ratioToNumber(s.avg_frame_rate) || ratioToNumber(s.r_frame_rate),
        bitrate: toNum(s.bit_rate),
        sampleRate: toNum(s.sample_rate),
        channels: s.channels,
        channelLayout: s.channel_layout,
        pixelFormat: s.pix_fmt,
        durationSec: toNum(s.duration),
        language: s.tags?.language,
        title: s.tags?.title,
        isDefault: (s.disposition?.default ?? 0) > 0,
      }
      return info
    })
    .filter((s) => s.kind === 'video' || s.kind === 'audio' || s.kind === 'subtitle')

  const video = streams.find((s) => s.kind === 'video' && (s.width ?? 0) > 0)
  const audio = streams.find((s) => s.kind === 'audio')

  // ffprobe reports format GROUPS ("mov,mp4,m4a,3gp,3g2,mj2"), so prefer the real
  // extension when it belongs to that group; otherwise keep the first alias.
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const formats = (raw.format?.format_name ?? ext).split(',')
  const ALIAS: Record<string, string> = { matroska: 'mkv', asf: 'wmv', mpegts: 'ts' }
  const container = formats.includes(ext) ? ext : (ALIAS[formats[0]] ?? formats[0])
  const nativelyPlayable =
    PLAYABLE_CONTAINERS.test(container) &&
    !!video &&
    PLAYABLE_VIDEO.test(video.codec) &&
    (!audio || PLAYABLE_AUDIO.test(audio.codec))

  return {
    path: filePath,
    name: path.basename(filePath),
    ext,
    sizeBytes: stat.size,
    container,
    durationSec,
    bitrate: toNum(raw.format?.bit_rate) ?? 0,
    streams,
    video,
    audio,
    audioCount: streams.filter((s) => s.kind === 'audio').length,
    subtitleCount: streams.filter((s) => s.kind === 'subtitle').length,
    createdAt: Date.now(),
    nativelyPlayable,
  }
}
