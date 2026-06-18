const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000

export interface LoadedImage {
  image: HTMLImageElement
  objectUrl: string
  name: string
  size: number
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return '仅支持 JPG、PNG 或 WebP 图片。'
  }
  if (file.size === 0) {
    return '图片文件为空，请重新选择。'
  }
  if (file.size > MAX_FILE_BYTES) {
    return '图片不能超过 20 MB。'
  }
  return null
}

export function loadImageFile(file: File): Promise<LoadedImage> {
  const validationError = validateImageFile(file)
  if (validationError) {
    return Promise.reject(new Error(validationError))
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'

  return new Promise((resolve, reject) => {
    image.onload = () => {
      const pixels = image.naturalWidth * image.naturalHeight
      if (!image.naturalWidth || !image.naturalHeight || pixels > MAX_IMAGE_PIXELS) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('图片尺寸无效或像素过大，请使用 4000 万像素以内的图片。'))
        return
      }
      resolve({ image, objectUrl, name: file.name, size: file.size })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片无法读取，文件可能已损坏。'))
    }
    image.src = objectUrl
  })
}

export function releaseLoadedImage(loaded: LoadedImage | null): void {
  if (loaded) {
    URL.revokeObjectURL(loaded.objectUrl)
  }
}
