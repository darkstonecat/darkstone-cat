import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/admin/guard";
import { decrypt } from "@/lib/encryption";
import { escapeCsv } from "@/lib/csv";
import type { AdminMember } from "@/lib/supabase/auth";

export async function GET() {
  // 1. Auth and role check: an active board member or superadmin
  const access = await getAdminAccess("board");

  if (access.status === "unauthenticated") {
    return new Response("Unauthorized", { status: 401 });
  }
  if (access.status !== "ok") {
    return new Response("Forbidden", { status: 403 });
  }
  const user = access.actor;

  // 2. Fetch all members via RPC
  const supabase = await createClient();
  const { data: members, error } = await supabase.rpc("get_all_members_for_admin");

  if (error || !members) {
    return new Response("Internal Server Error", { status: 500 });
  }

  // 3. Build CSV
  const headers = [
    "Número",
    "Nom",
    "Cognoms",
    "Email",
    "Telèfon",
    "DNI/NIE",
    "CP",
    "Ludoya",
    "BGG",
    "Rol",
    "Newsletter",
    "Data alta",
    "Creat",
  ];

  const rows = (members as AdminMember[]).map((m) => {
    let phone = "";
    let dni = "";

    if (m.phone_encrypted) {
      try {
        phone = decrypt(m.phone_encrypted);
      } catch {
        phone = "";
      }
    }

    if (m.dni_nie_encrypted) {
      try {
        dni = decrypt(m.dni_nie_encrypted);
      } catch {
        dni = "";
      }
    }

    return [
      m.member_number,
      m.first_name,
      m.last_name,
      m.email,
      phone,
      dni,
      m.postal_code ?? "",
      m.ludoya_username ?? "",
      m.bgg_username ?? "",
      m.role,
      m.newsletter_accepted ? "Sí" : "No",
      m.membership_start_date ?? "",
      m.created_at ?? "",
    ];
  });

  // Audit trail: who exported and how many rows (user id only, no personal data).
  console.info("[admin-export] user=%s rows=%d", user.id, rows.length);

  const csvLines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ];

  // BOM for UTF-8 Excel compatibility
  const bom = "\uFEFF";
  const csv = bom + csvLines.join("\n");

  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="darkstone_members_${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
