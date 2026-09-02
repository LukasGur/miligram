"use client";

import { useTranslations } from "next-intl";
import { useOnline } from "@/lib/clientState";

export function NetworkStatus() {
  const t = useTranslations("network");
  const online = useOnline();

  if (online) return null;

  return (
    <div
      role="status"
      className="app-chrome bg-surface text-ink-soft border-line border-b px-4 py-2 text-center text-micro"
    >
      {t("offline")}
    </div>
  );
}
