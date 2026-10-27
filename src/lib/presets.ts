import type { PresetId } from '../../shared/types'

export interface PresetMeta {
  id: PresetId
  title: string
  subtitle: string
  badge: string
  /** human readable one-liner shown under the grid */
  hint: string
  accent: string
}

export const PRESETS: PresetMeta[] = [
  {
    id: 'mp4-h264',
    title: 'MP4 · H.264',
    subtitle: '兼容性最好',
    badge: 'H.264',
    hint: '几乎所有设备、浏览器、剪辑软件都能直接播放，通用场景首选。',
    accent: '#4d8dff',
  },
  {
    id: 'mp4-hevc',
    title: 'MP4 · HEVC',
    subtitle: '体积更小',
    badge: 'H.265',
    hint: '同画质下体积比 H.264 小约 30%~50%，旧设备可能无法播放。',
    accent: '#8b6cff',
  },
  {
    id: 'webm-vp9',
    title: 'WebM · VP9',
    subtitle: '网页友好',
    badge: 'VP9',
    hint: '开源免专利，网页 <video> 直接可用，编码速度较慢。',
    accent: '#22c1c3',
  },
  {
    id: 'gif',
    title: 'GIF 动图',
    subtitle: '可直接分享',
    badge: 'GIF',
    hint: '两段式调色板量化，画面平滑无噪点，适合做表情包与预览图。',
    accent: '#f5a524',
  },
  {
    id: 'audio-mp3',
    title: '提取音频',
    subtitle: 'MP3',
    badge: 'MP3',
    hint: '只保留音轨，忽略画面，适合从视频里取出背景音乐。',
    accent: '#35d39a',
  },
  {
    id: 'custom',
    title: '自定义',
    subtitle: '完全手动',
    badge: 'CUSTOM',
    hint: '自由组合容器、编码器、质量与分辨率，适合有明确目标的场景。',
    accent: '#94a3b8',
  },
]

export const ENCODER_PRESETS = [
  { id: 'ultrafast', label: 'ultrafast · 最快' },
  { id: 'veryfast', label: 'veryfast' },
  { id: 'fast', label: 'fast' },
  { id: 'medium', label: 'medium · 均衡' },
  { id: 'slow', label: 'slow · 更小体积' },
  { id: 'veryslow', label: 'veryslow · 最慢' },
]

export const RESOLUTIONS = [
  { id: 'source', label: '保持原始分辨率' },
  { id: '2160', label: '4K · 2160p' },
  { id: '1440', label: '2K · 1440p' },
  { id: '1080', label: '1080p' },
  { id: '720', label: '720p' },
  { id: '480', label: '480p' },
] as const

export const VIDEO_CODECS = [
  { id: 'libx264', label: 'H.264 (libx264)' },
  { id: 'libx265', label: 'H.265 (libx265)' },
  { id: 'libvpx-vp9', label: 'VP9 (libvpx)' },
  { id: 'libsvtav1', label: 'AV1 (SVT-AV1)' },
  { id: 'copy', label: '直接复制（不重编码）' },
  { id: 'none', label: '不输出视频' },
] as const

export const AUDIO_CODECS = [
  { id: 'aac', label: 'AAC' },
  { id: 'libmp3lame', label: 'MP3' },
  { id: 'libopus', label: 'Opus' },
  { id: 'copy', label: '直接复制' },
  { id: 'none', label: '不输出音频' },
] as const

export const CONTAINERS = [
  { id: 'mp4', label: 'MP4' },
  { id: 'mkv', label: 'MKV' },
  { id: 'webm', label: 'WebM' },
  { id: 'm4a', label: 'M4A（仅音频）' },
  { id: 'mp3', label: 'MP3（仅音频）' },
  { id: 'gif', label: 'GIF' },
] as const
