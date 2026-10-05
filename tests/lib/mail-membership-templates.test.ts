import { describe, expect, it } from 'vitest'
import { boardLeaveEmail, rejoinEmail } from '@/lib/mail/templates/membership'

// Leave/rejoin e-mails (spec A-6/BR-8, A-7/§4.3). Always Catalan (decision D-C).

const XSS = '<script>alert("x")</script>'

describe('boardLeaveEmail (A-6, BR-8)', () => {
  const mail = boardLeaveEmail({
    firstName: 'Laia',
    memberNumber: '000-203',
    leftOn: '2026-10-05',
    reason: 'Incompliment reiterat\nde les pautes de conducta',
  })

  it('has a Catalan subject and greets the member by first name', () => {
    expect(mail.subject).toBe('Baixa de Darkstone Catalunya')
    expect(mail.text).toContain('Hola, Laia:')
    expect(mail.html).toContain('Hola, Laia:')
  })

  it('states the member number, the leave date (d/m/yyyy) and the reason (BR-8)', () => {
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('000-203')
      expect(body).toContain('5/10/2026')
      expect(body).toContain('Incompliment reiterat')
      expect(body).toContain('de les pautes de conducta')
    }
    expect(mail.html).toContain('Incompliment reiterat<br />de les pautes de conducta')
  })

  it('explains the consequences and how to contact the board or come back', () => {
    expect(mail.text).toContain('ja no pots entrar a la zona de socis')
    expect(mail.text).toContain('carnet deixa de ser vàlid')
    expect(mail.text).toContain('hola@darkstone.cat')
    expect(mail.html).toContain('href="mailto:hola@darkstone.cat"')
  })

  it('HTML-escapes the name and the reason, but keeps them as typed in the plain text', () => {
    const evil = boardLeaveEmail({ firstName: XSS, memberNumber: '000-1', leftOn: '2026-01-31', reason: XSS })
    expect(evil.html).not.toContain('<script>')
    expect(evil.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(evil.text).toContain(XSS)
    expect(evil.subject).not.toContain('<')
  })

  it('greets without a name when the first name is blank', () => {
    const noName = boardLeaveEmail({ firstName: '  ', memberNumber: '000-1', leftOn: '2026-01-31', reason: 'Motiu llarg' })
    expect(noName.text.startsWith('Hola:')).toBe(true)
  })
})

describe('rejoinEmail (A-7, §4.3)', () => {
  const mail = rejoinEmail({ firstName: 'Pau', memberNumber: '000-087' })

  it('uses the subject of the spec', () => {
    expect(mail.subject).toBe('Tornes a ser soci de Darkstone Catalunya')
  })

  it('keeps the number, mentions the new card, the same password and the newsletter, and links to the profile', () => {
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('Hola, Pau:')
      expect(body).toContain('000-087')
      expect(body).toContain('carnet nou')
      expect(body).toContain('mateixa contrasenya')
      expect(body).toContain('butlletí')
      expect(body).toContain('https://www.darkstone.cat/profile')
      expect(body).toContain('hola@darkstone.cat')
    }
    expect(mail.html).toContain('href="https://www.darkstone.cat/profile"')
  })

  it('HTML-escapes the name', () => {
    const evil = rejoinEmail({ firstName: XSS, memberNumber: '000-1' })
    expect(evil.html).not.toContain('<script>')
    expect(evil.text).toContain(XSS)
  })
})

describe('both templates', () => {
  it('take no DNI, phone or other sensitive field and never print one', () => {
    const leave = boardLeaveEmail({ firstName: 'Laia', memberNumber: '000-203', leftOn: '2026-10-05', reason: 'Motiu' })
    const rejoin = rejoinEmail({ firstName: 'Laia', memberNumber: '000-203' })
    for (const body of [leave.text, leave.html, rejoin.text, rejoin.html]) {
      expect(body).not.toMatch(/\b(DNI|NIE)\b|\+34|\b\d{8}[A-Z]\b/)
    }
  })
})
