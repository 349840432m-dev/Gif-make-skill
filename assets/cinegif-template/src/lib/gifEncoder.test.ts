import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../types'
import { MAX_FRAMES, calculateFrameCount, encodeGif, encodeGifFrames } from './gifEncoder'

function createCanvas() {
  const context = {
    save: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray([
        255, 0, 0, 255,
        0, 255, 0, 255,
        0, 0, 255, 255,
        255, 255, 255, 255,
      ]),
    })),
  } as unknown as CanvasRenderingContext2D
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  } as unknown as HTMLCanvasElement

  return { canvas, context }
}

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

describe('calculateFrameCount', () => {
  it('uses duration and fps inside supported boundaries', () => {
    expect(calculateFrameCount(3, 12)).toBe(36)
    expect(calculateFrameCount(8, 24)).toBe(192)
  })

  it('converges invalid and excessive input', () => {
    expect(calculateFrameCount(Number.NaN, Number.NaN)).toBe(36)
    expect(calculateFrameCount(100, 100)).toBe(192)
    expect(calculateFrameCount(-1, 0)).toBe(1)
  })
})

describe('encodeGif', () => {
  it('stops before touching the canvas when already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    const createElement = vi.spyOn(document, 'createElement')

    await expect(
      encodeGif({
        image: { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement,
        settings: DEFAULT_SETTINGS,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(createElement).not.toHaveBeenCalled()
  })

  it('rejects an image that is not ready', async () => {
    await expect(
      encodeGif({
        image: { naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement,
        settings: DEFAULT_SETTINGS,
      }),
    ).rejects.toThrow('尚未载入')
  })

  it('encodes a drawable frame into an image/gif blob', async () => {
    const { canvas } = createCanvas()
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas)
    const progress = vi.fn()

    const blob = await encodeGif({
      image: {
        naturalWidth: 2,
        naturalHeight: 2,
        width: 2,
        height: 2,
      } as HTMLImageElement,
      settings: { ...DEFAULT_SETTINGS, duration: 1, fps: 1, outputWidth: 2 },
      onProgress: progress,
    })

    expect(blob.type).toBe('image/gif')
    expect(blob.size).toBeGreaterThan(6)
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'encoding', progress: 99 }),
    )
    createElement.mockRestore()
  })
})

describe('encodeGifFrames', () => {
  it('rejects frame counts above the export budget before creating a canvas', async () => {
    const createElement = vi.spyOn(document, 'createElement')

    await expect(
      encodeGifFrames({
        width: 2,
        height: 2,
        fps: 24,
        frameCount: MAX_FRAMES + 1,
        loop: true,
        drawFrame: vi.fn(),
      }),
    ).rejects.toThrow(`${MAX_FRAMES} 帧`)
    expect(createElement).not.toHaveBeenCalled()
  })

  it('draws every frame, reports progress, and writes a GIF file header', async () => {
    const { canvas, context } = createCanvas()
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas)
    const drawFrame = vi.fn()
    const onProgress = vi.fn()

    const blob = await encodeGifFrames({
      width: 2,
      height: 2,
      fps: 10,
      frameCount: 3,
      loop: true,
      drawFrame,
      onProgress,
    })

    expect(canvas.width).toBe(2)
    expect(canvas.height).toBe(2)
    expect(drawFrame.mock.calls).toEqual([
      [context, 0, 0],
      [context, 1, 1 / 3],
      [context, 2, 2 / 3],
    ])
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'rendering', progress: 0 }),
    )
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'encoding', progress: 65 }),
    )
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'encoding', progress: 99 }),
    )

    const header = String.fromCharCode(...new Uint8Array(await readBlob(blob)).slice(0, 6))
    expect(header).toBe('GIF89a')
    createElement.mockRestore()
  })

  it('stops drawing when cancelled between frames', async () => {
    const { canvas } = createCanvas()
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas)
    const controller = new AbortController()
    const drawFrame = vi.fn((_context, index: number) => {
      if (index === 0) {
        controller.abort()
      }
    })

    await expect(
      encodeGifFrames({
        width: 2,
        height: 2,
        fps: 10,
        frameCount: 3,
        loop: false,
        signal: controller.signal,
        drawFrame,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(drawFrame).toHaveBeenCalledTimes(1)
    createElement.mockRestore()
  })
})
