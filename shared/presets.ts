import type { ConvertOptions, PresetId } from './types'

/** Short suffix appended to output filenames. */
export const PRESET_TAGS: Record<PresetId, string> = {
  'mp4-h264': 'x264',
  'mp4-hevc': 'hevc',
  'webm-vp9': 'vp9',
  gif: 'gif',
  'audio-mp3': 'mp3',
  custom: 'out',
}

export const CONTAINER_EXT: Record<string, string> = {
  mp4: '.mp4',
  mkv: '.mkv',
  webm: '.webm',
  gif: '.gif',
  mp3: '.mp3',
  m4a: '.m4a',
}

/**
 * Presets are plain data so both the renderer (UI cards) and the main process
 * (argv builder) can agree on the same defaults without duplicating them.
 */
export const PRESET_DEFAULTS: Record<PresetId, ConvertOptions> = {
  'mp4-h264': {
    presetId: 'mp4-h264',
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    quality: 20,
    encoderPreset: 'medium',
    resolution: 'source',
    audioBitrate: 192,
    hardwareAccel: false,
    extraArgs: '',
  },
  'mp4-hevc': {
    presetId: 'mp4-hevc',
    container: 'mp4',
    videoCodec: 'libx265',
    audioCodec: 'aac',
    quality: 26,
    encoderPreset: 'medium',
    resolution: 'source',
    audioBitrate: 160,
    hardwareAccel: false,
    extraArgs: '',
  },
  'webm-vp9': {
    presetId: 'webm-vp9',
    container: 'webm',
    videoCodec: 'libvpx-vp9',
    audioCodec: 'libopus',
    quality: 32,
    encoderPreset: 'good',
    resolution: 'source',
    audioBitrate: 128,
    hardwareAccel: false,
    extraArgs: '',
  },
  gif: {
    presetId: 'gif',
    container: 'gif',
    videoCodec: 'libx264',
    audioCodec: 'none',
    quality: 20,
    encoderPreset: 'medium',
    resolution: '480',
    audioBitrate: 128,
    hardwareAccel: false,
    extraArgs: '',
  },
  'audio-mp3': {
    presetId: 'audio-mp3',
    container: 'mp3',
    videoCodec: 'none',
    audioCodec: 'libmp3lame',
    quality: 20,
    encoderPreset: 'medium',
    resolution: 'source',
    audioBitrate: 192,
    hardwareAccel: false,
    extraArgs: '',
  },
  custom: {
    presetId: 'custom',
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    quality: 23,
    encoderPreset: 'medium',
    resolution: 'source',
    audioBitrate: 160,
    hardwareAccel: false,
    extraArgs: '',
  },
}
