import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireRole } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import AdminHeader from "@/components/admin/AdminHeader";

// Every admin view is private: pages add their own title/description on top of this.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Shell of the admin panel: navbar, dark header with the view title and tabs, content, footer.
 * The guard runs here (404 for anyone without a board role) and again, memoised per request,
 * in every page. The layout cannot read the pathname, so a session that expired between the
 * proxy and this render comes back to `/admin` after login.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireRole("board");

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("first_name, last_name")
    .eq("id", actor.id)
    .single();
  const memberName = [member?.first_name, member?.last_name].filter(Boolean).join(" ");

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <NavBar />
      <AdminHeader memberName={memberName} role={actor.role} />
      <section className="flex-1 bg-brand-beige pb-20">{children}</section>
      <Footer />
      <ScrollToTop />
    </main>
  );
}
