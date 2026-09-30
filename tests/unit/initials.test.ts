import { describe, it, expect } from 'vitest'
import { getInitials } from '@/lib/profile/initials'

describe('getInitials', () => {
  it('uses the first letter of the first and last name, upper-cased', () => {
    expect(getInitials('anna', 'puig')).toBe('AP')
  })

  it('keeps accented and non-Latin first letters whole', () => {
    expect(getInitials('Òscar', 'Élan')).toBe('ÒÉ')
    expect(getInitials('😀x', '李')).toBe('😀李')
  })

  it('trims spaces and tolerates a missing name', () => {
    expect(getInitials('  maria ', ' ')).toBe('M')
    expect(getInitials('', '')).toBe('')
  })
})
