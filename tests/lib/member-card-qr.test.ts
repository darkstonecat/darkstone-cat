import { describe, it, expect } from 'vitest'
import jsQR from 'jsqr'
import { buildCardVerifyUrl, isValidCardToken } from '@/lib/member-card/verify-url'
import { buildQrMatrix, qrToPath } from '@/lib/member-card/qr'

const TOKEN = '0123456789abcdef0123456789abcdef'

describe('buildCardVerifyUrl', () => {
  it('points to the unprefixed production verify page', () => {
    expect(buildCardVerifyUrl(TOKEN)).toBe(`https://www.darkstone.cat/verify/${TOKEN}`)
  })

  it('validates the 32 lowercase hex token format', () => {
    expect(isValidCardToken(TOKEN)).toBe(true)
    expect(isValidCardToken(TOKEN.toUpperCase())).toBe(false)
    expect(isValidCardToken(TOKEN.slice(1))).toBe(false)
    expect(isValidCardToken(`${TOKEN}0`)).toBe(false)
    expect(isValidCardToken('000-203')).toBe(false)
    expect(isValidCardToken('')).toBe(false)
  })
})

describe('buildQrMatrix', () => {
  const matrix = buildQrMatrix(buildCardVerifyUrl(TOKEN))

  it('is square with a valid QR size and the three finder patterns', () => {
    expect((matrix.size - 17) % 4).toBe(0)
    expect(matrix.modules).toHaveLength(matrix.size)
    for (const row of matrix.modules) expect(row).toHaveLength(matrix.size)
    const last = matrix.size - 7
    for (const [r, c] of [[0, 0], [0, last], [last, 0]]) {
      // 7x7 finder: dark ring, light ring, dark 3x3 centre
      expect(matrix.modules[r][c]).toBe(true)
      expect(matrix.modules[r + 6][c + 6]).toBe(true)
      expect(matrix.modules[r + 1][c + 1]).toBe(false)
      expect(matrix.modules[r + 3][c + 3]).toBe(true)
    }
  })

  it('is deterministic and differs per token', () => {
    expect(buildQrMatrix(buildCardVerifyUrl(TOKEN)).modules).toEqual(matrix.modules)
    const other = buildQrMatrix(buildCardVerifyUrl('f'.repeat(32)))
    expect(other.modules).not.toEqual(matrix.modules)
  })

  it('decodes back to the verify URL when rasterised with a quiet zone', () => {
    const scale = 8
    const quiet = 4
    const dim = (matrix.size + quiet * 2) * scale
    const rgba = new Uint8ClampedArray(dim * dim * 4).fill(255)
    for (let y = 0; y < matrix.size; y++) {
      for (let x = 0; x < matrix.size; x++) {
        if (!matrix.modules[y][x]) continue
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + quiet) * scale + dy) * dim + (x + quiet) * scale + dx) * 4
            rgba[i] = rgba[i + 1] = rgba[i + 2] = 0
          }
        }
      }
    }
    const decoded = jsQR(rgba, dim, dim)
    expect(decoded?.data).toBe(buildCardVerifyUrl(TOKEN))
  })
})

describe('qrToPath', () => {
  it('emits one rectangle per horizontal run of dark modules', () => {
    const path = qrToPath({ size: 3, modules: [[true, true, false], [false, false, false], [true, false, true]] }, 4)
    expect(path).toBe('M4 4h2v1h-2zM4 6h1v1h-1zM6 6h1v1h-1z')
  })
})
