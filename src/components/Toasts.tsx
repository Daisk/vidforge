import { IconAlert, IconCheck, IconBolt } from './Icons'

export interface ToastItem {
  id: number
  kind: 'ok' | 'err' | 'info'
  title: string
  desc?: string
  leaving?: boolean
}

export function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}${t.leaving ? ' out' : ''}`}>
          <span className="toast-icon">
            {t.kind === 'ok' ? <IconCheck size={15} /> : t.kind === 'err' ? <IconAlert size={15} /> : <IconBolt size={15} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="toast-title">{t.title}</div>
            {t.desc && <div className="toast-desc">{t.desc}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
