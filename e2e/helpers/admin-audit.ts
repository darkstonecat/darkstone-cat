import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'
import { expectHydrated } from './hydration'
import { findUserByEmail } from './supabase-admin'

/** Member number of a test user (service role read; the number is not a secret). */
export async function memberNumberOf(email: string): Promise<string> {
  const id = await findUserByEmail(email)
  expect(id).not.toBeNull()
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await admin.from('members').select('member_number').eq('id', id!).single()
  expect(error).toBeNull()
  return data!.member_number as string
}

/**
 * Writes one `export.member_data` audit entry as the signed-in board member: the A-11 export
 * from the member file. Specs that read the log use it so they do not depend on other specs.
 */
export async function exportMemberData(page: Page, number: string) {
  await page.goto(`/admin/members/${number}`)
  const exportButton = page.getByRole('button', { name: 'Exporta dades' })
  await expectHydrated(exportButton)
  await exportButton.click()
  const dialog = page.getByRole('dialog', { name: 'Exporta dades del soci' })
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/api/admin/members/${number}/data`) && r.request().method() === 'POST'),
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Descarrega JSON' }).click(),
  ])
  await expect(dialog.getByRole('status')).toHaveText('JSON descarregat.')
}
