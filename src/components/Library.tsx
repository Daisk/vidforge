import type { Asset } from '../App'
import { formatBytes, formatDuration } from '../lib/format'
import { IconFilm, IconPlus, IconTrash } from './Icons'

interface Props {
  assets: Asset[]
  selected: string
  busy: boolean
  onSelect: (key: string) => void
  onAdd: () => void
  onRemove: (key: string) => void
}

export function Library({ assets, selected, busy, onSelect, onAdd, onRemove }: Props) {
  return (
    <aside className="pane pane-left">
      <div className="pane-head">
        <div className="pane-title">
          <IconFilm size={13} />
          素材
          {assets.length > 0 && <span className="count-pill">{assets.length}</span>}
        </div>
        <div style={{ flex: 1 }} />
        <button className="icon-btn accent" onClick={onAdd} title="添加视频 (Ctrl+O)">
          <IconPlus size={15} />
        </button>
      </div>

      <div className="asset-list">
        {assets.length === 0 && (
          <div style={{ padding: '26px 14px', textAlign: 'center', color: 'var(--txt-3)', fontSize: 11.5, lineHeight: 1.7 }}>
            还没有素材
            <br />
            把视频拖进窗口，或点击右上角 +
          </div>
        )}

        {assets.map((a) => {
          const v = a.info.video
          return (
            <div
              key={a.key}
              className={`asset${a.key === selected ? ' active' : ''}`}
              onClick={() => onSelect(a.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(a.key)}
            >
              {a.thumbState === 'ready' && a.thumb?.poster ? (
                <img className="asset-thumb" src={a.thumb.poster} alt="" draggable={false} />
              ) : (
                <div className={`asset-thumb${a.thumbState === 'loading' ? ' ph' : ''}`} />
              )}

              <div className="asset-body">
                <div className="asset-name" title={a.info.name}>
                  {a.info.name}
                </div>
                <div className="asset-meta">
                  <span>{formatDuration(a.info.durationSec)}</span>
                  <span className="sep">·</span>
                  <span>{v ? `${v.width}×${v.height}` : '—'}</span>
                  <span className="sep">·</span>
                  <span>{formatBytes(a.info.sizeBytes)}</span>
                </div>
              </div>

              <button
                className="icon-btn asset-remove"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(a.key)
                }}
                title="移除"
              >
                <IconTrash size={13} />
              </button>
            </div>
          )
        })}

        {busy && (
          <div className="asset" style={{ opacity: 0.6 }}>
            <div className="asset-thumb ph" />
            <div className="asset-body">
              <div className="skeleton-line" style={{ width: '70%' }} />
              <div className="skeleton-line" style={{ width: '45%', marginTop: 6, height: 8 }} />
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
