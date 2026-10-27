import { useEffect, useRef, useState } from 'react'
import type { Asset } from '../App'
import { formatBitrate, formatBytes, formatDuration, formatFps } from '../lib/format'
import { IconFilm, IconPause, IconPlay } from './Icons'

interface Props {
  asset?: Asset
  onPick: () => void
  onToast: (kind: 'ok' | 'err' | 'info', title: string, desc?: string) => void
}

function toB64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function Stage({ asset, onPick, onToast }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setPlaying(false)
    setFailed(false)
  }, [asset?.key])

  if (!asset) {
    return (
      <main className="pane" style={{ background: 'var(--bg-0)' }}>
        <div className="empty">
          <div className="empty-icon">
            <IconFilm size={30} />
          </div>
          <h3>把视频拖进来，开始转换</h3>
          <p>
            支持 MP4 / MKV / MOV / AVI / WebM / FLV 等常见容器。
            <br />
            导入后自动解析视频信息、提取缩略图与时间轴预览。
          </p>
          <button className="btn-primary" style={{ height: 36, padding: '0 20px', marginTop: 4 }} onClick={onPick}>
            选择文件
          </button>
          <div className="kbd-row">
            <kbd>Ctrl</kbd>
            <span>+</span>
            <kbd>O</kbd>
            <span style={{ marginLeft: 4 }}>快速打开</span>
          </div>
        </div>
      </main>
    )
  }

  const { info, thumb } = asset
  const v = info.video
  const canPlay = info.nativelyPlayable && !failed
  const mediaUrl = `vf://media/${toB64Url(info.path)}`

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) {
      onToast('info', '该格式无法内置播放', '已使用缩略图预览；转换后即可用系统播放器打开')
      return
    }
    if (el.paused) void el.play()
    else el.pause()
  }

  const seekTo = (t: number) => {
    const el = videoRef.current
    if (!el) return
    el.pause()
    el.currentTime = Math.min(t, Math.max(0, info.durationSec - 0.1))
  }

  return (
    <main className="pane" style={{ background: 'var(--bg-0)', minWidth: 0 }}>
      <div className="stage-wrap">
        <div className="stage">
          <div className="stage-inner">
            {canPlay ? (
              <video
                ref={videoRef}
                className="stage-media"
                src={mediaUrl}
                poster={thumb?.poster || undefined}
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onError={() => setFailed(true)}
              />
            ) : thumb?.poster ? (
              <img className="stage-media" src={thumb.poster} alt={info.name} draggable={false} />
            ) : (
              <div
                className="stage-media"
                style={{
                  width: 420,
                  height: 236,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--txt-3)',
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  background: 'var(--bg-2)',
                  fontSize: 12,
                }}
              >
                {thumb?.poster === '' ? '无法生成缩略图' : '正在生成缩略图…'}
              </div>
            )}

            {canPlay && (
              <button className="stage-play" onClick={togglePlay} title={playing ? '暂停' : '播放'}>
                {playing ? <IconPause size={24} /> : <IconPlay size={26} />}
              </button>
            )}

            <div className="stage-badge">
              {v ? `${v.width}×${v.height}` : '音频'}
              <span style={{ opacity: 0.4 }}>·</span>
              {formatDuration(info.durationSec)}
              {!info.nativelyPlayable && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ color: 'var(--warn)' }}>不支持内置预览</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="strip-wrap">
          {thumb?.strip ? (
            <div className="filmstrip">
              {Array.from({ length: thumb.frameCount }).map((_, i) => (
                <div
                  key={i}
                  className="film-frame"
                  data-time={formatDuration(thumb.timestamps[i] ?? 0)}
                  style={{
                    backgroundImage: `url("${thumb.strip}")`,
                    backgroundSize: `${thumb.frameCount * 100}% 100%`,
                    backgroundPosition: `${thumb.frameCount > 1 ? (i / (thumb.frameCount - 1)) * 100 : 0}% 50%`,
                  }}
                  onClick={() => seekTo(thumb.timestamps[i] ?? 0)}
                />
              ))}
            </div>
          ) : (
            <div className="film-placeholder" />
          )}
        </div>

        <div className="meta-section">
          <div className="meta-head">
            <h2 title={info.name}>{info.name}</h2>
            <span className="meta-sub">
              {formatBytes(info.sizeBytes)} · {formatDuration(info.durationSec)} · {info.container.toUpperCase()}
            </span>
          </div>

          <div className="meta-grid">
            <Cell k="分辨率" v={v ? `${v.width} × ${v.height}` : '—'} />
            <Cell k="帧率" v={formatFps(v?.fps)} />
            <Cell k="视频编码" v={v ? `${v.codec.toUpperCase()}${v.profile ? ` · ${v.profile}` : ''}` : '—'} mono />
            <Cell k="像素格式" v={v?.pixelFormat ?? '—'} mono />
            <Cell k="音频" v={info.audio ? `${info.audio.codec.toUpperCase()} · ${info.audio.channels ?? '?'}ch · ${(info.audio.sampleRate ?? 0) / 1000}kHz` : '无音频'} mono />
            <Cell k="总码率" v={formatBitrate(info.bitrate)} />
            <Cell k="轨道" v={`${info.streams.filter((s) => s.kind === 'video').length} 视频 / ${info.audioCount} 音频 / ${info.subtitleCount} 字幕`} />
            <Cell k="大小" v={formatBytes(info.sizeBytes)} />
          </div>
        </div>
      </div>
    </main>
  )
}

function Cell({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="meta-cell">
      <div className="meta-key">{k}</div>
      <div className={`meta-val${mono ? ' mono' : ''}`} title={v}>
        {v}
      </div>
    </div>
  )
}
