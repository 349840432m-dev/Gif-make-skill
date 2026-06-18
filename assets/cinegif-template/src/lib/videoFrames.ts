import type { AspectRatioId, CanvasSize } from '../types'
import { CANVAS_BACKGROUND } from './constants'

export const MAX_VIDEO_CLIP_DURATION = 8
export const MAX_VIDEO_FRAME_COUNT = 240
export const MAX_VIDEO_FPS = 30

export interface VideoClipSettingsInput {
  start: number
  end: number
  fps: number
  playbackSpeed?: number
  aspectRatio?: AspectRatioId
  outputWidth?: number
}

export interface VideoClipSettings {
  start: number
  end: number
  fps: number
  playbackSpeed: number
  aspectRatio?: AspectRatioId
  outputWidth?: number
}

export interface SeekVideoOptions {
  timeoutMs?: number
  toleranceSeconds?: number
}

const DEFAULT_SEEK_TIMEOUT_MS = 5000
const DEFAULT_SEEK_TOLERANCE_SECONDS = 0.01

function requireFiniteNumber(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} 必须是有限数字。`)
  }
  return value
}

function requirePositiveDimension(value: number, name: string): number {
  const finite = requireFiniteNumber(value, name)
  if (finite <= 0) {
    throw new Error(`${name} 必须大于 0。`)
  }
  return finite
}

function getVideoDimensions(video: HTMLVideoElement): CanvasSize {
  return {
    width: video.videoWidth || video.width,
    height: video.videoHeight || video.height,
  }
}

export function normalizeVideoClipSettings(
  settings: VideoClipSettingsInput,
  videoDuration?: number,
): VideoClipSettings {
  const start = requireFiniteNumber(settings.start, 'start')
  const requestedEnd = requireFiniteNumber(settings.end, 'end')
  const requestedFps = requireFiniteNumber(settings.fps, 'fps')
  const requestedPlaybackSpeed = requireFiniteNumber(settings.playbackSpeed ?? 1, 'playbackSpeed')

  if (start < 0) {
    throw new Error('start 必须是非负数。')
  }
  if (requestedEnd <= start) {
    throw new Error('end 必须大于 start。')
  }
  if (requestedFps <= 0) {
    throw new Error('fps 必须是正数。')
  }
  if (requestedPlaybackSpeed <= 0) {
    throw new Error('playbackSpeed 必须是正数。')
  }

  const safeVideoDuration =
    videoDuration === undefined ? undefined : requirePositiveDimension(videoDuration, 'videoDuration')
  if (safeVideoDuration !== undefined && start >= safeVideoDuration) {
    throw new Error('start 必须小于视频总时长。')
  }

  const durationLimit =
    safeVideoDuration === undefined
      ? start + MAX_VIDEO_CLIP_DURATION
      : Math.min(safeVideoDuration, start + MAX_VIDEO_CLIP_DURATION)
  const end = Math.min(requestedEnd, durationLimit)
  if (end <= start) {
    throw new Error('视频片段时长必须大于 0。')
  }

  return {
    start,
    end,
    fps: Math.min(MAX_VIDEO_FPS, Math.max(1, Math.round(requestedFps))),
    playbackSpeed: Math.min(4, Math.max(0.25, requestedPlaybackSpeed)),
    aspectRatio: settings.aspectRatio,
    outputWidth: settings.outputWidth,
  }
}

export function calculateVideoClipDuration(settings: Pick<VideoClipSettings, 'start' | 'end'>): number {
  const start = requireFiniteNumber(settings.start, 'start')
  const end = requireFiniteNumber(settings.end, 'end')
  if (start < 0) {
    throw new Error('start 必须是非负数。')
  }
  if (end <= start) {
    throw new Error('end 必须大于 start。')
  }
  return Math.min(MAX_VIDEO_CLIP_DURATION, end - start)
}

export function calculateVideoPlaybackDuration(
  settings: Pick<VideoClipSettings, 'start' | 'end' | 'playbackSpeed'>,
): number {
  const speed = requireFiniteNumber(settings.playbackSpeed, 'playbackSpeed')
  if (speed <= 0) {
    throw new Error('playbackSpeed 必须是正数。')
  }

  return calculateVideoClipDuration(settings) / speed
}

export function calculateVideoFrameCount(
  settings: Pick<VideoClipSettings, 'start' | 'end' | 'fps'> & Partial<Pick<VideoClipSettings, 'playbackSpeed'>>,
): number {
  const fps = requireFiniteNumber(settings.fps, 'fps')
  const playbackSpeed = requireFiniteNumber(settings.playbackSpeed ?? 1, 'playbackSpeed')
  if (fps <= 0) {
    throw new Error('fps 必须是正数。')
  }
  if (playbackSpeed <= 0) {
    throw new Error('playbackSpeed 必须是正数。')
  }

  const duration = calculateVideoClipDuration(settings) / playbackSpeed
  return Math.min(MAX_VIDEO_FRAME_COUNT, Math.max(1, Math.ceil(duration * Math.round(fps))))
}

export function seekVideoTo(
  video: HTMLVideoElement,
  timeSeconds: number,
  options: SeekVideoOptions = {},
): Promise<void> {
  const rawTargetTime = requireFiniteNumber(timeSeconds, 'timeSeconds')
  const tolerance = options.toleranceSeconds ?? DEFAULT_SEEK_TOLERANCE_SECONDS
  const targetTime = rawTargetTime < 0 && rawTargetTime >= -tolerance ? 0 : rawTargetTime
  if (targetTime < 0) {
    throw new Error('timeSeconds 必须是非负数。')
  }

  if (Math.abs(video.currentTime - targetTime) <= tolerance && !video.seeking) {
    return Promise.resolve()
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_SEEK_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
      clearTimeout(timeoutId)
    }
    const handleSeeked = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('视频定位失败。'))
    }

    video.addEventListener('seeked', handleSeeked, { once: true })
    video.addEventListener('error', handleError, { once: true })
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('视频定位超时。'))
    }, timeoutMs)

    try {
      video.currentTime = targetTime
    } catch (reason) {
      cleanup()
      reject(reason instanceof Error ? reason : new Error('视频定位失败。'))
    }
  })
}

export function drawVideoFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  size: CanvasSize,
): void {
  const canvasWidth = Math.round(requirePositiveDimension(size.width, 'width'))
  const canvasHeight = Math.round(requirePositiveDimension(size.height, 'height'))
  const source = getVideoDimensions(video)
  const sourceWidth = requirePositiveDimension(source.width, 'videoWidth')
  const sourceHeight = requirePositiveDimension(source.height, 'videoHeight')
  const scale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  const x = (canvasWidth - drawWidth) / 2
  const y = (canvasHeight - drawHeight) / 2

  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.fillStyle = CANVAS_BACKGROUND
  context.fillRect(0, 0, canvasWidth, canvasHeight)
  context.drawImage(video, x, y, drawWidth, drawHeight)
}
