import type { ChangeEvent, DragEvent } from 'react'
import { Clock3, FileVideo, HardDrive, Ruler, Upload, X } from 'lucide-react'
import './video-mode.css'

export interface VideoAssetSummary {
  name: string
  width: number
  height: number
  duration: number
  size: number
}

export interface VideoUploadPanelProps {
  video?: VideoAssetSummary | null
  accept?: string
  inputId?: string
  isDragging?: boolean
  disabled?: boolean
  className?: string
  helpText?: string
  onFileSelect: (file: File) => void
  onFileError?: (message: string) => void
  onRemove?: () => void
  onDragEnter?: (event: DragEvent<HTMLLabelElement>) => void
  onDragLeave?: (event: DragEvent<HTMLLabelElement>) => void
  onDrop?: (event: DragEvent<HTMLLabelElement>) => void
}

const DEFAULT_HELP_TEXT = '支持 MP4、WebM、MOV，视频仅在当前浏览器中处理'

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'

  const totalSeconds = Math.round(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainder = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1

  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/')
}

export function VideoUploadPanel({
  video,
  accept = 'video/mp4,video/webm,video/quicktime',
  inputId = 'cinegif-video-input',
  isDragging = false,
  disabled = false,
  className = '',
  helpText = DEFAULT_HELP_TEXT,
  onFileSelect,
  onFileError,
  onRemove,
  onDragEnter,
  onDragLeave,
  onDrop,
}: VideoUploadPanelProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    if (!isVideoFile(file)) {
      onFileError?.('请选择有效的视频文件。')
      return
    }

    onFileSelect(file)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    onDrop?.(event)

    const files = event.dataTransfer.files
    if (files.length > 1) {
      onFileError?.('每次只能导入一个视频。')
      return
    }

    const file = files[0]
    if (!file) return

    if (!isVideoFile(file)) {
      onFileError?.('请选择有效的视频文件。')
      return
    }

    onFileSelect(file)
  }

  return (
    <section className={`cg-video-panel cg-video-upload ${className}`.trim()}>
      <div className="cg-video-heading">
        <span className="cg-video-heading__icon" aria-hidden="true">
          <FileVideo size={18} />
        </span>
        <div>
          <h2>上传视频</h2>
          <p>选择一段视频并截取片段生成 GIF</p>
        </div>
      </div>

      {video ? (
        <div className="cg-video-card">
          <div className="cg-video-card__body">
            <div className="cg-video-card__title">
              <span className="cg-video-card__mark" aria-hidden="true">
                <FileVideo size={22} />
              </span>
              <strong title={video.name}>{video.name}</strong>
            </div>
            <dl className="cg-video-meta" aria-label="视频信息">
              <div>
                <dt><Ruler size={14} aria-hidden="true" />尺寸</dt>
                <dd>{video.width} × {video.height} px</dd>
              </div>
              <div>
                <dt><Clock3 size={14} aria-hidden="true" />时长</dt>
                <dd>{formatDuration(video.duration)}</dd>
              </div>
              <div>
                <dt><HardDrive size={14} aria-hidden="true" />大小</dt>
                <dd>{formatFileSize(video.size)}</dd>
              </div>
            </dl>
          </div>
          {onRemove && (
            <button
              className="cg-video-remove"
              type="button"
              aria-label={`移除视频：${video.name}`}
              disabled={disabled}
              onClick={onRemove}
            >
              <X size={18} />
            </button>
          )}
        </div>
      ) : (
        <label
          className={`cg-video-dropzone${isDragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
          htmlFor={inputId}
          onDragEnter={onDragEnter}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={onDragLeave}
          onDrop={handleDrop}
        >
          <input
            id={inputId}
            type="file"
            accept={accept}
            aria-label="选择要转换为 GIF 的视频"
            disabled={disabled}
            onChange={handleChange}
          />
          <span className="cg-video-dropzone__icon" aria-hidden="true">
            <Upload size={26} strokeWidth={1.7} />
          </span>
          <strong>{isDragging ? '松开即可载入视频' : '拖放视频到这里'}</strong>
          <span>或点击浏览本地文件</span>
          <small>{helpText}</small>
        </label>
      )}
    </section>
  )
}
