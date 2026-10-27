import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppInfo,
  ConvertJob,
  ConvertOptions,
  MediaInfo,
  PresetId,
  ProgressEvent,
  ThumbSet,
} from '../shared/types'
import { PRESET_DEFAULTS } from '../shared/presets'
import { PRESETS } from './lib/presets'
import { TitleBar } from './components/TitleBar'
import { Library } from './components/Library'
import { Stage } from './components/Stage'
import { SettingsPanel } from './components/SettingsPanel'
import { Queue } from './components/Queue'
import { Toasts, type ToastItem } from './components/Toasts'

export interface Asset {
  key: string
  info: MediaInfo
  thumb?: ThumbSet
  thumbState: 'loading' | 'ready' | 'error'
}

export default function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [selected, setSelected] = useState('')
  const [options, setOptions] = useState<ConvertOptions>(PRESET_DEFAULTS['mp4-h264'])
  const [activePreset, setActivePreset] = useState<PresetId | null>('mp4-h264')
  const [outputDir, setOutputDir] = useState('')
  const [jobs, setJobs] = useState<ConvertJob[]>([])
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [dragging, setDragging] = useState(false)
  const [queueOpen, setQueueOpen] = useState(true)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [busy, setBusy] = useState(false)

  const jobsRef = useRef<ConvertJob[]>([])
  const pendingEvents = useRef(new Map<string, ProgressEvent>())
  const dragDepth = useRef(0)
  const toastSeq = useRef(0)

  /* ------------------------------------------------------------------ utils */

  const pushToast = useCallback((kind: ToastItem['kind'], title: string, desc?: string) => {
    const id = ++toastSeq.current
    setToasts((prev) => [...prev, { id, kind, title, desc }])
    window.setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 220)
    }, kind === 'err' ? 6500 : 3600)
  }, [])

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  /* ------------------------------------------------------------------- boot */

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    void window.vf.appInfo().then((info) => {
      setAppInfo(info)
      if (!info.ffmpegFound) {
        pushToast('err', '未检测到 FFmpeg', '请安装 FFmpeg 并加入 PATH，或将其放到项目 bin/ 目录')
      }
    })
    void window.vf.listJobs().then((list) => setJobs(list))
  }, [pushToast])

  useEffect(() => {
    const off = window.vf.onProgress((e) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === e.id)
        if (idx < 0) {
          pendingEvents.current.set(e.id, e)
          return prev
        }
        const next = [...prev]
        next[idx] = { ...next[idx], ...e }
        jobsRef.current = next
        return next
      })
      if (e.status === 'done') {
        pushToast('ok', '转换完成', e.outputPath)
      } else if (e.status === 'error') {
        pushToast('err', '转换失败', e.error)
      }
    })
    return off
  }, [pushToast])

  /* ------------------------------------------------------------- add files */

  const addFiles = useCallback(
    async (paths: string[]) => {
      const known = new Set(assets.map((a) => a.info.path))
      const fresh = paths.filter((p) => p && !known.has(p))
      if (fresh.length === 0) return
      setBusy(true)
      for (const p of fresh) {
        try {
          const info = await window.vf.probe(p)
          const asset: Asset = { key: p, info, thumbState: 'loading' }
          setAssets((prev) => (prev.some((a) => a.key === p) ? prev : [...prev, asset]))
          setSelected((cur) => cur || p)

          void window.vf
            .thumbnails(p)
            .then((thumb) => {
              setAssets((prev) =>
                prev.map((a) => (a.key === p ? { ...a, thumb, thumbState: 'ready' } : a)),
              )
            })
            .catch(() => {
              setAssets((prev) =>
                prev.map((a) => (a.key === p ? { ...a, thumbState: 'error' } : a)),
              )
            })
        } catch (err) {
          pushToast('err', `无法读取 ${p.split(/[\\/]/).pop()}`, String((err as Error).message ?? err))
        }
      }
      setBusy(false)
    },
    [assets, pushToast],
  )

  const pickFiles = useCallback(async () => {
    const paths = await window.vf.pickFiles()
    if (paths.length) await addFiles(paths)
  }, [addFiles])

  useEffect(() => window.vf.onDemoLoad((p) => void addFiles([p])), [addFiles])

  /* ----------------------------------------------------------------- drag */

  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      dragDepth.current += 1
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      const paths = files.map((f) => window.vf.pathForFile(f)).filter(Boolean)
      if (paths.length) await addFiles(paths)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [addFiles])

  /* ------------------------------------------------------------ shortcuts */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        void pickFiles()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void startConvert(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* --------------------------------------------------------------- convert */

  const selectedAsset = useMemo(() => assets.find((a) => a.key === selected), [assets, selected])

  const applyPreset = useCallback((id: PresetId) => {
    setOptions(PRESET_DEFAULTS[id])
    setActivePreset(id)
  }, [])

  const patchOptions = useCallback((patch: Partial<ConvertOptions>) => {
    setOptions((prev) => ({ ...prev, ...patch }))
    setActivePreset(null)
  }, [])

  const startConvert = useCallback(
    async (all: boolean, override?: ConvertOptions) => {
      if (!appInfo?.ffmpegFound) {
        pushToast('err', '无法开始', 'FFmpeg 不可用，请先配置 FFmpeg 路径')
        return
      }
      const targets = all
        ? assets.map((a) => a.info.path)
        : selected
          ? [selected]
          : []
      if (targets.length === 0) return

      const opts = override ?? options
      setQueueOpen(true)
      for (const p of targets) {
        try {
          const job = await window.vf.startConvert({ sourcePath: p, outputDir, options: opts })
          setJobs((prev) => {
            if (prev.some((j) => j.id === job.id)) return prev
            const pending = pendingEvents.current.get(job.id)
            const merged = pending ? { ...job, ...pending } : job
            pendingEvents.current.delete(job.id)
            return [...prev, merged]
          })
        } catch (err) {
          pushToast('err', '加入队列失败', String((err as Error).message ?? err))
        }
      }
    },
    [appInfo, assets, options, outputDir, pushToast, selected],
  )

  useEffect(
    () =>
      window.vf.onDemoConvert(() => {
        const opts: ConvertOptions = { ...PRESET_DEFAULTS['webm-vp9'], resolution: '480' }
        setOptions(opts)
        setActivePreset('webm-vp9')
        void startConvert(false, opts)
      }),
    [startConvert],
  )

  const cancelJob = useCallback(async (id: string) => {
    await window.vf.cancelConvert(id)
  }, [])

  const clearFinished = useCallback(async () => {
    await window.vf.clearFinished()
    setJobs((prev) => prev.filter((j) => !['done', 'error', 'cancelled'].includes(j.status)))
  }, [])

  const chooseOutputDir = useCallback(async () => {
    const dir = await window.vf.pickOutputDir(outputDir)
    if (dir) setOutputDir(dir)
  }, [outputDir])

  const removeAsset = useCallback(
    (key: string) => {
      setAssets((prev) => prev.filter((a) => a.key !== key))
      setSelected((cur) => (cur === key ? '' : cur))
    },
    [],
  )

  const presetHint = PRESETS.find((p) => p.id === (activePreset ?? options.presetId))?.hint ?? ''

  /* ------------------------------------------------------------------ render */

  return (
    <div className="app">
      <TitleBar
        info={appInfo}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <div className="workspace">
        <Library
          assets={assets}
          selected={selected}
          busy={busy}
          onSelect={setSelected}
          onAdd={() => void pickFiles()}
          onRemove={removeAsset}
        />

        <Stage asset={selectedAsset} onPick={() => void pickFiles()} onToast={pushToast} />

        <SettingsPanel
          options={options}
          activePreset={activePreset}
          presetHint={presetHint}
          outputDir={outputDir}
          hasSelection={Boolean(selected)}
          assetCount={assets.length}
          hardware={appInfo?.hardware ?? null}
          onApplyPreset={applyPreset}
          onPatch={patchOptions}
          onChooseOutput={chooseOutputDir}
          onStart={() => void startConvert(false)}
          onStartAll={() => void startConvert(true)}
        />
      </div>

      <Queue
        jobs={jobs}
        open={queueOpen}
        onToggle={() => setQueueOpen((v) => !v)}
        onCancel={cancelJob}
        onClear={clearFinished}
        onReveal={(p) => void window.vf.reveal(p)}
      />

      {dragging && (
        <div className="dropzone">
          <div className="dropzone-box">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
            </svg>
            松开鼠标导入视频
          </div>
        </div>
      )}

      <Toasts items={toasts} />
    </div>
  )
}
