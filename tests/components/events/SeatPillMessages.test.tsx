import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import ca from '@/messages/ca.json'
import es from '@/messages/es.json'
import en from '@/messages/en.json'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { quality, sizes, fill, ...rest } = props
    return <img alt="" {...rest} />
  },
}))

import SeatPill from '@/components/events/SeatPill'
import PlayCard from '@/components/events/PlayCard'
import type { AgendaPlay } from '@/lib/events/agenda-view'

const MESSAGES = { ca, es, en }

const play = (over: Partial<AgendaPlay> = {}): AgendaPlay => ({
  id: 'p1',
  gameName: 'Signorie',
  coverUrl: null,
  startsAt: '2026-11-13T17:00:00Z',
  endsAt: null,
  place: null,
  participantCount: 3,
  capacity: 4,
  minParticipants: 4,
  ludoyaUrl: 'https://ludoya.test/events/p1',
  ...over,
})

const renderIn = (locale: keyof typeof MESSAGES, ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {ui}
    </NextIntlClientProvider>
  )

describe('seat texts with the real messages', () => {
  it('labels the pill like the spec example in Catalan', () => {
    renderIn('ca', <SeatPill play={play()} />)

    expect(screen.getByRole('img', { name: '3 de 4 places ocupades, en falta 1 per començar' })).toBeInTheDocument()
  })

  it.each([
    ['ca', 'Falta 1 per començar', 'Apunta’t'],
    ['es', 'Falta 1 para empezar', 'Apúntate'],
    ['en', '1 more needed to start', 'Sign up'],
  ] as const)('writes the status line and button in %s', (locale, status, join) => {
    renderIn(locale, <PlayCard play={play()} time="18:00" />)

    expect(screen.getByText(status)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(join) })).toBeInTheDocument()
  })

  it('uses the plural forms of every status in Catalan', () => {
    const { rerender } = renderIn('ca', <PlayCard play={play({ participantCount: 1, minParticipants: 3 })} time="18:00" />)
    expect(screen.getByText('Falten 2 per començar')).toBeInTheDocument()

    const again = (p: AgendaPlay) =>
      rerender(
        <NextIntlClientProvider locale="ca" messages={ca}>
          <PlayCard play={p} time="18:00" />
        </NextIntlClientProvider>
      )
    again(play({ participantCount: 1, minParticipants: null }))
    expect(screen.getByText('Queden 3 places')).toBeInTheDocument()
    again(play({ participantCount: 4, minParticipants: null }))
    expect(screen.getByText('Completa')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /A la cua/ })).toBeInTheDocument()
    again(play({ participantCount: 1, capacity: null, minParticipants: null }))
    expect(screen.getByText('Sense límit de places')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '1 persona apuntada, sense límit' })).toHaveTextContent('1 apuntat')
  })
})
