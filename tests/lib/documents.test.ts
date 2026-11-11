import { describe, it, expect } from 'vitest'
import { DOCUMENT_KEYS, documentHref, isDocumentKey, searchWithoutDocument } from '@/lib/documents'

describe('association documents', () => {
  it('knows exactly the conduct and data protection documents', () => {
    expect(DOCUMENT_KEYS).toEqual(['conduct', 'data-protection'])
    expect(isDocumentKey('conduct')).toBe(true)
    expect(isDocumentKey('data-protection')).toBe(true)
  })

  it('rejects anything else as a document key', () => {
    for (const value of ['', 'privacy', 'Conduct', 'data_protection', null, undefined, 1, ['conduct']]) {
      expect(isDocumentKey(value)).toBe(false)
    }
  })

  it('links to the document on the current page', () => {
    expect(documentHref('conduct')).toBe('?doc=conduct')
    expect(documentHref('data-protection')).toBe('?doc=data-protection')
  })

  it('drops only the document param from a search string', () => {
    expect(searchWithoutDocument('?doc=conduct')).toBe('')
    expect(searchWithoutDocument('doc=conduct')).toBe('')
    expect(searchWithoutDocument('?q=catan&doc=conduct&page=2')).toBe('?q=catan&page=2')
    expect(searchWithoutDocument('?q=catan')).toBe('?q=catan')
    expect(searchWithoutDocument('')).toBe('')
  })
})
