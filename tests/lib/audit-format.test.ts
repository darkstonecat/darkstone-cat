import { describe, it, expect } from 'vitest'
import {
  AUDIT_ACTIONS,
  describeAuditEntry,
  describeAuditTime,
  type AdminActivityRow,
  type AuditParam,
  type AuditText,
} from '@/lib/admin/audit-format'
import ca from '@/messages/ca.json'
import es from '@/messages/es.json'
import en from '@/messages/en.json'

const row = (action: string, details: unknown = {}, over: Partial<AdminActivityRow> = {}): AdminActivityRow => ({
  id: 1,
  created_at: '2026-10-05T09:15:00Z',
  actor_id: 'actor-1',
  actor_role: 'board',
  actor_member_number: '000-014',
  actor_name: 'Pau Ferrer',
  action,
  target_member_id: 'target-1',
  target_member_number: '000-203',
  target_name: 'Laia Serra',
  details,
  reason: null,
  ...over,
})

// One realistic entry per action key (the shapes written by the database functions and actions).
const SAMPLES: Record<string, AdminActivityRow> = {
  'member.update': row('member.update', {
    fields: ['first_name', 'phone', 'postal_code'],
    changes: { first_name: { from: 'Laia', to: 'Laia Maria' } },
  }),
  'member.reveal_sensitive': row('member.reveal_sensitive', { field: 'dni' }, { reason: 'Requeriment escrit' }),
  'membership.leave': row('membership.leave', { left_by: 'board', left_on: '2026-10-01' }, { reason: 'Compte duplicat' }),
  'membership.rejoin': row('membership.rejoin', { channel: 'email', previous_left_on: '2026-10-01', previous_left_by: 'board' }),
  'badge.award': row('badge.award', { badge: 'ludoteca_donor' }),
  'badge.revoke': row('badge.revoke', { badge: 'volunteer_egara_joga', awarded_on: '2026-09-02' }),
  'card.regenerate': row('card.regenerate', {}),
  'export.members_csv': row('export.members_csv', { filter: { state: 'active', role: 'board' }, rows: 168 }, { target_member_number: null, target_name: null, target_member_id: null }),
  'export.member_data': row('export.member_data', { state: 'active' }),
  'export.member_register': row('export.member_register', { rows: 171 }, { target_member_number: null, target_name: null, target_member_id: null }),
  'export.emails': row('export.emails', { list: 'newsletter', rows: 97 }, { target_member_number: null, target_name: null, target_member_id: null }),
  'member.send_access_link': row('member.send_access_link', {}),
  'role.grant': row('role.grant', { from: 'member', to: 'board' }),
  'role.revoke': row('role.revoke', { from: 'board', to: 'member' }),
  'member.anonymise': row('member.anonymise', { badges_deleted: 2, purge_on: '2029-10-04' }),
  'member.purge': row('member.purge', { left_on: '2026-01-02', purge_on: '2029-01-02', badges_deleted: 1, account_deleted: true }, { actor_id: null, actor_name: null, actor_member_number: null, actor_role: null }),
  'account.purge_unconfirmed': row('account.purge_unconfirmed', { accounts_deleted: 2 }, { actor_id: null, actor_name: null, actor_member_number: null, actor_role: null, target_member_number: null, target_name: null, target_member_id: null }),
  'ops.cache_refresh': row('ops.cache_refresh', { jobs: ['ludoya', 'bgg'], ok: true }, { target_member_number: null, target_name: null, target_member_id: null }),
}

function lookup(messages: unknown, path: string): unknown {
  return path.split('.').reduce<any>((node, part) => (node && typeof node === 'object' ? node[part] : undefined), messages)
}

function collectKeys(text: AuditText): string[] {
  const keys = [text.key]
  const walk = (value: AuditParam) => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (typeof value === 'object') keys.push(value.i18n)
  }
  Object.values(text.params).forEach(walk)
  return keys
}

describe('describeAuditEntry', () => {
  it('has a sample for every one of the 18 action keys', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...AUDIT_ACTIONS].sort())
    expect(AUDIT_ACTIONS).toHaveLength(18)
  })

  it.each(Object.keys(SAMPLES))('%s gets its own sentence, not the generic one', (action) => {
    const { sentence } = describeAuditEntry(SAMPLES[action])
    expect(sentence.key).toMatch(/^sentence\./)
    expect(sentence.key).not.toMatch(/unknown/)
    expect(sentence.key.endsWith('_generic')).toBe(false)
  })

  it('only emits message keys that exist in ca, es and en', () => {
    for (const entry of Object.values(SAMPLES)) {
      const { sentence, details } = describeAuditEntry(entry)
      for (const text of [sentence, ...details]) {
        for (const key of collectKeys(text)) {
          for (const messages of [ca, es, en]) {
            expect(lookup((messages as any).admin.activity, key), key).toBeTypeOf('string')
          }
        }
      }
    }
    for (const messages of [ca, es, en]) {
      const activity = (messages as any).admin.activity
      for (const key of ['sentence.unknown', 'sentence.unknown_target', 'sentence.badge_award_generic', 'sentence.role_grant_generic', 'sentence.member_reveal_sensitive_generic', 'sentence.account_purge_unconfirmed_generic']) {
        expect(lookup(activity, key), key).toBeTypeOf('string')
      }
    }
  })

  it('names the member by number and the role by name', () => {
    expect(describeAuditEntry(SAMPLES['membership.leave']).sentence).toEqual({
      key: 'sentence.membership_leave',
      params: { number: '000-203' },
    })
    expect(describeAuditEntry(SAMPLES['role.grant']).sentence).toEqual({
      key: 'sentence.role_grant',
      params: { person: 'Laia Serra', role: { i18n: 'role.board' } },
    })
    expect(describeAuditEntry(SAMPLES['role.revoke']).sentence.params).toMatchObject({ role: { i18n: 'role.board' } })
  })

  it('falls back to the number when the target name is gone (anonymised or purged)', () => {
    const entry = row('role.grant', { to: 'board' }, { target_name: null })
    expect(describeAuditEntry(entry).sentence.params.person).toBe('000-203')
  })

  it('renders member.update as field names plus before and after for names only', () => {
    const { details } = describeAuditEntry(SAMPLES['member.update'])
    expect(details).toEqual([
      { key: 'detail.fields', params: { fields: [{ i18n: 'field.first_name' }, { i18n: 'field.postal_code' }, { i18n: 'field.phone' }] } },
      { key: 'detail.change', params: { field: { i18n: 'field.first_name' }, from: 'Laia', to: 'Laia Maria' } },
    ])
  })

  it('shows no name change for an anonymised or purged target (target_name null)', () => {
    const entry = row(
      'member.update',
      { fields: ['first_name'], changes: { first_name: { from: 'Laia', to: 'Laia Maria' } } },
      { target_name: null }
    )
    const { details } = describeAuditEntry(entry)
    expect(details.map((d) => d.key)).toEqual(['detail.fields'])
    expect(JSON.stringify(describeAuditEntry(entry))).not.toContain('Laia')
  })

  it('renders only whitelisted detail fields, never DNI or phone values', () => {
    const entry = row('member.update', {
      fields: ['dni', 'phone', 'secret'],
      changes: { dni: { from: '12345678Z', to: '87654321X' }, phone: { from: '600111222', to: '600333444' }, postal_code: { from: '08221', to: '08224' } },
      dni: '12345678Z',
      phone: '+34 600 111 222',
    })
    const rendered = JSON.stringify(describeAuditEntry(entry))
    expect(rendered).not.toContain('12345678Z')
    expect(rendered).not.toContain('87654321X')
    expect(rendered).not.toContain('600111222')
    expect(rendered).not.toContain('600 111 222')
    expect(rendered).not.toContain('08221')
    expect(rendered).not.toContain('secret')
    // The reveal names the field, nothing else.
    const reveal = describeAuditEntry(row('member.reveal_sensitive', { field: 'dni', value: '12345678Z' }))
    expect(JSON.stringify(reveal)).not.toContain('12345678Z')
    expect(reveal.sentence.params.field).toEqual({ i18n: 'field.dni' })
  })

  it('treats the actor as system, self or a person with a role chip', () => {
    expect(describeAuditEntry(SAMPLES['member.purge']).actor.kind).toBe('system')
    expect(describeAuditEntry(SAMPLES['member.purge']).actor.role).toBeNull()
    const person = describeAuditEntry(SAMPLES['badge.award']).actor
    expect(person).toMatchObject({ kind: 'person', name: 'Pau Ferrer', role: 'board' })
    expect(describeAuditEntry(row('card.regenerate', {}, { actor_role: 'superadmin' })).actor.role).toBe('superadmin')
    expect(describeAuditEntry(row('card.regenerate', {}, { actor_role: 'admin' })).actor.role).toBe('board')
    expect(describeAuditEntry(row('card.regenerate', {}, { actor_role: 'member' })).actor.role).toBeNull()
  })

  it('words a self leave without a target', () => {
    const entry = row('membership.leave', { left_by: 'self', left_on: '2026-10-04' }, { actor_id: 'target-1', actor_role: 'member' })
    const result = describeAuditEntry(entry)
    expect(result.actor.kind).toBe('self')
    expect(result.sentence.key).toBe('sentence.membership_leave_self')
    expect(result.details).toEqual([{ key: 'detail.left_on', params: { date: '4/10/2026' } }])
  })

  it('returns the reason as plain text for the component to escape', () => {
    expect(describeAuditEntry(SAMPLES['membership.leave']).reason).toBe('Compte duplicat')
    const html = '<img src=x onerror=alert(1)>'
    expect(describeAuditEntry(row('membership.leave', {}, { reason: html })).reason).toBe(html)
    expect(describeAuditEntry(row('membership.leave', {}, { reason: '   ' })).reason).toBeNull()
  })

  it('formats counts, dates, lists and filters', () => {
    expect(describeAuditEntry(SAMPLES['export.members_csv']).details).toEqual([
      { key: 'detail.filter_role', params: { state: { i18n: 'state.active' }, role: { i18n: 'role.board' } } },
      { key: 'detail.rows', params: { count: 168 } },
    ])
    expect(describeAuditEntry(SAMPLES['export.emails']).details).toEqual([
      { key: 'detail.list', params: { list: { i18n: 'list.newsletter' } } },
      { key: 'detail.addresses', params: { count: 97 } },
    ])
    expect(describeAuditEntry(SAMPLES['account.purge_unconfirmed']).sentence).toEqual({
      key: 'sentence.account_purge_unconfirmed',
      params: { count: 2 },
    })
    expect(describeAuditEntry(SAMPLES['ops.cache_refresh']).details).toEqual([
      { key: 'detail.refresh_ok', params: {} },
      { key: 'detail.jobs', params: { jobs: [{ i18n: 'job.ludoya' }, { i18n: 'job.bgg' }] } },
    ])
  })

  it('falls back to a generic sentence for unknown actions', () => {
    expect(describeAuditEntry(row('made.up', { x: 1 })).sentence).toEqual({
      key: 'sentence.unknown_target',
      params: { action: 'made.up', number: '000-203' },
    })
    expect(describeAuditEntry(row('made.up', {}, { target_member_number: null })).sentence).toEqual({
      key: 'sentence.unknown',
      params: { action: 'made.up' },
    })
    expect(describeAuditEntry(row('x'.repeat(200))).sentence.params.action).toHaveLength(80)
  })

  it.each([null, undefined, 'text', 42, [], [1, 2], { fields: 'dni' }, { changes: [] }, { rows: -1 }, { rows: 'many' }, { rows: 1.5 }])(
    'never throws on malformed details %j',
    (details) => {
      for (const action of AUDIT_ACTIONS) {
        const result = describeAuditEntry(row(action, details))
        expect(result.sentence.key).toMatch(/^sentence\./)
        expect(Array.isArray(result.details)).toBe(true)
      }
    }
  )

  it('uses generic sentences when a whitelisted detail is missing or unknown', () => {
    expect(describeAuditEntry(row('badge.award', { badge: 'brand_new' })).sentence).toEqual({
      key: 'sentence.badge_award',
      params: { number: '000-203', badge: 'brand_new' },
    })
    expect(describeAuditEntry(row('badge.award', {})).sentence.key).toBe('sentence.badge_award_generic')
    expect(describeAuditEntry(row('role.grant', { to: 'owner' })).sentence.key).toBe('sentence.role_grant_generic')
    expect(describeAuditEntry(row('member.reveal_sensitive', { field: 'iban' })).sentence.key).toBe('sentence.member_reveal_sensitive_generic')
    expect(describeAuditEntry(row('account.purge_unconfirmed', {})).sentence.key).toBe('sentence.account_purge_unconfirmed_generic')
    expect(describeAuditEntry(row('membership.leave', { left_on: 'yesterday' })).details).toEqual([])
  })

  it('survives a row with every optional column missing', () => {
    const minimal = { id: 1, created_at: 'x', actor_id: null, actor_member_number: null, actor_name: null, action: 'member.update', target_member_number: null, target_name: null } as AdminActivityRow
    expect(describeAuditEntry(minimal).sentence.params.number).toBe('—')
  })
})

describe('describeAuditTime', () => {
  const now = new Date('2026-10-05T10:00:00Z') // 12:00 in Madrid

  it('says today, yesterday or the date, in Madrid time', () => {
    expect(describeAuditTime('2026-10-05T08:42:00Z', now)).toEqual({ kind: 'today', time: '10:42', date: '5/10/2026' })
    expect(describeAuditTime('2026-10-04T17:30:00Z', now)).toMatchObject({ kind: 'yesterday', time: '19:30' })
    expect(describeAuditTime('2026-10-03T18:10:00Z', now)).toEqual({ kind: 'date', time: '20:10', date: '3/10/2026' })
  })

  it('uses the Madrid day, not the UTC one, around midnight', () => {
    // 22:30 UTC on the 4th is 00:30 on the 5th in Madrid: today.
    expect(describeAuditTime('2026-10-04T22:30:00Z', now)?.kind).toBe('today')
  })

  it('is null for an invalid date', () => {
    expect(describeAuditTime('not a date', now)).toBeNull()
  })
})
