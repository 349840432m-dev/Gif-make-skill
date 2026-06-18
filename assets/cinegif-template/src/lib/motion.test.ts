import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type MotionId } from '../types'
import {
  calculateCanvasSize,
  calculateCoverRect,
  calculateTransform,
  drawFrame,
} from './motion'

const motions: MotionId[] = ['zoom', 'float', 'pulse', 'sway', 'orbit', 'parallax']

describe('calculateTransform', () => {
  it.each(motions)('%s is deterministic and closes its loop', (motion) => {
    const first = calculateTransform(motion, 0, 75, 1, true)

    expect(calculateTransform(motion, 0, 75, 1, true)).toEqual(first)
    expect(calculateTransform(motion, 1, 75, 1, true)).toEqual(first)
  })

  it('uses speed to advance the animation phase', () => {
    expect(calculateTransform('float', 0.125, 100, 2)).toEqual(
      calculateTransform('float', 0.25, 100, 1),
    )
  })

  it('clamps invalid progress, intensity, and speed inputs', () => {
    expect(calculateTransform('zoom', Number.NaN, Number.POSITIVE_INFINITY, -2)).toEqual({
      scale: 1,
      rotation: 0,
      x: 0,
      y: 0,
    })
    expect(calculateTransform('pulse', 0.5, 200).scale).toBeCloseTo(1.08)
  })

  it.each(motions)('%s becomes an identity transform at zero intensity', (motion) => {
    expect(calculateTransform(motion, 0.25, 0)).toEqual({
      scale: 1,
      rotation: 0,
      x: 0,
      y: 0,
    })
  })
})

describe('calculateCanvasSize', () => {
  it('preserves the original image ratio', () => {
    expect(calculateCanvasSize(1920, 1080, 'original', 640)).toEqual({
      width: 640,
      height: 360,
    })
  })

  it.each([
    ['16:9', 360],
    ['4:3', 480],
    ['1:1', 640],
    ['9:16', 1138],
  ] as const)('calculates the %s canvas', (ratio, height) => {
    expect(calculateCanvasSize(1200, 800, ratio, 640)).toEqual({ width: 640, height })
  })

  it('converges invalid dimensions to a drawable size', () => {
    expect(calculateCanvasSize(0, Number.NaN, 'original', -100)).toEqual({
      width: 1,
      height: 1,
    })
  })
})

describe('calculateCoverRect', () => {
  it('center-crops a wide image into a square canvas', () => {
    expect(calculateCoverRect(1600, 900, { width: 600, height: 600 })).toEqual({
      x: (600 - 1600 * (600 / 900)) / 2,
      y: 0,
      width: 1600 * (600 / 900),
      height: 600,
    })
  })

  it('center-crops a tall image into a wide canvas', () => {
    expect(calculateCoverRect(900, 1600, { width: 1600, height: 900 })).toEqual({
      x: 0,
      y: (900 - 1600 * (1600 / 900)) / 2,
      width: 1600,
      height: 1600 * (1600 / 900),
    })
  })
})

describe('drawFrame', () => {
  it('clears, transforms, draws with cover sizing, and restores the context', () => {
    const context = {
      save: vi.fn(),
      clearRect: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const image = { width: 1600, height: 900 } as CanvasImageSource

    drawFrame(context, image, DEFAULT_SETTINGS, 0, { width: 640, height: 640 })

    expect(context.save).toHaveBeenCalledOnce()
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 640, 640)
    expect(context.translate).toHaveBeenCalledWith(320, 320)
    expect(context.rotate).toHaveBeenCalledWith(0)
    expect(context.scale).toHaveBeenCalledWith(1, 1)
    expect(context.drawImage).toHaveBeenCalledWith(
      image,
      expect.closeTo(-568.8888888888889),
      -320,
      expect.closeTo(1137.7777777777778),
      640,
    )
    expect(context.restore).toHaveBeenCalledOnce()
  })
})
