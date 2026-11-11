import { describe, it, expect } from 'vitest'
import ca from '@/messages/ca.json'
import es from '@/messages/es.json'
import en from '@/messages/en.json'

// Components render these messages with t.rich and only the tags below (DocumentLink).
const DOCUMENT_TAGS = ['conductLink', 'dataProtectionLink']

const tagsOf = (message: string) => [...message.matchAll(/<(\w+)>/g)].map((match) => match[1])

describe.each([
  ['ca', ca],
  ['es', es],
  ['en', en],
])('document links in %s messages', (_, messages) => {
  it('the sign-up consent boxes open their own document', () => {
    expect(tagsOf(messages.auth.register_conduct_checkbox)).toEqual(['conductLink'])
    expect(tagsOf(messages.auth.register_privacy_checkbox)).toEqual(['dataProtectionLink'])
  })

  it('the privacy policy links to the data protection document', () => {
    expect(tagsOf(messages.privacy_policy.association_policy_text)).toEqual(['dataProtectionLink'])
  })

  it('legal pages only use tags that LegalPageContent knows', () => {
    for (const namespace of ['legal_notice', 'privacy_policy', 'cookie_policy'] as const) {
      for (const message of Object.values(messages[namespace] as Record<string, string>)) {
        for (const tag of tagsOf(message)) expect(DOCUMENT_TAGS).toContain(tag)
      }
    }
  })
})
