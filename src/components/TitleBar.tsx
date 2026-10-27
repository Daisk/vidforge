import type { AppInfo } from '../../shared/types'
import { IconClose, IconFilm, IconMinus, IconMoon, IconSquare, IconSun } from './Icons'

interface Props {
  info: AppInfo | null
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function TitleBar({ info, theme, onToggleTheme }: Props) {
  const hw = info?.hardware
  const hwLabel = hw && hw.workingEncoders.length > 0 ? `${hw.vendor} GPU 编码可用` : '未检测到硬件编码'

  return (
    <header className="titlebar">
      <div className="brand">
        <div className="brand-mark">
          <IconFilm size={15} />
        </div>
        <span className="brand-name">VidForge</span>
        <span className="brand-sub">视频格式转换器</span>
      </div>

      <div className="titlebar-spacer" />

      {info && (
        <div className="env-chip" title={info.ffmpegPath}>
          <span className={info.ffmpegFound ? 'dot-ok' : 'dot-err'} />
          FFmpeg {info.ffmpegFound ? info.ffmpegVersion : '未找到'}
        </div>
      )}

      {hw && hw.workingEncoders.length > 0 && (
        <div className="env-chip" title={hw.workingEncoders.join(' / ')}>
          <span className="dot-ok" style={{ background: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' }} />
          {hwLabel}
        </div>
      )}

      <button className="icon-btn" onClick={onToggleTheme} title={theme === 'dark' ? '切换到浅色' : '切换到深色'}>
        {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
      </button>

      <div className="win-controls">
        <button className="win-btn" onClick={() => void window.vf.window.minimize()} title="最小化">
          <IconMinus size={15} />
        </button>
        <button className="win-btn" onClick={() => void window.vf.window.maximize()} title="最大化">
          <IconSquare size={13} />
        </button>
        <button className="win-btn close" onClick={() => void window.vf.window.close()} title="关闭">
          <IconClose size={15} />
        </button>
      </div>
    </header>
  )
}
