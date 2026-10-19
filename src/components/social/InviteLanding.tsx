"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Monogram } from "@/components/ui/Monogram";
import { isStandalone } from "@/lib/pwa";
import { Button } from "@/components/ui/Button";

/**
 * Pozvánka z odkazu.
 *
 * Přihlášený (v aplikaci, nebo v prohlížeči, kde je přihlášený) ji jedním
 * klepnutím přijme. V Safari, které přihlášení z plochy nevidí, stránka
 * nic nepředstírá: zkopíruje pozvánku a řekne, kam ji v aplikaci vložit.
 */
export function InviteLanding({
  handle,
  signedIn,
  onAdd,
  onDismiss,
}: {
  handle: string;
  signedIn: boolean;
  /** Pošle žádost. Vrací větu pro uživatele a jestli prošla. */
  onAdd: () => Promise<{ ok: boolean; message: string }>;
  onDismiss: () => void;
}) {
  const t = useTranslations("social");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const inBrowser = !isStandalone();

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?pritel=${handle}`);
      setNotice(t("inviteCopied"));
    } catch {
      setNotice(t("inviteCopyFailed", { handle }));
    }
  }

  return (
    <div className="bg-paper fixed inset-0 z-40 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="invite-title">
      <div className="scroll-y flex-1" style={{ paddingTop: "calc(var(--sa-t) + 2rem)" }}>
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 text-center">
          <Monogram handle={handle} size="lg" />
          <h2 id="invite-title" className="mt-5 text-[1.625rem] leading-tight font-semibold tracking-tight text-balance">
            {t("inviteTitle", { handle })}
          </h2>
          <p className="text-ink-soft mt-2 max-w-72 text-body">{t("inviteBody")}</p>

          {!signedIn && inBrowser ? (
            <div className="mt-8 w-full text-left">
              <p className="panel-label">{t("inviteHaveApp")}</p>
              <ol className="mt-1">
                {[t("inviteStep1"), t("inviteStep2"), t("inviteStep3")].map((step, index) => (
                  <li key={index} className="border-line flex gap-3 border-t py-3 text-label">
                    <span className="readout bg-surface text-ink-soft grid size-6 shrink-0 place-items-center rounded-[5px] text-micro">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="text-ink-soft mt-3 text-label">{t("inviteNoApp")}</p>
            </div>
          ) : !signedIn ? (
            <p className="text-ink-soft mt-8 text-label">{t("inviteSignIn")}</p>
          ) : null}
          {notice ? (
            <p className="text-ink-soft mt-4 text-label" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-5 pt-3" style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}>
        {signedIn && sent ? (
          <Button className="w-full" onClick={onDismiss}>{t("done")}</Button>
        ) : signedIn ? (
          <Button className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await onAdd();
                setNotice(result.message);
                setSent(result.ok);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("inviteAdd", { handle })}
          </Button>
        ) : inBrowser ? (
          <Button className="w-full" onClick={() => void copy()}>{t("inviteCopy")}</Button>
        ) : (
          <Button className="w-full" onClick={onDismiss}>{t("inviteToSignIn")}</Button>
        )}
        <Button variant="text" tone="muted" className="mt-1 w-full" onClick={onDismiss}>
          {t("inviteLater")}
        </Button>
      </div>
    </div>
  );
}
