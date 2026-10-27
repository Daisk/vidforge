import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type {
  ConvertJob,
  ConvertOptions,
  HardwareInfo,
  MediaInfo,
  ProgressEvent,
  StartConvertRequest,
} from '../../shared/types'
import { CONTAINER_EXT, PRESET_TAGS } from '../../shared/presets'
import { killTree, resolveBins, spawnFfmpegProgress } from './ffmpeg'
import { probeMedia } from './probe'

/* ------------------------------------------------------- command construction */

function hwEncoderFor(codec: string, hw: HardwareInfo | null): string | null {
  if (!hw || hw.workingEncoders.length === 0) return null
  const family = codec === 'libx265' ? 'hevc' : 'h264'
  const order = ['nvenc', 'qsv', 'amf', 'videotoolbox']
  for (const suffix of order) {
    const id = `${family}_${suffix}`
    if (hw.workingEncoders.includes(id)) return id
  }
  return null
}

/** Split a user-supplied extra-args string the way a shell would, without invoking one. */
function splitExtraArgs(raw: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out.filter(Boolean)
}

/**
 * Turn user-facing options into a single FFmpeg argv.
 * Every branch is deterministic and inspectable — the UI shows the exact command.
 */
export function buildArgs(
  source: string,
  output: string,
  opts: ConvertOptions,
  media: MediaInfo,
  hw: HardwareInfo | null,
): string[] {
  const args: string[] = ['-hide_banner', '-y', '-progress', 'pipe:1', '-nostats', '-i', source]

  // ---- GIF needs a dedicated palette pipeline; two encodes in one filtergraph
  if (opts.container === 'gif') {
    const fps = media.video?.fps && media.video.fps > 30 ? 12 : 15
    const width = opts.resolution === 'source' ? 480 : Math.min(Number(opts.resolution), 720)
    const filter =
      `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];` +
      `[a]palettegen=max_colors=256:stats_mode=diff[p];` +
      `[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle`
    args.push('-filter_complex', filter, '-loop', '0')
    if (opts.extraArgs.trim()) args.push(...splitExtraArgs(opts.extraArgs))
    args.push(output)
    return args
  }

  // ---- video
  if (opts.videoCodec === 'copy') {
    args.push('-c:v', 'copy')
  } else if (opts.videoCodec !== 'none') {
    let codec: string = opts.videoCodec
    if (opts.hardwareAccel) {
      const hwId = hwEncoderFor(opts.videoCodec, hw)
      if (hwId) codec = hwId
    }

    if (opts.resolution !== 'source') {
      args.push('-vf', `scale=-2:${opts.resolution}:flags=lanczos`)
    }

    args.push('-c:v', codec)

    if (codec.endsWith('_nvenc')) {
      args.push('-preset', 'p5', '-rc', 'vbr', '-cq', String(opts.quality), '-b:v', '0')
    } else if (codec.endsWith('_qsv')) {
      args.push('-global_quality', String(opts.quality))
    } else if (codec.endsWith('_amf')) {
      args.push('-rc', 'cqp', '-qp_i', String(opts.quality), '-qp_p', String(opts.quality), '-quality', 'balanced')
    } else if (codec.endsWith('_videotoolbox')) {
      args.push('-q:v', String(Math.max(1, Math.round((51 - opts.quality) / 5))))
    } else if (codec === 'libvpx-vp9') {
      args.push('-crf', String(opts.quality), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2')
    } else if (codec === 'libsvtav1') {
      args.push('-crf', String(opts.quality), '-preset', '6')
    } else {
      // libx264 / libx265
      args.push('-preset', opts.encoderPreset, '-crf', String(opts.quality), '-pix_fmt', 'yuv420p')
      if (codec === 'libx264') args.push('-profile:v', 'high')
      if (codec === 'libx265') args.push('-tag:v', 'hvc1')
    }
  } else {
    args.push('-vn')
  }

  // ---- audio
  if (opts.audioCodec === 'none') {
    args.push('-an')
  } else if (opts.audioCodec === 'copy') {
    args.push('-c:a', 'copy')
  } else if (media.audioCount === 0) {
    // nothing to encode — avoid ffmpeg failing on a missing stream
    args.push('-an')
  } else {
    args.push('-c:a', opts.audioCodec, '-b:a', `${opts.audioBitrate}k`)
    if (opts.audioCodec === 'aac') args.push('-ac', '2')
  }

  // ---- container specifics
  if (opts.container === 'mp4' || opts.container === 'm4a') {
    args.push('-movflags', '+faststart')
  }

  // keep the first video/audio stream only — predictable, small, matches user intent
  if (opts.videoCodec === 'none') args.push('-map', '0:a:0?')
  else args.push('-map', '0:v:0?', '-map', '0:a:0?')

  if (opts.extraArgs.trim()) args.push(...splitExtraArgs(opts.extraArgs))

  args.push(output)
  return args
}

/* --------------------------------------------------------------- output path */

function uniqueOutputPath(dir: string, base: string, ext: string): string {
  let candidate = path.join(dir, `${base}${ext}`)
  let i = 1
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${i})${ext}`)
    i += 1
  }
  return candidate
}

/* -------------------------------------------------------------------- service */

export class ConversionService extends EventEmitter {
  private jobs = new Map<string, ConvertJob>()
  private order: string[] = []
  private running: { id: string; child: ChildProcess; cancelled: boolean } | null = null
  private hardware: HardwareInfo | null = null

  setHardware(hw: HardwareInfo | null): void {
    this.hardware = hw
  }

  list(): ConvertJob[] {
    return this.order.map((id) => this.jobs.get(id)!).filter(Boolean)
  }

  get(id: string): ConvertJob | undefined {
    return this.jobs.get(id)
  }

  private emitUpdate(job: ConvertJob): void {
    const payload: ProgressEvent = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      speed: job.speed,
      fps: job.fps,
      outTimeSec: job.outTimeSec,
      etaSec: job.etaSec,
      outputSize: job.outputSize,
      error: job.error,
      outputPath: job.outputPath,
      finishedAt: job.finishedAt,
    }
    this.emit('update', payload)
  }

  async enqueue(req: StartConvertRequest): Promise<ConvertJob> {
    const media = await probeMedia(req.sourcePath)
    const ext = CONTAINER_EXT[req.options.container] ?? '.mp4'
    const tag = PRESET_TAGS[req.options.presetId] ?? 'out'
    const base = `${path.parse(req.sourcePath).name}_${tag}`
    const outputDir = req.outputDir || path.dirname(req.sourcePath)
    fs.mkdirSync(outputDir, { recursive: true })
    const outputPath = uniqueOutputPath(outputDir, base, ext)

    const job: ConvertJob = {
      id: crypto.randomUUID(),
      sourcePath: req.sourcePath,
      sourceName: path.basename(req.sourcePath),
      outputPath,
      options: req.options,
      status: 'queued',
      progress: 0,
      speed: 0,
      fps: 0,
      outTimeSec: 0,
      durationSec: media.durationSec,
      etaSec: 0,
      outputSize: 0,
      sourceSize: media.sizeBytes,
      createdAt: Date.now(),
    }

    this.jobs.set(job.id, job)
    this.order.push(job.id)
    this.emitUpdate(job)
    void this.pump()
    return job
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id)
    if (!job) return false
    if (job.status === 'queued') {
      job.status = 'cancelled'
      job.finishedAt = Date.now()
      this.emitUpdate(job)
      return true
    }
    if (this.running && this.running.id === id) {
      this.running.cancelled = true
      killTree(this.running.child)
      return true
    }
    return false
  }

  clearFinished(): void {
    for (const id of [...this.order]) {
      const job = this.jobs.get(id)
      if (job && ['done', 'error', 'cancelled'].includes(job.status)) {
        this.jobs.delete(id)
        this.order = this.order.filter((x) => x !== id)
      }
    }
  }

  private async pump(): Promise<void> {
    if (this.running) return
    const next = this.order.map((id) => this.jobs.get(id)!).find((j) => j && j.status === 'queued')
    if (!next) return

    const media = await probeMedia(next.sourcePath)
    const args = buildArgs(next.sourcePath, next.outputPath, next.options, media, this.hardware)
    next.command = `${path.basename(resolveBins().ffmpeg)} ${args.map(quote).join(' ')}`
    await this.runJob(next, media, args)
    void this.pump()
  }

  private runJob(job: ConvertJob, media: MediaInfo, args: string[]): Promise<void> {
    return new Promise((resolve) => {
      const duration = job.durationSec || media.durationSec || 0
      job.status = 'running'
      job.startedAt = Date.now()
      this.emitUpdate(job)

      const { child, done } = spawnFfmpegProgress(args)
      const run = { id: job.id, child, cancelled: false }
      this.running = run

      let buffer = ''
      let lastEmit = 0

      child.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        let dirty = false
        for (const line of lines) {
          const idx = line.indexOf('=')
          if (idx < 0) continue
          const key = line.slice(0, idx).trim()
          const value = line.slice(idx + 1).trim()

          if (key === 'out_time_us' || key === 'out_time_ms') {
            const us = Number(value)
            if (Number.isFinite(us) && us >= 0) {
              job.outTimeSec = us / 1_000_000
              dirty = true
            }
          } else if (key === 'out_time') {
            const t = parseTimecode(value)
            if (t > 0) {
              job.outTimeSec = t
              dirty = true
            }
          } else if (key === 'speed') {
            const s = Number.parseFloat(value.replace('x', ''))
            if (Number.isFinite(s)) job.speed = s
          } else if (key === 'fps') {
            const f = Number.parseFloat(value)
            if (Number.isFinite(f)) job.fps = f
          } else if (key === 'total_size') {
            const b = Number(value)
            if (Number.isFinite(b)) job.outputSize = b
          } else if (key === 'progress' && value === 'end') {
            job.outTimeSec = duration
            dirty = true
          }
        }

        if (dirty && duration > 0) {
          job.progress = Math.min(99.4, (job.outTimeSec / duration) * 100)
          job.etaSec = job.speed > 0.01 ? Math.max(0, (duration - job.outTimeSec) / job.speed) : 0
          const now = Date.now()
          if (now - lastEmit > 120) {
            lastEmit = now
            this.emitUpdate(job)
          }
        }
      })

      child.on('close', async (code) => {
        this.running = null
        const { stderr } = await done

        if (run.cancelled) {
          job.status = 'cancelled'
          job.finishedAt = Date.now()
          this.emitUpdate(job)
          await safeUnlink(job.outputPath)
          resolve()
          return
        }

        if (code === 0) {
          try {
            const st = await fs.promises.stat(job.outputPath)
            job.outputSize = st.size
          } catch {
            /* ignore */
          }
          job.status = 'done'
          job.progress = 100
          job.etaSec = 0
          job.finishedAt = Date.now()
          this.emitUpdate(job)
          resolve()
          return
        }

        // Hardware encoders fail at runtime more often than you'd expect
        // (driver mismatch, session limits, unsupported profiles).
        // Detect it from stderr and transparently fall back to software once.
        const usedHwEncoder = args.some((a) => /_nvenc|_qsv|_amf|_videotoolbox/.test(a))
        const hwError = /nvenc|qsv|amf|videotoolbox|cuda|hardware device|No capable devices|Device creation failed/i.test(stderr)
        if (job.options.hardwareAccel && usedHwEncoder && hwError) {
          const softArgs = buildArgs(
            job.sourcePath,
            job.outputPath,
            { ...job.options, hardwareAccel: false },
            media,
            null,
          )
          job.options = { ...job.options, hardwareAccel: false }
          job.warning = '硬件编码不可用，已自动降级为软件编码'
          job.progress = 0
          this.emitUpdate(job)
          await safeUnlink(job.outputPath)
          this.runJob(job, media, softArgs).then(resolve)
          return
        }

        job.status = 'error'
        job.error = humanizeError(stderr)
        job.finishedAt = Date.now()
        this.emitUpdate(job)
        resolve()
      })
    })
  }
}

/* -------------------------------------------------------------------- helpers */

function quote(s: string): string {
  return /[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s
}

function parseTimecode(v: string): number {
  const m = /(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(v)
  if (!m) return 0
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

async function safeUnlink(p: string): Promise<void> {
  try {
    await fs.promises.unlink(p)
  } catch {
    /* ignore */
  }
}

/** Turn FFmpeg's stderr soup into something a human can act on. */
function humanizeError(stderr: string): string {
  const s = (stderr || '').toLowerCase()
  if (/no such file or directory/.test(s)) return '源文件不存在或无法读取'
  if (/invalid data found|moov atom not found/.test(s)) return '文件内容损坏或不是有效的视频文件'
  if (/unknown encoder/.test(s)) return '当前 FFmpeg 版本不支持该编码器'
  if (/permission denied/.test(s)) return '没有写入权限，请更换输出目录'
  if (/no space left/.test(s)) return '磁盘空间不足'
  if (/does not support/.test(s)) return '该容器不支持所选编码，请更换格式'
  const tail = (stderr || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-3)
    .join(' ')
  return tail || '转换失败，请查看日志'
}
