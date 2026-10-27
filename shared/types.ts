/**
 * Types shared between the Electron main process and the React renderer.
 * Kept dependency-free so both tsconfig projects can compile it.
 */

export type StreamKind = 'video' | 'audio' | 'subtitle' | 'data'

export interface StreamInfo {
  index: number
  kind: StreamKind
  codec: string
  codecLong?: string
  profile?: string
  width?: number
  height?: number
  fps?: number
  bitrate?: number
  sampleRate?: number
  channels?: number
  channelLayout?: string
  pixelFormat?: string
  language?: string
  title?: string
  durationSec?: number
  isDefault?: boolean
}

export interface MediaInfo {
  path: string
  name: string
  ext: string
  sizeBytes: number
  container: string
  durationSec: number
  bitrate: number
  streams: StreamInfo[]
  video?: StreamInfo
  audio?: StreamInfo
  audioCount: number
  subtitleCount: number
  createdAt: number
  /** true when the Chromium <video> tag can probably decode this file natively */
  nativelyPlayable: boolean
}

export interface ThumbSet {
  /** single "best" frame, 960px wide */
  poster: string
  /** N frames tiled horizontally into one image (cheap timeline filmstrip) */
  strip: string
  frameCount: number
  frameWidth: number
  frameHeight: number
  timestamps: number[]
  cached: boolean
}

export type PresetId = 'mp4-h264' | 'mp4-hevc' | 'webm-vp9' | 'gif' | 'audio-mp3' | 'custom'

export type ContainerId = 'mp4' | 'mkv' | 'webm' | 'gif' | 'mp3' | 'm4a'
export type VideoCodecId = 'libx264' | 'libx265' | 'libvpx-vp9' | 'libsvtav1' | 'copy' | 'none'
export type AudioCodecId = 'aac' | 'libmp3lame' | 'libopus' | 'copy' | 'none'
export type ResolutionId = 'source' | '2160' | '1440' | '1080' | '720' | '480'

export interface ConvertOptions {
  presetId: PresetId
  container: ContainerId
  videoCodec: VideoCodecId
  audioCodec: AudioCodecId
  /** quality value; for x264/x265 this is CRF, for VP9 a constant-quality value */
  quality: number
  /** encoder speed preset (x264/x265 only) */
  encoderPreset: string
  resolution: ResolutionId
  audioBitrate: number
  hardwareAccel: boolean
  extraArgs: string
}

export interface StartConvertRequest {
  sourcePath: string
  outputDir: string
  options: ConvertOptions
}

export type JobStatus = 'queued' | 'probing' | 'running' | 'done' | 'error' | 'cancelled'

export interface ConvertJob {
  id: string
  sourcePath: string
  sourceName: string
  outputPath: string
  options: ConvertOptions
  status: JobStatus
  progress: number
  speed: number
  fps: number
  outTimeSec: number
  durationSec: number
  etaSec: number
  outputSize: number
  sourceSize: number
  error?: string
  warning?: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  command?: string
}

export interface HardwareInfo {
  vendor: string
  /** encoder ids that actually produced a valid test encode */
  workingEncoders: string[]
  probedAt: number
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  ffmpegPath: string
  ffmpegVersion: string
  ffprobePath: string
  ffmpegFound: boolean
  platform: string
  defaultOutputDir: string
  hardware: HardwareInfo
}

export interface ProgressEvent {
  id: string
  status: JobStatus
  progress: number
  speed: number
  fps: number
  outTimeSec: number
  etaSec: number
  outputSize: number
  error?: string
  outputPath?: string
  finishedAt?: number
}
