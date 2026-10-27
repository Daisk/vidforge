import type { CSSProperties } from 'react'

export interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
  style?: CSSProperties
}

function base(props: IconProps) {
  const { size = 18, className, strokeWidth = 1.7, style } = props
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
    'aria-hidden': true,
  }
}

export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconFolder = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2a2 2 0 0 1 1.6.8l1 1.3h6.2A2.5 2.5 0 0 1 20 9.6v7.9A2.5 2.5 0 0 1 17.5 20h-12A2.5 2.5 0 0 1 3 17.5z" />
  </svg>
)

export const IconFilm = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21" />
  </svg>
)

export const IconPlay = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M8 5.6c0-.8.9-1.3 1.6-.9l8.2 5.5c.6.4.6 1.3 0 1.7l-8.2 5.5c-.7.4-1.6-.1-1.6-.9z" />
  </svg>
)

export const IconPause = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
  </svg>
)

export const IconClose = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconMinus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
)

export const IconSquare = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
)

export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4.5 12.5l5 5L19.5 7" />
  </svg>
)

export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 8.5v5M12 16.8v.2" />
    <path d="M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
)

export const IconChevron = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export const IconCpu = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
    <path d="M10 3v3.5M14 3v3.5M10 17.5V21M14 17.5V21M3 10h3.5M3 14h3.5M17.5 10H21M17.5 14H21" />
  </svg>
)

export const IconClock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export const IconDisc = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.2" />
  </svg>
)

export const IconVolume = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M11 5.5 6.8 9H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.8L11 18.5z" />
    <path d="M15 9.2a4 4 0 0 1 0 5.6M17.8 6.6a8 8 0 0 1 0 10.8" />
  </svg>
)

export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.8 12.1a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" />
  </svg>
)

export const IconExternal = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14.5v4A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
  </svg>
)

export const IconSun = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </svg>
)

export const IconMoon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z" />
  </svg>
)

export const IconBolt = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z" />
  </svg>
)

export const IconLayers = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3 3.5 7.5 12 12l8.5-4.5z" />
    <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.8 12 21.3l8.5-4.5" />
  </svg>
)

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

export const IconRefresh = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 11.5A8 8 0 0 0 6.3 6.3L3.5 9" />
    <path d="M3.5 4.5V9H8" />
    <path d="M4 12.5a8 8 0 0 0 13.7 5.2l2.8-2.7" />
    <path d="M20.5 19.5V15H16" />
  </svg>
)
