import type { ChangeEvent, DragEvent } from 'react'
import { FileImage, ImagePlus, Upload, X } from 'lucide-react'
import './components.css'

export interface UploadZoneProps {
  previewUrl?: string | null
  fileName?: string | null
  fileMeta?: string
  accept?: string
  inputId?: string
  isDragging?: boolean
  disabled?: boolean
  className?: string
  onFileSelect: (file: File) => void
  onFileError?: (message: string) => void
  onRemove?: () => void
  onDragEnter?: (event: DragEvent<HTMLLabelElement>) => void
  onDragLeave?: (event: DragEvent<HTMLLabelElement>) => void
  onDrop?: (event: DragEvent<HTMLLabelElement>) => void
}

export function UploadZone({
  previewUrl,
  fileName,
  fileMeta = '支持 JPG、PNG、WebP，建议不超过 20 MB',
  accept = 'image/jpeg,image/png,image/webp',
  inputId = 'cinegif-upload',
  isDragging = false,
  disabled = false,
  className = '',
  onFileSelect,
  onFileError,
  onRemove,
  onDragEnter,
  onDragLeave,
  onDrop,
}: UploadZoneProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file) onFileSelect(file)
    event.currentTarget.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    onDrop?.(event)
    const files = event.dataTransfer.files
    if (files.length > 1) {
      onFileError?.('每次只能导入一张图片。')
      return
    }
    const file = files[0]
    if (file) onFileSelect(file)
  }

  return (
    <section className={`cg-panel cg-upload-panel ${className}`.trim()}>
      <div className="cg-section-heading">
        <span className="cg-section-heading__icon" aria-hidden="true">
          <ImagePlus size={18} />
        </span>
        <div>
          <h2>上传画面</h2>
          <p>选择一张清晰图片作为镜头起点</p>
        </div>
      </div>

      {previewUrl ? (
        <div className="cg-upload-preview">
          <img src={previewUrl} alt={fileName ? `${fileName} 预览` : '已上传图片预览'} />
          <div className="cg-upload-preview__shade" />
          <div className="cg-upload-preview__info">
            <FileImage size={18} aria-hidden="true" />
            <span>
              <strong>{fileName || '已选择图片'}</strong>
              <small>{fileMeta}</small>
            </span>
          </div>
          {onRemove && (
            <button
              className="cg-icon-button"
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label="移除图片"
            >
              <X size={18} />
            </button>
          )}
        </div>
      ) : (
        <label
          className={`cg-dropzone${isDragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
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
            disabled={disabled}
            onChange={handleChange}
          />
          <span className="cg-dropzone__icon" aria-hidden="true">
            <Upload size={26} strokeWidth={1.7} />
          </span>
          <strong>{isDragging ? '松开即可载入画面' : '拖放图片到这里'}</strong>
          <span>或点击浏览本地文件</span>
          <small>{fileMeta}</small>
        </label>
      )}
    </section>
  )
}
