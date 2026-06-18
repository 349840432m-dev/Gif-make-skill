import type {
  AnimationSettings,
  AspectRatioId,
  CanvasSize,
  FrameTransform,
  MotionId,
} from '../types'

export interface DrawRect {
  x: number
  y: number
  width: number
  height: number
}

const TAU = Math.PI * 2
const MAX_CANVAS_DIMENSION = 8192

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback

const positiveDimension = (value: number): number =>
  clamp(Math.round(finiteOr(value, 1)), 1, MAX_CANVAS_DIMENSION)

const positiveSourceDimension = (value: number): number => {
  const finite = finiteOr(value, 1)
  return finite > 0 ? finite : 1
}

const normalizedPhase = (progress: number, speed: number, loop: boolean): number => {
  const phase = finiteOr(progress, 0) * clamp(finiteOr(speed, 1), 0, 10)
  return loop ? ((phase % 1) + 1) % 1 : clamp(phase, 0, 1)
}

export function calculateTransform(
  motion: MotionId,
  progress: number,
  intensity = 60,
  speed = 1,
  loop = true,
): FrameTransform {
  const amount = clamp(finiteOr(intensity, 60), 0, 100) / 100
  if (amount === 0) {
    return { scale: 1, rotation: 0, x: 0, y: 0 }
  }

  const phase = normalizedPhase(progress, speed, loop)
  const angle = phase * TAU
  const wave = Math.sin(angle)
  const cycle = (1 - Math.cos(angle)) / 2

  switch (motion) {
    case 'zoom':
      return { scale: 1 + 0.12 * amount * (loop ? cycle : phase), rotation: 0, x: 0, y: 0 }
    case 'float':
      return { scale: 1 + 0.02 * amount, rotation: 0, x: 0, y: -16 * amount * wave }
    case 'pulse':
      return { scale: 1 + 0.08 * amount * cycle, rotation: 0, x: 0, y: 0 }
    case 'sway':
      return {
        scale: 1 + 0.03 * amount,
        rotation: 0.035 * amount * wave,
        x: 10 * amount * wave,
        y: 0,
      }
    case 'orbit':
      return {
        scale: 1 + 0.04 * amount,
        rotation: 0.025 * amount * wave,
        x: 12 * amount * (Math.cos(angle) - 1),
        y: 8 * amount * wave,
      }
    case 'parallax':
      return {
        scale: 1 + 0.05 * amount,
        rotation: 0,
        x: 18 * amount * wave,
        y: -10 * amount * wave,
      }
    default:
      return { scale: 1, rotation: 0, x: 0, y: 0 }
  }
}

export function calculateCanvasSize(
  imageWidth: number,
  imageHeight: number,
  aspectRatio: AspectRatioId,
  outputWidth: number,
): CanvasSize {
  const width = positiveDimension(outputWidth)
  const sourceWidth = positiveSourceDimension(imageWidth)
  const sourceHeight = positiveSourceDimension(imageHeight)
  const ratios: Record<Exclude<AspectRatioId, 'original'>, number> = {
    '16:9': 16 / 9,
    '4:3': 4 / 3,
    '1:1': 1,
    '9:16': 9 / 16,
  }
  const ratio = aspectRatio === 'original' ? sourceWidth / sourceHeight : ratios[aspectRatio]

  return {
    width,
    height: positiveDimension(width / ratio),
  }
}

export function calculateCoverRect(
  imageWidth: number,
  imageHeight: number,
  size: CanvasSize,
): DrawRect {
  const sourceWidth = positiveSourceDimension(imageWidth)
  const sourceHeight = positiveSourceDimension(imageHeight)
  const canvasWidth = positiveDimension(size.width)
  const canvasHeight = positiveDimension(size.height)
  const scale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale

  return {
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
  }
}

function imageDimensions(image: CanvasImageSource): CanvasSize {
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    }
  }

  if (typeof HTMLVideoElement !== 'undefined' && image instanceof HTMLVideoElement) {
    return {
      width: image.videoWidth || image.width,
      height: image.videoHeight || image.height,
    }
  }

  return {
    width: 'width' in image ? Number(image.width) : 1,
    height: 'height' in image ? Number(image.height) : 1,
  }
}

export function drawFrame(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  settings: AnimationSettings,
  progress: number,
  size: CanvasSize,
): void {
  const canvasWidth = positiveDimension(size.width)
  const canvasHeight = positiveDimension(size.height)
  const source = imageDimensions(image)
  const rect = calculateCoverRect(source.width, source.height, {
    width: canvasWidth,
    height: canvasHeight,
  })
  const transform = calculateTransform(
    settings.motion,
    progress,
    settings.intensity,
    settings.speed,
    settings.loop,
  )

  context.save()
  try {
    context.clearRect(0, 0, canvasWidth, canvasHeight)
    context.translate(canvasWidth / 2 + transform.x, canvasHeight / 2 + transform.y)
    context.rotate(transform.rotation)
    context.scale(transform.scale, transform.scale)
    context.drawImage(
      image,
      rect.x - canvasWidth / 2,
      rect.y - canvasHeight / 2,
      rect.width,
      rect.height,
    )
  } finally {
    context.restore()
  }
}
