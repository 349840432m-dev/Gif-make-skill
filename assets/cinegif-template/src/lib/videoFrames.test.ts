import { describe, expect, it, vi } from 'vitest'
import type { CanvasSize } from '../types'
import { CANVAS_BACKGROUND } from './constants'
import {
  MAX_VIDEO_CLIP_DURATION,
  MAX_VIDEO_FPS,
  MAX_VIDEO_FRAME_COUNT,
  calculateVideoClipDuration,
  calculateVideoFrameCount,
  calculateVideoPlaybackDuration,
  drawVideoFrame,
  normalizeVideoClipSettings,
  seekVideoTo,
} from './videoFrames'

function createVideo(overrides: Partial<HTMLVideoElement> = {}) {
  const target = new EventTarget()
  let currentTime = overrides.currentTime ?? 0
  const video = {
    videoWidth: 0,
    videoHeight: 0,
    width: 0,
    height: 0,
    seeking: false,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    ...overrides,
  } as HTMLVideoElement

  Object.defineProperty(video, 'currentTime', {
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value
    },
  })

  return video
}

function createContext() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

describe('normalizeVideoClipSettings', () => {
  it('keeps valid settings compatible with existing canvas options', () => {
    expect(
      normalizeVideoClipSettings({
        start: 1,
        end: 5,
        fps: 12,
        playbackSpeed: 1.5,
        aspectRatio: '16:9',
        outputWidth: 640,
      }),
    ).toEqual({
      start: 1,
      end: 5,
      fps: 12,
      playbackSpeed: 1.5,
      aspectRatio: '16:9',
      outputWidth: 640,
    })
  })

  it('converges duration, video bounds, and fps into the supported budget', () => {
    expect(normalizeVideoClipSettings({ start: 2, end: 30, fps: 100 }, 9)).toEqual({
      start: 2,
      end: 9,
      fps: MAX_VIDEO_FPS,
      playbackSpeed: 1,
      aspectRatio: undefined,
      outputWidth: undefined,
    })
    expect(normalizeVideoClipSettings({ start: 2, end: 30, fps: 100 }).end).toBe(
      2 + MAX_VIDEO_CLIP_DURATION,
    )
  })

  it('throws clear errors for invalid start, end, fps, and video duration', () => {
    expect(() => normalizeVideoClipSettings({ start: -1, end: 2, fps: 12 })).toThrow('start')
    expect(() => normalizeVideoClipSettings({ start: 2, end: 2, fps: 12 })).toThrow('end')
    expect(() => normalizeVideoClipSettings({ start: 0, end: 2, fps: 0 })).toThrow('fps')
    expect(() => normalizeVideoClipSettings({ start: 0, end: 2, fps: 12, playbackSpeed: 0 })).toThrow(
      'playbackSpeed',
    )
    expect(() => normalizeVideoClipSettings({ start: 10, end: 12, fps: 12 }, 8)).toThrow(
      '视频总时长',
    )
  })
})

describe('calculateVideoClipDuration', () => {
  it('calculates and caps clip duration at 8 seconds', () => {
    expect(calculateVideoClipDuration({ start: 1, end: 3.5 })).toBe(2.5)
    expect(calculateVideoClipDuration({ start: 1, end: 20 })).toBe(MAX_VIDEO_CLIP_DURATION)
  })

  it('rejects invalid ranges', () => {
    expect(() => calculateVideoClipDuration({ start: Number.NaN, end: 2 })).toThrow('start')
    expect(() => calculateVideoClipDuration({ start: 2, end: 1 })).toThrow('end')
  })
})

describe('calculateVideoPlaybackDuration', () => {
  it('divides the source clip duration by playback speed', () => {
    expect(calculateVideoPlaybackDuration({ start: 0, end: 4, playbackSpeed: 2 })).toBe(2)
    expect(calculateVideoPlaybackDuration({ start: 0, end: 4, playbackSpeed: 0.5 })).toBe(8)
  })

  it('rejects invalid playback speed', () => {
    expect(() => calculateVideoPlaybackDuration({ start: 0, end: 4, playbackSpeed: 0 })).toThrow(
      'playbackSpeed',
    )
  })
})

describe('calculateVideoFrameCount', () => {
  it('uses duration and fps without exceeding the frame budget', () => {
    expect(calculateVideoFrameCount({ start: 0, end: 2, fps: 12 })).toBe(24)
    expect(calculateVideoFrameCount({ start: 0, end: 8, fps: 30 })).toBe(MAX_VIDEO_FRAME_COUNT)
    expect(calculateVideoFrameCount({ start: 0, end: 8, fps: 60 })).toBe(MAX_VIDEO_FRAME_COUNT)
  })

  it('rounds fps and keeps at least one frame', () => {
    expect(calculateVideoFrameCount({ start: 0, end: 0.1, fps: 12.4 })).toBe(2)
  })

  it('uses playback speed to calculate the GIF output duration', () => {
    expect(calculateVideoFrameCount({ start: 0, end: 4, fps: 12, playbackSpeed: 2 })).toBe(24)
    expect(calculateVideoFrameCount({ start: 0, end: 4, fps: 12, playbackSpeed: 0.5 })).toBe(96)
  })
})

describe('seekVideoTo', () => {
  it('resolves immediately when video is already at the target time', async () => {
    const video = createVideo({ currentTime: 3 })

    await expect(seekVideoTo(video, 3.005)).resolves.toBeUndefined()
    expect(video.currentTime).toBe(3)
  })

  it('sets currentTime and waits for seeked', async () => {
    const video = createVideo()
    const done = seekVideoTo(video, 4, { timeoutMs: 1000 })

    expect(video.currentTime).toBe(4)
    video.dispatchEvent(new Event('seeked'))

    await expect(done).resolves.toBeUndefined()
  })

  it('normalizes tiny negative floating point drift to zero', async () => {
    const video = createVideo({ currentTime: 1 })
    const done = seekVideoTo(video, -Number.EPSILON, { timeoutMs: 1000 })

    expect(video.currentTime).toBe(0)
    video.dispatchEvent(new Event('seeked'))

    await expect(done).resolves.toBeUndefined()
  })

  it('rejects on media error and invalid time', async () => {
    const video = createVideo()
    const done = seekVideoTo(video, 4, { timeoutMs: 1000 })
    video.dispatchEvent(new Event('error'))

    await expect(done).rejects.toThrow('定位失败')
    expect(() => seekVideoTo(video, -1)).toThrow('非负数')
  })
})

describe('drawVideoFrame', () => {
  it('clears once, fills a dark background, and contains a wide video', () => {
    const context = createContext()
    const video = createVideo({ videoWidth: 1920, videoHeight: 1080 })
    const size: CanvasSize = { width: 640, height: 640 }

    drawVideoFrame(context, video, size)

    expect(context.clearRect).toHaveBeenCalledOnce()
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 640, 640)
    expect(context.fillStyle).toBe(CANVAS_BACKGROUND)
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 640, 640)
    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 140, 640, 360)
  })

  it('contains a tall video without cropping', () => {
    const context = createContext()
    const video = createVideo({ videoWidth: 900, videoHeight: 1600 })

    drawVideoFrame(context, video, { width: 1600, height: 900 })

    expect(context.clearRect).toHaveBeenCalledOnce()
    expect(context.drawImage).toHaveBeenCalledWith(
      video,
      expect.closeTo(546.875),
      0,
      expect.closeTo(506.25),
      900,
    )
  })
})
