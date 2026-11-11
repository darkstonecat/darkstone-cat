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
import ItemCard from '@/components/events/program/ItemCard'
import type { ItemView } from '@/lib/events/agenda-format'
import { playView } from '../../helpers/program-view'

const MESSAGES = { ca, es, en }

const play = (over: Partial<ItemView> = {}): ReturnType<typeof playView> =>
  playView({ title: 'Signorie', gameName: 'Signorie', coverUrl: null, minParticipants: 4, ...over })
const PlayCard = ({ play: item }: { play: ItemView; time?: string }) => (
  <ul>
    <ItemCard item={item} />
  </ul>
)

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
    ['ca', 'Apunta’t'],
    ['es', 'Apúntate'],
    ['en', 'Sign up'],
  ] as const)('writes the button in %s', (locale, join) => {
    renderIn(locale, <PlayCard play={play()} time="18:00" />)

    expect(screen.getByRole('link', { name: new RegExp(join) })).toBeInTheDocument()
  })

  it('switches to the queue when full and labels an unlimited play in Catalan', () => {
    const { rerender } = renderIn('ca', <PlayCard play={play({ participantCount: 1, minParticipants: 3 })} time="18:00" />)
    expect(screen.queryByText('Falten 2 per començar')).toBeNull()

    const again = (p: ItemView) =>
      rerender(
        <NextIntlClientProvider locale="ca" messages={ca}>
          <PlayCard play={p} time="18:00" />
        </NextIntlClientProvider>
      )
    again(play({ participantCount: 1, minParticipants: null }))
    expect(screen.queryByText('Queden 3 places')).toBeNull()
    again(play({ participantCount: 4, minParticipants: null }))
    expect(screen.queryByText('Completa')).toBeNull()
    expect(screen.getByRole('link', { name: /A la cua/ })).toBeInTheDocument()
    again(play({ participantCount: 1, capacity: null, minParticipants: null }))
    expect(screen.queryByText('Sense límit de places')).toBeNull()
    expect(screen.getByRole('img', { name: '1 persona apuntada, sense límit' })).toHaveTextContent('1 apuntat')
  })
})
