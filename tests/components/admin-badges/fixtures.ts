import type { AdminBadgeRow } from '@/lib/admin/badges'

/** One `admin_list_badges` row; override what the test needs. */
export function badgeRow(over: Partial<AdminBadgeRow> = {}): AdminBadgeRow {
  return {
    key: 'volunteer_egara_joga',
    name: { ca: 'Voluntariat Egara Juga', es: 'Voluntariado Egara Juga', en: 'Egara Juga volunteer' },
    earned_text: { ca: 'Ha col·laborat a la fira.', es: 'Ha colaborado en la feria.', en: 'Helped at the fair.' },
    locked_text: { ca: 'Col·labora a la fira.', es: 'Colabora en la feria.', en: 'Help at the fair.' },
    icon: 'how_to_reg',
    sort_order: 10,
    show_locked: true,
    archived_at: null,
    created_at: '2026-11-03T09:00:00Z',
    updated_at: '2026-11-03T09:00:00Z',
    holders: 13,
    active_holders: 12,
    ever_awarded: true,
    ...over,
  }
}
