import type { ConvertOptions, HardwareInfo, PresetId } from '../../shared/types'
import {
  AUDIO_CODECS,
  CONTAINERS,
  ENCODER_PRESETS,
  PRESETS,
  RESOLUTIONS,
  VIDEO_CODECS,
} from '../lib/presets'
import { shortPath } from '../lib/format'
import { IconBolt, IconChevron, IconCpu, IconFolder } from './Icons'

interface Props {
  options: ConvertOptions
  activePreset: PresetId | null
  presetHint: string
  outputDir: string
  hasSelection: boolean
  assetCount: number
  hardware: HardwareInfo | null
  onApplyPreset: (id: PresetId) => void
  onPatch: (p: Partial<ConvertOptions>) => void
  onChooseOutput: () => void
  onStart: () => void
  onStartAll: () => void
}

const AUDIO_BITRATES = [64, 96, 128, 160, 192, 256, 320]

export function SettingsPanel({
  options,
  activePreset,
  presetHint,
  outputDir,
  hasSelection,
  assetCount,
  hardware,
  onApplyPreset,
  onPatch,
  onChooseOutput,
  onStart,
  onStartAll,
}: Props) {
  const isCustom = activePreset === 'custom'
  const isAudioOnly = options.videoCodec === 'none'
  const qualityMax = options.videoCodec === 'libvpx-vp9' || options.videoCodec === 'libsvtav1' ? 63 : 51
  const hwReady = Boolean(hardware && hardware.workingEncoders.length > 0)
  const canUseHw = !isAudioOnly && options.videoCodec !== 'copy'

  return (
    <section className="pane pane-right">
      <div className="pane-head">
        <div className="pane-title">
          <IconBolt size={13} />
          转换设置
        </div>
      </div>

      <div className="settings-scroll">
        <div>
          <div className="field-label">输出格式</div>
          <div className="preset-grid">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                className={`preset${activePreset === p.id ? ' active' : ''}`}
                onClick={() => onApplyPreset(p.id)}
              >
                <div className="preset-top">
                  <span className="preset-title">{p.title}</span>
                  <span className="preset-dot" style={{ background: p.accent }} />
                </div>
                <div className="preset-sub">{p.subtitle}</div>
              </button>
            ))}
          </div>
          {presetHint && <div className="preset-hint">{presetHint}</div>}
        </div>

        {isCustom && (
          <div className="fade-in">
            <div className="field-label">容器 / 编码</div>
            <div className="row-2" style={{ marginBottom: 8 }}>
              <select
                className="select"
                value={options.container}
                onChange={(e) => onPatch({ container: e.target.value as ConvertOptions['container'] })}
              >
                {CONTAINERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={options.videoCodec}
                onChange={(e) => onPatch({ videoCodec: e.target.value as ConvertOptions['videoCodec'] })}
              >
                {VIDEO_CODECS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <select
              className="select"
              value={options.audioCodec}
              onChange={(e) => onPatch({ audioCodec: e.target.value as ConvertOptions['audioCodec'] })}
            >
              {AUDIO_CODECS.map((c) => (
                <option key={c.id} value={c.id}>
                  音频：{c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isAudioOnly && options.videoCodec !== 'copy' && (
          <div>
            <div className="field-label">
              画质
              <span className="right">CRF {options.quality} · 越小越清晰</span>
            </div>
            <div className="range-row">
              <input
                type="range"
                min={0}
                max={qualityMax}
                step={1}
                value={options.quality}
                onChange={(e) => onPatch({ quality: Number(e.target.value) })}
              />
              <span className="value-chip">{options.quality}</span>
            </div>
            <div className="range-hint">
              <span>高画质 / 大体积</span>
              <span>低画质 / 小体积</span>
            </div>
          </div>
        )}

        {!isAudioOnly && (
          <div>
            <div className="field-label">分辨率</div>
            <select
              className="select"
              value={options.resolution}
              onChange={(e) => onPatch({ resolution: e.target.value as ConvertOptions['resolution'] })}
            >
              {RESOLUTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isAudioOnly && (options.videoCodec === 'libx264' || options.videoCodec === 'libx265') && (
          <div>
            <div className="field-label">编码速度</div>
            <select
              className="select"
              value={options.encoderPreset}
              onChange={(e) => onPatch({ encoderPreset: e.target.value })}
            >
              {ENCODER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {options.audioCodec !== 'none' && options.audioCodec !== 'copy' && (
          <div>
            <div className="field-label">音频码率</div>
            <select
              className="select"
              value={options.audioBitrate}
              onChange={(e) => onPatch({ audioBitrate: Number(e.target.value) })}
            >
              {AUDIO_BITRATES.map((b) => (
                <option key={b} value={b}>
                  {b} kbps
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="field-label">
            <IconCpu size={12} />
            硬件加速
          </div>
          <div className={`switch-row${!hwReady || !canUseHw ? ' disabled' : ''}`}>
            <div className="switch-text">
              <div className="switch-title">
                使用 GPU 编码
                {hwReady && (
                  <span className="badge-soft badge-ok">{hardware!.vendor}</span>
                )}
              </div>
              <div className="switch-desc">
                {!canUseHw
                  ? '当前输出无视频流'
                  : hwReady
                    ? hardware!.workingEncoders.join(' / ')
                    : '未检测到可用硬件编码器'}
              </div>
            </div>
            <button
              className={`switch${options.hardwareAccel && hwReady && canUseHw ? ' on' : ''}`}
              disabled={!hwReady || !canUseHw}
              onClick={() => onPatch({ hardwareAccel: !options.hardwareAccel })}
              aria-label="切换硬件加速"
            />
          </div>
        </div>

        <div>
          <div className="field-label">
            <IconFolder size={12} />
            输出位置
          </div>
          <div className="output-row" onClick={onChooseOutput} title={outputDir || '与源文件相同的文件夹'}>
            <IconFolder size={14} />
            <span className="output-path">{outputDir ? shortPath(outputDir) : '与源文件相同的文件夹'}</span>
            <IconChevron size={13} style={{ transform: 'rotate(-90deg)' }} />
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <div className="summary-line">
          <span>
            {options.container.toUpperCase()} · {options.videoCodec === 'none' ? '仅音频' : options.videoCodec.replace('lib', '').toUpperCase()} ·{' '}
            {options.resolution === 'source' ? '原分辨率' : `${options.resolution}p`}
          </span>
          <span>{options.hardwareAccel && hwReady ? 'GPU 加速' : 'CPU 编码'}</span>
        </div>

        <button className="btn-primary" disabled={!hasSelection} onClick={onStart}>
          开始转换
          <span style={{ opacity: 0.7, fontSize: 11, fontWeight: 500 }}>Ctrl+↵</span>
        </button>

        {assetCount > 1 && (
          <button className="btn-ghost" onClick={onStartAll} disabled={!hasSelection}>
            批量转换全部 {assetCount} 个素材
          </button>
        )}
      </div>
    </section>
  )
}
