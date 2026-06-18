import {
  loadImageFile,
  releaseLoadedImage,
  validateImageFile,
  type LoadedImage,
} from './imageFile'

export const MIN_IMAGE_ASSETS = 2
export const MAX_IMAGE_ASSETS = 10
export const MAX_TOTAL_IMAGE_BYTES = 60 * 1024 * 1024
export const MAX_TOTAL_IMAGE_PIXELS = 80_000_000

export interface MultiImageAsset {
  id: string
  file: File
  width: number
  height: number
  bitmap: ImageBitmap | HTMLImageElement
  loaded: LoadedImage
}

const releasedAssets = new WeakSet<MultiImageAsset>()

function fileKey(file: File): string {
  return `${file.name}\0${file.type}\0${file.size}\0${file.lastModified}`
}

function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function nextAssetId(file: File, usedIds: Set<string>): string {
  const base = `image-${hashString(fileKey(file))}`
  let id = base
  let duplicateIndex = 2

  while (usedIds.has(id)) {
    id = `${base}-${duplicateIndex}`
    duplicateIndex += 1
  }
  usedIds.add(id)
  return id
}

export function validateMultiImageFiles(
  files: readonly File[],
  existingCount = 0,
  existingBytes = 0,
): string | null {
  if (!Number.isInteger(existingCount) || existingCount < 0 || existingCount > MAX_IMAGE_ASSETS) {
    return `现有图片数量必须在 0-${MAX_IMAGE_ASSETS} 张之间。`
  }
  if (files.length === 0) {
    return existingCount === 0
      ? `请一次选择 ${MIN_IMAGE_ASSETS}-${MAX_IMAGE_ASSETS} 张图片。`
      : '请至少选择 1 张图片。'
  }
  if (existingCount === 0 && files.length < MIN_IMAGE_ASSETS) {
    return `请一次选择至少 ${MIN_IMAGE_ASSETS} 张图片。`
  }
  if (existingCount + files.length > MAX_IMAGE_ASSETS) {
    return `图片总数不能超过 ${MAX_IMAGE_ASSETS} 张。`
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, existingBytes)
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    return '多图素材总大小不能超过 60 MB。'
  }

  for (let index = 0; index < files.length; index += 1) {
    const error = validateImageFile(files[index])
    if (error) return `第 ${index + 1} 张图片无效：${error}`
  }
  return null
}

export async function loadMultiImageAssets(
  files: readonly File[],
  existingAssets: readonly MultiImageAsset[] = [],
): Promise<MultiImageAsset[]> {
  const validationError = validateMultiImageFiles(
    files,
    existingAssets.length,
    existingAssets.reduce((sum, asset) => sum + asset.file.size, 0),
  )
  if (validationError) throw new Error(validationError)

  const usedIds = new Set(existingAssets.map((asset) => asset.id))
  const loadedAssets: MultiImageAsset[] = []

  try {
    for (const file of files) {
      const loaded = await loadImageFile(file)
      loadedAssets.push({
        id: nextAssetId(file, usedIds),
        file,
        width: loaded.image.naturalWidth,
        height: loaded.image.naturalHeight,
        bitmap: loaded.image,
        loaded,
      })
      const totalPixels = [...existingAssets, ...loadedAssets].reduce(
        (sum, asset) => sum + asset.width * asset.height,
        0,
      )
      if (totalPixels > MAX_TOTAL_IMAGE_PIXELS) {
        throw new Error('多图素材总像素不能超过 8000 万，请减少图片或压缩尺寸。')
      }
    }
  } catch (error) {
    releaseImageAssets(loadedAssets)
    throw error
  }

  return appendImageAssets(existingAssets, loadedAssets)
}

export function appendImageAssets(
  assets: readonly MultiImageAsset[],
  additions: readonly MultiImageAsset[],
): MultiImageAsset[] {
  if (assets.length + additions.length > MAX_IMAGE_ASSETS) {
    throw new RangeError(`图片总数不能超过 ${MAX_IMAGE_ASSETS} 张。`)
  }
  return [...assets, ...additions]
}

export function removeImageAsset(
  assets: readonly MultiImageAsset[],
  assetId: string,
): MultiImageAsset[] {
  return assets.filter((asset) => asset.id !== assetId)
}

export function moveImageAsset(
  assets: readonly MultiImageAsset[],
  fromIndex: number,
  toIndex: number,
): MultiImageAsset[] {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= assets.length ||
    toIndex < 0 ||
    toIndex >= assets.length
  ) {
    throw new RangeError('图片排序索引超出范围。')
  }
  if (fromIndex === toIndex) return [...assets]

  const reordered = [...assets]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  return reordered
}

export function releaseImageAsset(asset: MultiImageAsset | null | undefined): void {
  if (!asset || releasedAssets.has(asset)) return
  releasedAssets.add(asset)

  try {
    if ('close' in asset.bitmap && typeof asset.bitmap.close === 'function') {
      asset.bitmap.close()
    }
  } catch {
    // Cleanup is best-effort and must remain safe during repeated unmounts.
  }

  try {
    releaseLoadedImage(asset.loaded)
  } catch {
    // URL cleanup failures must not interrupt releasing the remaining assets.
  }
}

export function releaseImageAssets(assets: readonly MultiImageAsset[]): void {
  for (const asset of assets) releaseImageAsset(asset)
}
