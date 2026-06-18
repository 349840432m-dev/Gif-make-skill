import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExportProgress } from '../types'

export type ExportRunner = (signal: AbortSignal, onProgress: (p: ExportProgress) => void) => Promise<Blob>

const IDLE: ExportProgress = { phase: 'idle', progress: 0, message: '' }

export interface UseExportTaskReturn {
  exportProgress: ExportProgress
  exportedBlob: Blob | null
  downloadUrl: string | null
  isExporting: boolean
  startExport: (runner: ExportRunner) => void
  cancelExport: () => void
  resetExport: () => void
}

export function useExportTask(): UseExportTaskReturn {
  const [progress, setProgress] = useState<ExportProgress>(IDLE)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const taskIdRef = useRef(0)

  const isExporting = progress.phase === 'rendering' || progress.phase === 'encoding'

  useEffect(() => {
    if (!blob) {
      setDownloadUrl(null)
      return
    }
    const url = URL.createObjectURL(blob)
    setDownloadUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])

  const startExport = useCallback((runner: ExportRunner) => {
    const controller = new AbortController()
    const id = taskIdRef.current + 1
    taskIdRef.current = id
    abortRef.current?.abort()
    abortRef.current = controller
    setBlob(null)

    const guard = (fn: () => void) => {
      if (taskIdRef.current === id) fn()
    }

    runner(
      controller.signal,
      (p) => guard(() => setProgress(p)),
    )
      .then((result) => {
        guard(() => {
          setBlob(result)
          setProgress({
            phase: 'done',
            progress: 100,
            message: `生成完成 · ${formatBytes(result.size)}，点击即可下载`,
          })
        })
      })
      .catch((reason) => {
        guard(() => {
          if (controller.signal.aborted) {
            setProgress({ phase: 'cancelled', progress: 0, message: '已取消导出。' })
          } else {
            const message = reason instanceof Error ? reason.message : 'GIF 编码失败，请重试。'
            setProgress({ phase: 'error', progress: 0, message })
          }
        })
      })
      .finally(() => {
        guard(() => { abortRef.current = null })
      })
  }, [])

  const cancelExport = useCallback(() => {
    taskIdRef.current += 1
    abortRef.current?.abort()
  }, [])

  const resetExport = useCallback(() => {
    setProgress(IDLE)
    setBlob(null)
  }, [])

  return {
    exportProgress: progress,
    exportedBlob: blob,
    downloadUrl,
    isExporting,
    startExport,
    cancelExport,
    resetExport,
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
