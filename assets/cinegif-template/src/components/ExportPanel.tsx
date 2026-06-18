import { CheckCircle2, Download, ExternalLink, LoaderCircle, RotateCcw, X } from 'lucide-react'
import type { ExportProgress } from '../types'
import './components.css'

export interface ExportPanelProps {
  progress: ExportProgress
  disabled?: boolean
  fileName?: string
  estimatedSize?: string
  downloadUrl?: string | null
  downloadName?: string
  className?: string
  onExport: () => void
  onCancel?: () => void
  onReset?: () => void
}

export function ExportPanel({
  progress,
  disabled = false,
  fileName = 'cinegif.gif',
  estimatedSize,
  downloadUrl,
  downloadName = fileName,
  className = '',
  onExport,
  onCancel,
  onReset,
}: ExportPanelProps) {
  const isWorking = progress.phase === 'rendering' || progress.phase === 'encoding'
  const isDone = progress.phase === 'done'
  const isError = progress.phase === 'error'
  const boundedProgress = Math.min(100, Math.max(0, progress.progress))

  return (
    <section className={`cg-panel cg-export ${className}`.trim()}>
      <div className="cg-export__copy">
        <span className="cg-export__icon" aria-hidden="true">
          {isDone ? <CheckCircle2 size={22} /> : <Download size={22} />}
        </span>
        <div>
          <h2>{isDone ? 'GIF 已准备好' : '导出你的电影动图'}</h2>
          <p>
            {progress.message || (estimatedSize
              ? `${fileName} · 预计 ${estimatedSize}`
              : `${fileName} · 浏览器本地生成，不上传素材`)}
          </p>
        </div>
      </div>

      {(isWorking || isDone || isError) && (
        <div
          className={`cg-export-progress${isError ? ' is-error' : ''}`}
          aria-live="polite"
        >
          <span className="cg-export-progress__track">
            <span style={{ width: `${boundedProgress}%` }} />
          </span>
          <strong>{Math.round(boundedProgress)}%</strong>
        </div>
      )}

      <div className="cg-export__actions">
        {isWorking && onCancel ? (
          <button className="cg-button cg-button--secondary" type="button" onClick={onCancel}>
            <X size={17} />
            取消导出
          </button>
        ) : (isDone || isError) && onReset ? (
          <button className="cg-button cg-button--secondary" type="button" onClick={onReset}>
            <RotateCcw size={17} />
            重新制作
          </button>
        ) : null}

        {isDone && downloadUrl ? (
          <>
            <a
              className="cg-button cg-button--secondary"
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={17} />
              新标签页打开
            </a>
            <a
              className="cg-button cg-button--primary"
              href={downloadUrl}
              download={downloadName}
            >
              <Download size={18} />
              下载 GIF
            </a>
          </>
        ) : (
          <button
            className="cg-button cg-button--primary"
            type="button"
            disabled={disabled || isWorking}
            onClick={onExport}
          >
            {isWorking ? (
              <LoaderCircle className="cg-spin" size={18} />
            ) : (
              <Download size={18} />
            )}
            {isWorking ? '正在生成' : '生成 GIF'}
          </button>
        )}
      </div>
    </section>
  )
}
