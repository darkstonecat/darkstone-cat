/**
 * Local Supabase (Inbucket/Mailpit) mail catcher. Email confirmations are on in
 * `supabase/config.toml`, like production, so sign-up emails land here.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

type MailpitMessage = { ID: string }

async function messagesTo(email: string): Promise<MailpitMessage[]> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
  if (!res.ok) return []
  const body = (await res.json()) as { messages?: MailpitMessage[] }
  return body.messages ?? []
}

/** Waits for a message to `email` and returns the Supabase verify link found in the newest one. */
export async function waitForConfirmationLink(email: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const [newest] = await messagesTo(email)
    if (newest) {
      const res = await fetch(`${MAILPIT_URL}/api/v1/message/${newest.ID}`)
      const msg = (await res.json()) as { HTML?: string; Text?: string }
      const source = `${msg.HTML ?? ''}\n${msg.Text ?? ''}`
      const match = source.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/)
      if (match) return match[0].replace(/&amp;/g, '&')
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No confirmation email for ${email} within ${timeoutMs}ms`)
}

/** Number of messages currently addressed to `email`. */
export async function countMessagesTo(email: string): Promise<number> {
  return (await messagesTo(email)).length
}
