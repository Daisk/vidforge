import type {
  AppInfo,
  ConvertJob,
  MediaInfo,
  ProgressEvent,
  StartConvertRequest,
  ThumbSet,
} from '../shared/types'

export interface VfApi {
  appInfo(): Promise<AppInfo>
  pickFiles(): Promise<string[]>
  pickOutputDir(current?: string): Promise<string>
  reveal(p: string): Promise<void>
  probe(p: string): Promise<MediaInfo>
  thumbnails(p: string): Promise<ThumbSet>
  startConvert(req: StartConvertRequest): Promise<ConvertJob>
  cancelConvert(id: string): Promise<boolean>
  listJobs(): Promise<ConvertJob[]>
  clearFinished(): Promise<void>
  onProgress(cb: (e: ProgressEvent) => void): () => void
  onDemoLoad(cb: (p: string) => void): () => void
  onDemoConvert(cb: () => void): () => void
  pathForFile(file: File): string
  window: {
    minimize(): Promise<void>
    maximize(): Promise<void>
    close(): Promise<void>
    onMaximized(cb: (v: boolean) => void): () => void
  }
}

declare global {
  interface Window {
    vf: VfApi
  }
}

export {}
