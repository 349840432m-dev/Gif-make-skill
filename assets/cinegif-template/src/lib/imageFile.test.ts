import { describe, expect, it } from 'vitest'
import { validateImageFile } from './imageFile'

describe('validateImageFile', () => {
  it('accepts supported local image formats', () => {
    expect(validateImageFile(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))).toBeNull()
    expect(validateImageFile(new File(['x'], 'photo.png', { type: 'image/png' }))).toBeNull()
    expect(validateImageFile(new File(['x'], 'photo.webp', { type: 'image/webp' }))).toBeNull()
  })

  it('rejects unsupported, empty, and oversized files', () => {
    expect(validateImageFile(new File(['x'], 'photo.gif', { type: 'image/gif' }))).toContain(
      '仅支持',
    )
    expect(validateImageFile(new File([], 'photo.png', { type: 'image/png' }))).toContain('为空')
    expect(
      validateImageFile(
        new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'huge.png', {
          type: 'image/png',
        }),
      ),
    ).toContain('20 MB')
  })
})
