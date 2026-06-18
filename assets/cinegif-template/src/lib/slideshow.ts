export type TransitionId = 'none' | 'fade' | 'slide'

export interface SlideshowTiming {
  holdDuration: number
  transitionDuration: number
  loop?: boolean
}

export interface SlideshowState {
  currentIndex: number
  nextIndex: number
  localProgress: number
  transitionProgress: number
}

export interface TransitionVisuals {
  currentOpacity: number
  nextOpacity: number
  currentTranslateXPercent: number
  nextTranslateXPercent: number
}

export const DEFAULT_HOLD_DURATION = 1.5
export const DEFAULT_TRANSITION_DURATION = 0.4

const MIN_IMAGE_COUNT = 2
const MAX_IMAGE_COUNT = 10

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

function validateImageCount(imageCount: number): void {
  if (
    !Number.isInteger(imageCount) ||
    imageCount < MIN_IMAGE_COUNT ||
    imageCount > MAX_IMAGE_COUNT
  ) {
    throw new RangeError('imageCount must be an integer between 2 and 10')
  }
}

export function normalizeSlideshowTiming(
  timing: Partial<SlideshowTiming> = {},
): SlideshowTiming {
  const holdDuration = timing.holdDuration ?? DEFAULT_HOLD_DURATION
  const transitionDuration = timing.transitionDuration ?? DEFAULT_TRANSITION_DURATION

  if (!Number.isFinite(holdDuration) || holdDuration <= 0) {
    throw new RangeError('holdDuration must be a positive finite number')
  }
  if (!Number.isFinite(transitionDuration) || transitionDuration < 0) {
    throw new RangeError('transitionDuration must be a non-negative finite number')
  }

  return {
    holdDuration,
    transitionDuration: Math.min(transitionDuration, holdDuration),
  }
}

export function calculateSlideshowDuration(
  imageCount: number,
  holdDuration = DEFAULT_HOLD_DURATION,
): number {
  validateImageCount(imageCount)
  return imageCount * normalizeSlideshowTiming({ holdDuration }).holdDuration
}

function wrap(value: number, length: number): number {
  return ((value % length) + length) % length
}

export function getSlideshowStateAtTime(
  imageCount: number,
  time: number,
  timing: Partial<SlideshowTiming> = {},
): SlideshowState {
  validateImageCount(imageCount)
  const normalizedTiming = normalizeSlideshowTiming(timing)
  const totalDuration = imageCount * normalizedTiming.holdDuration
  const safeTime = Number.isFinite(time) ? time : 0
  const loopTime = timing.loop === false
    ? clamp(safeTime, 0, Math.max(0, totalDuration - 1e-9))
    : wrap(safeTime, totalDuration)
  const currentIndex = Math.floor(loopTime / normalizedTiming.holdDuration)
  const localTime = loopTime - currentIndex * normalizedTiming.holdDuration
  const localProgress = localTime / normalizedTiming.holdDuration
  const isFinalNonLoopFrame = timing.loop === false && currentIndex === imageCount - 1
  const transitionStart =
    normalizedTiming.holdDuration - normalizedTiming.transitionDuration
  const transitionProgress =
    normalizedTiming.transitionDuration === 0 || isFinalNonLoopFrame
      ? 0
      : clamp(
          (localTime - transitionStart) / normalizedTiming.transitionDuration,
          0,
          1,
        )

  return {
    currentIndex,
    nextIndex: isFinalNonLoopFrame ? currentIndex : (currentIndex + 1) % imageCount,
    localProgress,
    transitionProgress,
  }
}

export function getSlideshowStateAtProgress(
  imageCount: number,
  progress: number,
  timing: Partial<SlideshowTiming> = {},
): SlideshowState {
  const normalizedTiming = normalizeSlideshowTiming(timing)
  const totalDuration = calculateSlideshowDuration(
    imageCount,
    normalizedTiming.holdDuration,
  )
  const safeProgress = Number.isFinite(progress) ? progress : 0

  return getSlideshowStateAtTime(
    imageCount,
    (timing.loop === false ? clamp(safeProgress, 0, 1) : wrap(safeProgress, 1)) * totalDuration,
    { ...normalizedTiming, loop: timing.loop },
  )
}

export function calculateTransitionVisuals(
  transition: TransitionId,
  transitionProgress: number,
): TransitionVisuals {
  const progress = clamp(
    Number.isFinite(transitionProgress) ? transitionProgress : 0,
    0,
    1,
  )

  switch (transition) {
    case 'fade':
      return {
        currentOpacity: 1 - progress,
        nextOpacity: progress,
        currentTranslateXPercent: 0,
        nextTranslateXPercent: 0,
      }
    case 'slide':
      return {
        currentOpacity: 1,
        nextOpacity: 1,
        currentTranslateXPercent: progress === 0 ? 0 : -100 * progress,
        nextTranslateXPercent: 100 * (1 - progress),
      }
    case 'none':
    default:
      return {
        currentOpacity: 1,
        nextOpacity: 0,
        currentTranslateXPercent: 0,
        nextTranslateXPercent: 0,
      }
  }
}
