import type { ChangeEvent } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Images, Trash2 } from 'lucide-react'
import './multi-image.css'

export interface MultiImageAsset {
  id: string
  name: string
  width: number
  height: number
  previewUrl: string
}

export interface MultiImageListProps {
  images: readonly MultiImageAsset[]
  accept?: string
  inputId?: string
  minItems?: number
  maxItems?: number
  disabled?: boolean
  className?: string
  onFilesAdd: (files: readonly File[]) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onRemove: (id: string) => void
  onInputError?: (message: string) => void
}

export function MultiImageList({
  images,
  accept = 'image/jpeg,image/png,image/webp',
  inputId = 'cinegif-multi-image-input',
  minItems = 2,
  maxItems = 10,
  disabled = false,
  className = '',
  onFilesAdd,
  onMoveUp,
  onMoveDown,
  onRemove,
  onInputError,
}: MultiImageListProps) {
  const normalizedMin = Math.max(1, minItems)
  const normalizedMax = Math.max(normalizedMin, maxItems)
  const remainingSlots = Math.max(0, normalizedMax - images.length)
  const canAdd = !disabled && remainingSlots > 0

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (selectedFiles.length === 0) return

    if (remainingSlots === 0) {
      onInputError?.(`最多可添加 ${normalizedMax} 张图片。`)
      return
    }

    if (selectedFiles.length > remainingSlots) {
      onInputError?.(
        `本次最多还能添加 ${remainingSlots} 张图片，已忽略超出数量的文件。`,
      )
    }
    onFilesAdd(selectedFiles.slice(0, remainingSlots))
  }

  return (
    <section className={`cg-multi-image ${className}`.trim()}>
      <div className="cg-multi-image__heading">
        <span className="cg-multi-image__heading-icon" aria-hidden="true">
          <Images size={18} />
        </span>
        <div>
          <h2>轮播图片</h2>
          <p>
            已添加 {images.length}/{normalizedMax} 张
            {images.length < normalizedMin && `，至少需要 ${normalizedMin} 张`}
          </p>
        </div>
      </div>

      <ol className="cg-multi-image__list" aria-label="轮播图片顺序">
        {images.map((image, index) => {
          const position = index + 1
          const isFirst = index === 0
          const isLast = index === images.length - 1

          return (
            <li className="cg-multi-image__item" key={image.id}>
              <span className="cg-multi-image__index" aria-label={`第 ${position} 张`}>
                {position}
              </span>
              <img
                className="cg-multi-image__thumbnail"
                src={image.previewUrl}
                alt={`${image.name} 缩略图`}
              />
              <span className="cg-multi-image__meta">
                <strong title={image.name}>{image.name}</strong>
                <small>
                  {image.width} × {image.height} px
                </small>
              </span>
              <span className="cg-multi-image__actions">
                <button
                  type="button"
                  aria-label={`上移第 ${position} 张图片：${image.name}`}
                  title="上移"
                  disabled={disabled || isFirst}
                  onClick={() => onMoveUp(image.id)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`下移第 ${position} 张图片：${image.name}`}
                  title="下移"
                  disabled={disabled || isLast}
                  onClick={() => onMoveDown(image.id)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="is-danger"
                  type="button"
                  aria-label={`删除第 ${position} 张图片：${image.name}`}
                  title="删除"
                  disabled={disabled}
                  onClick={() => onRemove(image.id)}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </li>
          )
        })}
      </ol>

      {images.length === 0 && (
        <p className="cg-multi-image__empty">
          尚未添加图片，请从本地选择 {normalizedMin}-{normalizedMax} 张图片。
        </p>
      )}

      <label
        className={`cg-multi-image__add${canAdd ? '' : ' is-disabled'}`}
        htmlFor={inputId}
        aria-label="追加轮播图片"
      >
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple
          aria-label="选择要追加的轮播图片"
          disabled={!canAdd}
          onChange={handleChange}
        />
        <ImagePlus size={18} aria-hidden="true" />
        <span>{remainingSlots > 0 ? '追加图片' : '已达到图片上限'}</span>
      </label>
    </section>
  )
}
