import type { Member } from "@/lib/supabase/auth";

export type ChecklistStepKey = "account" | "data" | "ludoya" | "bgg";

export type ChecklistStep = {
  key: ChecklistStepKey;
  done: boolean;
  /** Where the member fixes an incomplete step. */
  href: string;
};

const filled = (value: string | null | undefined) => Boolean(value && value.trim());

/**
 * The four "Completa el perfil" steps of the member home. "Dades de soci" means the
 * data the association asks for at sign-up that can be left out there: DNI/NIE, phone
 * and postal code.
 */
export function buildProfileChecklist(input: {
  emailConfirmed: boolean;
  member: Pick<Member, "dni_nie_encrypted" | "phone_encrypted" | "postal_code" | "ludoya_username" | "bgg_username">;
}): ChecklistStep[] {
  const { emailConfirmed, member } = input;
  return [
    { key: "account", done: emailConfirmed, href: "/profile/details#account-title" },
    {
      key: "data",
      done: filled(member.dni_nie_encrypted) && filled(member.phone_encrypted) && filled(member.postal_code),
      href: "/profile/edit",
    },
    { key: "ludoya", done: filled(member.ludoya_username), href: "/profile/details#gaming-title" },
    { key: "bgg", done: filled(member.bgg_username), href: "/profile/details#gaming-title" },
  ];
}
