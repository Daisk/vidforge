export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  if (seconds < 60) return `${Math.ceil(seconds)} 秒`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return `${m} 分 ${String(s).padStart(2, '0')} 秒`
  const h = Math.floor(m / 60)
  return `${h} 时 ${String(m % 60).padStart(2, '0')} 分`
}

export function formatBitrate(bps: number): string {
  if (!bps || bps <= 0) return '—'
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  return `${Math.round(bps / 1000)} kbps`
}

export function formatFps(fps?: number): string {
  if (!fps || !Number.isFinite(fps)) return '—'
  return Number.isInteger(fps) ? `${fps} fps` : `${fps.toFixed(2)} fps`
}

export function formatSpeed(speed: number): string {
  if (!speed || speed <= 0) return '—'
  return `${speed.toFixed(2)}x`
}

export function shortPath(p: string, max = 42): string {
  if (!p) return ''
  if (p.length <= max) return p
  const head = p.slice(0, Math.ceil(max / 2) - 2)
  const tail = p.slice(-Math.floor(max / 2))
  return `${head}…${tail}`
}

export function baseName(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

export function dirName(p: string): string {
  const idx = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return idx > 0 ? p.slice(0, idx) : p
}
