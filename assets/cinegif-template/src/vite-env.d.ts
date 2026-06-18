/// <reference types="vite/client" />

declare module 'gifenc' {
  export function GIFEncoder(options?: { auto?: boolean }): {
    writeFrame(index: Uint8Array, width: number, height: number, options: {
      palette: number[][]
      delay?: number
      repeat?: number
      dispose?: number
    }): void
    finish(): void
    bytesView(): Uint8Array
  }
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string },
  ): number[][]
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array
}
