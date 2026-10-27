import type { ConvertJob } from '../../shared/types'
import { formatBytes, formatEta, formatSpeed } from '../lib/format'
import { IconCheck, IconChevron, IconClose, IconExternal, IconLayers, IconTrash } from './Icons'

interface Props {
  jobs: ConvertJob[]
  open: boolean
  onToggle: () => void
  onCancel: (id: string) => void
  onClear: () => void
  onReveal: (p: string) => void
}

export function Queue({ jobs, open, onToggle, onCancel, onClear, onReveal }: Props) {
  const running = jobs.filter((j) => j.status === 'running').length
  const queued = jobs.filter((j) => j.status === 'queued').length
  const finished = jobs.filter((j) => ['done', 'error', 'cancelled'].includes(j.status)).length

  return (
    <section className="queue">
      <div className={`queue-head${open ? ' open' : ''}`} onClick={onToggle}>
        <div className="pane-title">
          <IconLayers size={13} />
          任务队列
          {jobs.length > 0 && <span className="count-pill">{jobs.length}</span>}
        </div>

        {running > 0 && (
          <span className="badge-soft badge-ok" style={{ marginLeft: 2 }}>
            转换中 {running}
          </span>
        )}
        {queued > 0 && (
          <span className="badge-soft" style={{ marginLeft: 2 }}>
            排队 {queued}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {finished > 0 && (
          <button
            className="icon-btn"
            title="清除已完成"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
          >
            <IconTrash size={13} />
          </button>
        )}
        <IconChevron size={14} className="chev" />
      </div>

      {open && (
        <div className="queue-body">
          {jobs.length === 0 && (
            <div className="queue-empty">
              <IconLayers size={14} />
              暂无任务 — 选择素材并点击「开始转换」，任务会在这里排队执行。
            </div>
          )}

          {jobs.map((j) => (
            <JobRow key={j.id} job={j} onCancel={onCancel} onReveal={onReveal} />
          ))}
        </div>
      )}
    </section>
  )
}

function JobRow({
  job,
  onCancel,
  onReveal,
}: {
  job: ConvertJob
  onCancel: (id: string) => void
  onReveal: (p: string) => void
}) {
  const isRunning = job.status === 'running'
  const isDone = job.status === 'done'
  const isError = job.status === 'error'
  const isCancelled = job.status === 'cancelled'
  const ratio = job.sourceSize > 0 && job.outputSize > 0 ? job.outputSize / job.sourceSize : 0

  return (
    <div className={`q-row${isRunning ? ' running' : ''}`}>
      <div className="q-file">
        <span className="q-name" title={job.sourceName}>
          {job.sourceName}
        </span>
        <span className="q-tag">{job.options.container.toUpperCase()}</span>
        {job.warning && (
          <span className="badge-soft badge-warn" title={job.warning}>
            已降级
          </span>
        )}
      </div>

      <div>
        <div className="q-bar-wrap">
          <div
            className={`q-bar${isDone ? ' done' : ''}${isError ? ' err' : ''}${isCancelled ? ' cancel' : ''}`}
            style={{ width: `${Math.max(isRunning || isDone ? 2 : 0, job.progress)}%` }}
          />
        </div>
        <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
          {job.status === 'queued' ? '等待中' : `${job.progress.toFixed(0)}%`}
        </div>
      </div>

      <div className={`q-stat${isDone ? ' ok' : ''}${isError ? ' err' : ''}`} title={job.error}>
        {isDone && (
          <>
            <IconCheck size={12} />
            已完成
          </>
        )}
        {isError && <>{job.error}</>}
        {isCancelled && '已取消'}
        {job.status === 'queued' && '—'}
        {isRunning && (
          <>
            {formatSpeed(job.speed)}
            <span style={{ opacity: 0.45 }}>·</span>
            剩 {formatEta(job.etaSec)}
          </>
        )}
      </div>

      <div className="q-size">
        {isDone ? (
          <>
            {formatBytes(job.outputSize)}
            <span style={{ color: ratio > 0 && ratio < 1 ? 'var(--ok)' : 'var(--txt-3)' }}>
              {ratio > 0 ? ` ${ratio < 1 ? '↓' : '↑'}${Math.abs((1 - ratio) * 100).toFixed(0)}%` : ''}
            </span>
          </>
        ) : (
          formatBytes(job.sourceSize)
        )}
      </div>

      <div>
        {isRunning || job.status === 'queued' ? (
          <button className="icon-btn" title="取消" onClick={() => onCancel(job.id)}>
            <IconClose size={13} />
          </button>
        ) : isDone ? (
          <button className="icon-btn" title="打开所在文件夹" onClick={() => onReveal(job.outputPath)}>
            <IconExternal size={13} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
