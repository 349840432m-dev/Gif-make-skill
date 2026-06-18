import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadImageFile, releaseLoadedImage } from './imageFile'
import {
  MAX_IMAGE_ASSETS,
  MAX_TOTAL_IMAGE_BYTES,
  appendImageAssets,
  loadMultiImageAssets,
  moveImageAsset,
  releaseImageAsset,
  releaseImageAssets,
  removeImageAsset,
  validateMultiImageFiles,
  type MultiImageAsset,
} from './multiImageAssets'

vi.mock('./imageFile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./imageFile')>()
  return {
    ...actual,
    loadImageFile: vi.fn(),
    releaseLoadedImage: vi.fn(),
  }
})

function file(name: string, type = 'image/png'): File {
  return new File(['image'], name, { type, lastModified: 123 })
}

function loaded(name: string, width = 100, height = 80) {
  const image = { naturalWidth: width, naturalHeight: height } as HTMLImageElement
  return { image, objectUrl: `blob:${name}`, name, size: 5 }
}

function asset(id: string): MultiImageAsset {
  const resource = loaded(`${id}.png`)
  return {
    id,
    file: file(`${id}.png`),
    width: resource.image.naturalWidth,
    height: resource.image.naturalHeight,
    bitmap: resource.image,
    loaded: resource,
  }
}

const mockedLoadImageFile = vi.mocked(loadImageFile)
const mockedReleaseLoadedImage = vi.mocked(releaseLoadedImage)

describe('multi-image validation and loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedLoadImageFile.mockImplementation(async (input) => loaded(input.name))
  })

  it('requires 2-10 valid files for the initial batch', () => {
    expect(validateMultiImageFiles([])).toContain('2-10')
    expect(validateMultiImageFiles([file('one.png')])).toContain('至少 2')
    expect(
      validateMultiImageFiles(
        Array.from({ length: MAX_IMAGE_ASSETS + 1 }, (_, index) => file(`${index}.png`)),
      ),
    ).toContain('不能超过 10')
    expect(validateMultiImageFiles([file('one.png'), file('two.webp', 'image/webp')])).toBeNull()
  })

  it('rejects the whole batch when one file is invalid before decoding', async () => {
    const files = [file('valid.png'), file('invalid.gif', 'image/gif')]

    expect(validateMultiImageFiles(files)).toContain('第 2 张')
    await expect(loadMultiImageAssets(files)).rejects.toThrow('第 2 张')
    expect(mockedLoadImageFile).not.toHaveBeenCalled()
  })

  it('enforces the total after repeated appends', async () => {
    const existing = Array.from({ length: 9 }, (_, index) => asset(`existing-${index}`))

    await expect(
      loadMultiImageAssets([file('ten.png'), file('eleven.png')], existing),
    ).rejects.toThrow('不能超过 10')
    expect(mockedLoadImageFile).not.toHaveBeenCalled()
    expect(() => appendImageAssets(existing, [asset('ten'), asset('eleven')])).toThrow(
      '不能超过 10',
    )
  })

  it('rejects batches that exceed the total byte budget before decoding', async () => {
    expect(validateMultiImageFiles([file('one.png'), file('two.png')], 0, MAX_TOTAL_IMAGE_BYTES + 1))
      .toContain('总大小')
    expect(mockedLoadImageFile).not.toHaveBeenCalled()
  })

  it('releases decoded files when the total pixel budget is exceeded', async () => {
    const firstLoaded = loaded('first.png', 50_000, 1_000)
    const secondLoaded = loaded('second.png', 50_000, 1_000)
    mockedLoadImageFile
      .mockResolvedValueOnce(firstLoaded)
      .mockResolvedValueOnce(secondLoaded)

    await expect(loadMultiImageAssets([file('first.png'), file('second.png')]))
      .rejects.toThrow('总像素')
    expect(mockedReleaseLoadedImage).toHaveBeenCalledWith(firstLoaded)
    expect(mockedReleaseLoadedImage).toHaveBeenCalledWith(secondLoaded)
  })

  it('creates stable unique ids, including duplicate files', async () => {
    const duplicate = file('same.png')
    const first = await loadMultiImageAssets([duplicate, duplicate])
    const second = await loadMultiImageAssets([duplicate], first)

    expect(first.map(({ id }) => id)).toEqual([
      expect.stringMatching(/^image-/),
      expect.stringMatching(/^image-.+-2$/),
    ])
    expect(second.slice(0, 2).map(({ id }) => id)).toEqual(first.map(({ id }) => id))
    expect(new Set(second.map(({ id }) => id))).toHaveLength(3)
  })

  it('releases already decoded files when a later decode fails', async () => {
    const firstLoaded = loaded('first.png')
    mockedLoadImageFile
      .mockResolvedValueOnce(firstLoaded)
      .mockRejectedValueOnce(new Error('decode failed'))

    await expect(loadMultiImageAssets([file('first.png'), file('second.png')])).rejects.toThrow(
      'decode failed',
    )
    expect(mockedReleaseLoadedImage).toHaveBeenCalledWith(firstLoaded)
  })
})

describe('immutable asset operations', () => {
  it('appends, removes, and moves without mutating the input arrays', () => {
    const first = asset('first')
    const second = asset('second')
    const third = asset('third')
    const initial = [first, second]

    expect(appendImageAssets(initial, [third])).toEqual([first, second, third])
    expect(removeImageAsset(initial, 'first')).toEqual([second])
    expect(moveImageAsset([first, second, third], 0, 2)).toEqual([second, third, first])
    expect(initial).toEqual([first, second])
  })

  it('rejects invalid move indexes', () => {
    expect(() => moveImageAsset([asset('first')], -1, 0)).toThrow('索引超出范围')
    expect(() => moveImageAsset([asset('first')], 0, 1)).toThrow('索引超出范围')
  })
})

describe('asset release', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('closes bitmaps, revokes loaded resources, and is idempotent', () => {
    const close = vi.fn()
    const first = asset('first')
    first.bitmap = { close } as unknown as ImageBitmap

    expect(() => {
      releaseImageAsset(first)
      releaseImageAsset(first)
      releaseImageAssets([first])
    }).not.toThrow()
    expect(close).toHaveBeenCalledTimes(1)
    expect(mockedReleaseLoadedImage).toHaveBeenCalledTimes(1)
  })

  it('does not throw when bitmap or URL cleanup fails', () => {
    const broken = asset('broken')
    broken.bitmap = {
      close: () => {
        throw new Error('close failed')
      },
    } as unknown as ImageBitmap
    mockedReleaseLoadedImage.mockImplementationOnce(() => {
      throw new Error('revoke failed')
    })

    expect(() => releaseImageAsset(broken)).not.toThrow()
  })
})
