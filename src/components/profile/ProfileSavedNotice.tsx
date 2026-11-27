"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
// next-intl has no useSearchParams; the Next one is locale-agnostic and safe here.
import { usePathname, useSearchParams } from "next/navigation";
import { NoticeBox } from "./ActionNotice";

const SAVED_PARAM = "saved";
const VISIBLE_MS = 8_000;

/**
 * "Perfil desat" after /profile/edit saves and lands here with `?saved=1`. The flag is removed
 * from the URL at once (other params and the hash stay), so a reload or a shared link does not
 * show it again; the notice hides itself after a few seconds. The live region is mounted empty
 * first, so the message is announced when it appears.
 */
export default function ProfileSavedNotice({ className }: { className?: string }) {
  const t = useTranslations("profile.details");
  const [visible, setVisible] = useState(false);
  // Read through the router: right after router.replace() window.location may not show it yet.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const saved = searchParams.get(SAVED_PARAM) === "1";

  useEffect(() => {
    if (!saved) return;
    const rest = new URLSearchParams(searchParams);
    rest.delete(SAVED_PARAM);
    const query = rest.toString();
    const show = setTimeout(() => {
      setVisible(true);
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}${query ? `?${query}` : ""}${window.location.hash}`
      );
    }, 0);
    return () => clearTimeout(show);
  }, [saved, pathname, searchParams]);

  useEffect(() => {
    if (!visible) return;
    const hide = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(hide);
  }, [visible]);

  return (
    <div aria-live="polite" className={className}>
      {visible ? (
        <NoticeBox kind="success" testId="profile-saved-notice" className="mb-4 sm:mb-6">
          {t("profile_saved")}
        </NoticeBox>
      ) : null}
    </div>
  );
}
