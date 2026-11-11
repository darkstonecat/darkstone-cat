import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { render, act } from '@testing-library/react'

const lenis = vi.hoisted(() => ({ scrollTo: vi.fn(), raf: vi.fn(), destroy: vi.fn() }))
vi.mock('lenis', () => ({
  default: vi.fn(function FakeLenis(this: Record<string, unknown>) {
    Object.assign(this, { scrollTo: lenis.scrollTo, raf: lenis.raf, destroy: lenis.destroy })
  }),
}))

import SmoothScroll, { useLenis } from '@/components/SmoothScroll'

const probe: { lenis: ReturnType<typeof useLenis> } = { lenis: null }
function Probe() {
  const lenis = useLenis()
  useEffect(() => {
    probe.lenis = lenis
  }, [lenis])
  return null
}

describe('SmoothScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    probe.lenis = null
  })

  it('runs the animation loop for a programmatic scrollTo after the page went idle', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    render(
      <SmoothScroll>
        <Probe />
      </SmoothScroll>
    )
    // The initial kick ends after 200 ms without scroll activity.
    act(() => vi.advanceTimersByTime(300))
    raf.mockClear()

    const target = document.createElement('div')
    probe.lenis!.scrollTo(target, { offset: -96 })

    expect(lenis.scrollTo).toHaveBeenCalledWith(target, { offset: -96 })
    expect(raf).toHaveBeenCalled()
  })
})
