import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadVideoFile,
  releaseVideoAsset,
  validateVideoFile,
  type VideoAsset,
} from './videoFile'

const originalCreateElement = document.createElement.bind(document)

function mockObjectUrl() {
  const createObjectURL = vi.fn(() => 'blob:video-test')
  const revokeObjectURL = vi.fn()

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  })

  return { createObjectURL, revokeObjectURL }
}

function mockVideoElement({
  duration = 12.5,
  width = 1920,
  height = 1080,
  event = 'canplay',
}: {
  duration?: number
  width?: number
  height?: number
  event?: 'canplay' | 'error'
} = {}) {
  return vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
    const element = originalCreateElement(tagName, options)
    if (tagName !== 'video') return element
    const video = element as HTMLVideoElement

    Object.defineProperties(video, {
      duration: { configurable: true, value: duration },
      videoWidth: { configurable: true, value: width },
      videoHeight: { configurable: true, value: height },
      src: {
        configurable: true,
        set() {
          queueMicrotask(() => video.dispatchEvent(new Event(event)))
        },
      },
    })
    video.pause = vi.fn()
    video.load = vi.fn()
    return video
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('validateVideoFile', () => {
  it('accepts supported local video formats', () => {
    expect(validateVideoFile(new File(['x'], 'clip.mp4', { type: 'video/mp4' }))).toBeNull()
    expect(validateVideoFile(new File(['x'], 'clip.webm', { type: 'video/webm' }))).toBeNull()
    expect(
      validateVideoFile(new File(['x'], 'clip.mov', { type: 'video/quicktime' })),
    ).toBeNull()
  })

  it('rejects unsupported, empty, and oversized files', () => {
    expect(validateVideoFile(new File(['x'], 'clip.avi', { type: 'video/x-msvideo' }))).toContain(
      '仅支持',
    )
    expect(validateVideoFile(new File([], 'clip.mp4', { type: 'video/mp4' }))).toContain('为空')
    expect(
      validateVideoFile(
        new File([new Uint8Array(100 * 1024 * 1024 + 1)], 'huge.mp4', {
          type: 'video/mp4',
        }),
      ),
    ).toContain('100 MB')
  })
})

describe('loadVideoFile', () => {
  it('loads metadata on canplay and returns a stable VideoAsset', async () => {
    const { createObjectURL, revokeObjectURL } = mockObjectUrl()
    mockVideoElement({ duration: 9.75, width: 1280, height: 720 })

    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    const asset = await loadVideoFile(file)

    expect(asset).toMatchObject({
      file,
      name: 'clip.mp4',
      size: file.size,
      duration: 9.75,
      width: 1280,
      height: 720,
      objectUrl: 'blob:video-test',
    })
    expect(asset.video).toBeInstanceOf(HTMLVideoElement)
    expect(createObjectURL).toHaveBeenCalledWith(file)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('rejects invalid files before creating an object URL', async () => {
    const { createObjectURL } = mockObjectUrl()

    await expect(
      loadVideoFile(new File(['x'], 'clip.gif', { type: 'image/gif' })),
    ).rejects.toThrow('仅支持')
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('revokes the object URL when metadata is invalid', async () => {
    const { revokeObjectURL } = mockObjectUrl()
    mockVideoElement({ duration: Number.NaN, width: 0, height: 720 })

    await expect(
      loadVideoFile(new File(['video'], 'clip.webm', { type: 'video/webm' })),
    ).rejects.toThrow('视频元数据无效')
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:video-test')
  })

  it('rejects unreadable videos with a Chinese error and revokes the object URL', async () => {
    const { revokeObjectURL } = mockObjectUrl()
    mockVideoElement({ event: 'error' })

    await expect(
      loadVideoFile(new File(['video'], 'broken.mov', { type: 'video/quicktime' })),
    ).rejects.toThrow('视频无法读取')
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})

describe('releaseVideoAsset', () => {
  it('releases video resources idempotently', () => {
    const { revokeObjectURL } = mockObjectUrl()
    const video = originalCreateElement('video')
    video.pause = vi.fn()
    video.load = vi.fn()
    const asset: VideoAsset = {
      file: new File(['video'], 'clip.mp4', { type: 'video/mp4' }),
      name: 'clip.mp4',
      size: 5,
      duration: 1,
      width: 640,
      height: 360,
      video,
      objectUrl: 'blob:release-test',
    }

    releaseVideoAsset(asset)
    releaseVideoAsset(asset)

    expect(video.pause).toHaveBeenCalledTimes(1)
    expect(video.hasAttribute('src')).toBe(false)
    expect(video.load).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:release-test')
  })
})
