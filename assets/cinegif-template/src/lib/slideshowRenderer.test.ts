import { describe, expect, it, vi } from 'vitest'
import { drawSlideshowFrame } from './slideshowRenderer'

function contextStub() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D
}

describe('drawSlideshowFrame', () => {
  it('clears once and draws both fade layers during a transition', () => {
    const context = contextStub()
    const images = [
      { width: 100, height: 100 },
      { width: 100, height: 100 },
    ] as CanvasImageSource[]

    drawSlideshowFrame({
      context,
      images,
      size: { width: 200, height: 100 },
      progress: 0.49,
      holdDuration: 1,
      transitionDuration: 0.5,
      transition: 'fade',
    })

    expect(context.fillRect).toHaveBeenCalledTimes(1)
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 200, 100)
    expect(context.drawImage).toHaveBeenCalledTimes(2)
  })

  it('keeps the final non-loop frame on the last image', () => {
    const context = contextStub()
    const images = [
      { width: 100, height: 100 },
      { width: 120, height: 100 },
    ] as CanvasImageSource[]

    drawSlideshowFrame({
      context,
      images,
      size: { width: 200, height: 100 },
      progress: 1,
      holdDuration: 1,
      transitionDuration: 0.5,
      transition: 'slide',
      loop: false,
    })

    expect(context.drawImage).toHaveBeenCalledTimes(1)
    expect(context.drawImage).toHaveBeenCalledWith(images[1], 40, 0, 120, 100)
  })
})
