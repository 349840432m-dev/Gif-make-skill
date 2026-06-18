import type { CanvasSize, TransitionId } from '../types'
import { CANVAS_BACKGROUND } from './constants'
import {
  calculateTransitionVisuals,
  getSlideshowStateAtProgress,
} from './slideshow'

function imageSize(image: CanvasImageSource): CanvasSize {
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    }
  }
  return {
    width: 'width' in image ? Number(image.width) || 1 : 1,
    height: 'height' in image ? Number(image.height) || 1 : 1,
  }
}

export function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  size: CanvasSize,
  opacity = 1,
  translateXPercent = 0,
): void {
  const source = imageSize(image)
  const scale = Math.min(size.width / source.width, size.height / source.height)
  const width = source.width * scale
  const height = source.height * scale
  const x = (size.width - width) / 2 + (translateXPercent / 100) * size.width
  const y = (size.height - height) / 2

  context.save()
  context.globalAlpha = opacity
  context.drawImage(image, x, y, width, height)
  context.restore()
}

export interface DrawSlideshowFrameOptions {
  context: CanvasRenderingContext2D
  images: readonly CanvasImageSource[]
  size: CanvasSize
  progress: number
  holdDuration: number
  transitionDuration: number
  transition: TransitionId
  loop?: boolean
  background?: string
}

export function drawSlideshowFrame({
  context,
  images,
  size,
  progress,
  holdDuration,
  transitionDuration,
  transition,
  loop = true,
  background = CANVAS_BACKGROUND,
}: DrawSlideshowFrameOptions): void {
  context.save()
  try {
    context.globalAlpha = 1
    context.fillStyle = background
    context.fillRect(0, 0, size.width, size.height)

    if (images.length === 0) return
    if (images.length === 1) {
      drawContainedImage(context, images[0], size)
      return
    }

    const state = getSlideshowStateAtProgress(images.length, progress, {
      holdDuration,
      transitionDuration: transition === 'none' ? 0 : transitionDuration,
      loop,
    })
    const visuals = calculateTransitionVisuals(transition, state.transitionProgress)

    drawContainedImage(
      context,
      images[state.currentIndex],
      size,
      visuals.currentOpacity,
      visuals.currentTranslateXPercent,
    )
    if (
      state.nextIndex !== state.currentIndex &&
      state.transitionProgress > 0 &&
      (visuals.nextOpacity > 0 || transition === 'slide')
    ) {
      drawContainedImage(
        context,
        images[state.nextIndex],
        size,
        visuals.nextOpacity,
        visuals.nextTranslateXPercent,
      )
    }
  } finally {
    context.restore()
  }
}
