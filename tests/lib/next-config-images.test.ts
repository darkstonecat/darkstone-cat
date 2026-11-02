import { describe, it, expect } from 'vitest'
import nextConfig from '../../next.config'

// Hosts Ludoya serves event and game images from. `next/image` throws in development and the
// production optimizer answers 400 for any host missing from `images.remotePatterns`, and the
// browser blocks one missing from the CSP `img-src`. Ludoya moved to images.ludoya.com in
// November 2026; the old bucket host stays allowed for URLs still cached.
const LUDOYA_IMAGE_HOSTS = ['images.ludoya.com', 'ludoya-images.s3.eu-west-par.io.cloud.ovh.net']

async function cspImgSrc(): Promise<string[]> {
  const rules = await nextConfig.headers!()
  const csp = rules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === 'Content-Security-Policy')!.value
  const directive = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('img-src '))!
  return directive.split(/\s+/).slice(1)
}

describe('next.config image hosts', () => {
  it.each(LUDOYA_IMAGE_HOSTS)('lets next/image optimise https://%s', (host) => {
    const patterns = nextConfig.images?.remotePatterns ?? []
    expect(patterns).toContainEqual(expect.objectContaining({ protocol: 'https', hostname: host }))
  })

  it.each(LUDOYA_IMAGE_HOSTS)('allows https://%s in the CSP img-src', async (host) => {
    expect(await cspImgSrc()).toContain(`https://${host}`)
  })

  it('keeps the BGG image host allowed in both places', async () => {
    expect(nextConfig.images?.remotePatterns).toContainEqual(
      expect.objectContaining({ hostname: 'cf.geekdo-images.com' })
    )
    expect(await cspImgSrc()).toContain('https://cf.geekdo-images.com')
  })
})
