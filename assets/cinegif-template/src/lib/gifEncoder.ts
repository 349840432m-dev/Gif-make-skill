import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import type { AnimationSettings, ExportProgress } from '../types'
import { calculateCanvasSize, drawFrame as drawMotionFrame } from './motion'

export interface EncodeGifOptions {
  image: HTMLImageElement
  settings: AnimationSettings
  signal?: AbortSignal
  onProgress?: (progress: ExportProgress) => void
}

export interface EncodeGifFramesOptions {
  width: number
  height: number
  fps: number
  frameCount: number
  loop: boolean
  signal?: AbortSignal
  onProgress?: (progress: ExportProgress) => void
  drawFrame: (
    context: CanvasRenderingContext2D,
    index: number,
    progress: number,
  ) => void | Promise<void>
}

export const MAX_FRAMES = 240

const nextTask = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

export function calculateFrameCount(duration: number, fps: number): number {
  const safeDuration = Number.isFinite(duration) ? Math.min(8, Math.max(1, duration)) : 3
  const safeFps = Number.isFinite(fps) ? Math.min(24, Math.max(1, Math.round(fps))) : 12
  return Math.min(MAX_FRAMES, Math.max(1, Math.round(safeDuration * safeFps)))
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('GIF 导出已取消。', 'AbortError')
  }
}

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} 必须是正整数。`)
  }
}

export async function encodeGifFrames({
  width,
  height,
  fps,
  frameCount,
  loop,
  signal,
  onProgress,
  drawFrame,
}: EncodeGifFramesOptions): Promise<Blob> {
  throwIfAborted(signal)
  requirePositiveInteger(width, 'width')
  requirePositiveInteger(height, 'height')
  requirePositiveInteger(frameCount, 'frameCount')
  if (frameCount > MAX_FRAMES) {
    throw new Error(`GIF 最多支持 ${MAX_FRAMES} 帧，请降低时长、帧率或图片数量。`)
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error('fps 必须是正数。')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('当前浏览器无法创建 GIF 编码画布。')
  }

  const delay = Math.max(20, Math.round(1000 / fps))
  const gif = GIFEncoder()

  try {
    for (let frame = 0; frame < frameCount; frame += 1) {
      throwIfAborted(signal)
      const progress = frameCount === 1 ? 0 : frame / frameCount
      onProgress?.({
        phase: 'rendering',
        progress: Math.round(progress * 65),
        message: `正在绘制第 ${frame + 1} / ${frameCount} 帧`,
      })

      await drawFrame(context, frame, progress)
      throwIfAborted(signal)
      const rgba = context.getImageData(0, 0, width, height).data

      onProgress?.({
        phase: 'encoding',
        progress: Math.round(65 + progress * 34),
        message: `正在压缩第 ${frame + 1} / ${frameCount} 帧`,
      })
      const palette = quantize(rgba, 256, { format: 'rgb565' })
      const index = applyPalette(rgba, palette, 'rgb565')
      gif.writeFrame(index, width, height, {
        palette,
        delay,
        repeat: loop ? 0 : -1,
      })

      await nextTask()
    }

    throwIfAborted(signal)
    gif.finish()
    const bytes = gif.bytesView()
    if (bytes.length < 6) {
      throw new Error('GIF 编码结果为空，请降低输出尺寸后重试。')
    }
    onProgress?.({ phase: 'encoding', progress: 99, message: '正在整理 GIF 文件' })
    return new Blob([bytes.slice()], { type: 'image/gif' })
  } catch (reason) {
    if (signal?.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
      throw new DOMException('GIF 导出已取消。', 'AbortError')
    }
    throw new Error(reason instanceof Error ? `GIF 编码失败：${reason.message}` : 'GIF 编码失败。')
  }
}

export async function encodeGif({
  image,
  settings,
  signal,
  onProgress,
}: EncodeGifOptions): Promise<Blob> {
  throwIfAborted(signal)
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('图片尚未载入完成，无法导出。')
  }

  const size = calculateCanvasSize(
    image.naturalWidth,
    image.naturalHeight,
    settings.aspectRatio,
    settings.outputWidth,
  )

  return encodeGifFrames({
    ...size,
    fps: settings.fps,
    frameCount: calculateFrameCount(settings.duration, settings.fps),
    loop: settings.loop,
    signal,
    onProgress,
    drawFrame: (context, _index, progress) => {
      drawMotionFrame(context, image, settings, progress, size)
    },
  })
}
