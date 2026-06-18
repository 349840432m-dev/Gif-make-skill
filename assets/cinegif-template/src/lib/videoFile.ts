const ACCEPTED_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const MAX_FILE_BYTES = 100 * 1024 * 1024
const METADATA_TIMEOUT_MS = 15_000

export interface VideoAsset {
  file: File
  name: string
  size: number
  duration: number
  width: number
  height: number
  video: HTMLVideoElement
  objectUrl: string
}

export type LoadedVideo = VideoAsset

const releasedAssets = new WeakSet<VideoAsset>()

export function validateVideoFile(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return '仅支持 MP4、WebM 或 QuickTime 视频。'
  }
  if (file.size === 0) {
    return '视频文件为空，请重新选择。'
  }
  if (file.size > MAX_FILE_BYTES) {
    return '视频不能超过 100 MB。'
  }
  return null
}

export function loadVideoFile(file: File): Promise<VideoAsset> {
  const validationError = validateVideoFile(file)
  if (validationError) {
    return Promise.reject(new Error(validationError))
  }

  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true

  return new Promise((resolve, reject) => {
    let settled = false

    const cleanupListeners = () => {
      window.clearTimeout(timeoutId)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('error', handleError)
    }

    const fail = (message: string) => {
      if (settled) return
      settled = true
      cleanupListeners()
      URL.revokeObjectURL(objectUrl)
      reject(new Error(message))
    }

    const handleCanPlay = () => {
      if (settled) return

      const { duration, videoWidth, videoHeight } = video
      if (
        !Number.isFinite(duration) ||
        duration < 0 ||
        !Number.isFinite(videoWidth) ||
        !Number.isFinite(videoHeight) ||
        videoWidth <= 0 ||
        videoHeight <= 0
      ) {
        fail('视频元数据无效，请选择可正常播放的视频。')
        return
      }

      settled = true
      cleanupListeners()
      resolve({
        file,
        name: file.name,
        size: file.size,
        duration,
        width: videoWidth,
        height: videoHeight,
        video,
        objectUrl,
      })
    }

    const handleError = () => {
      fail('视频无法读取，文件可能已损坏或浏览器不支持该编码。')
    }

    const timeoutId = window.setTimeout(() => {
      fail('视频元数据读取超时，请更换文件后重试。')
    }, METADATA_TIMEOUT_MS)

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('error', handleError)
    video.src = objectUrl
  })
}

export function releaseVideoAsset(asset: VideoAsset | null | undefined): void {
  if (!asset || releasedAssets.has(asset)) return
  releasedAssets.add(asset)

  const cleanupErrors: unknown[] = []

  try {
    asset.video.pause()
    asset.video.removeAttribute('src')
    asset.video.load()
  } catch (error) {
    cleanupErrors.push(error)
  }

  try {
    URL.revokeObjectURL(asset.objectUrl)
  } catch (error) {
    cleanupErrors.push(error)
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, '视频资源释放失败。')
  }
}

export function releaseLoadedVideo(asset: LoadedVideo | null | undefined): void {
  releaseVideoAsset(asset)
}
