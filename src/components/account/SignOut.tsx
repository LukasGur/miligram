"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LogOutIcon } from "@/components/icons";
import { pressable } from "@/lib/press";
import { detachPushDevice } from "@/lib/push";
import { remoteGateway } from "@/lib/remote";
import type { supabase } from "@/lib/supabase";
import { syncOutbox } from "@/lib/sync";
import { usePendingEvents } from "@/lib/useProfile";
import { Primary } from "./SignIn";

type Client = ReturnType<typeof supabase> & object;

/**
 * Odhlášení. Zařízení se nejdřív odpojí od notifikací účtu — jinak by
 * na telefon dál chodily připomínky někoho, kdo už na něm přihlášený není.
 */
async function signOut(client: Client): Promise<void> {
  await detachPushDevice(client);
  await client.auth.signOut();
}

/**
 * Odhlášení.
 *
 * Tlačítko jako ostatní vedlejší akce — rámeček, ikona, plná šířka. Holý
 * šedý text vypadal jako poznámka, ne jako něco, na co se ťuká.
 *
 * Potvrzuje se jen tehdy, když na server ještě čekají lekce. Frontu
 * neodeslaných událostí nic neváže na účet: po odhlášení by se odeslala
 * pod tím, kdo se na telefonu přihlásí příště. Proto hlavní akce lekce
 * nejdřív odešle a teprve pak odhlásí.
 */
export function SignOut({ client, userId, email }: { client: Client; userId: string; email?: string }) {
  const t = useTranslations("account");
  const pending = usePendingEvents();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-10">
      <button
        type="button"
        {...pressable}
        onClick={() => (pending > 0 ? setConfirming(true) : void signOut(client))}
        className="press press-wide border-line text-ink data-pressed:border-surface-press data-pressed:bg-surface-press flex min-h-12 w-full items-center justify-center gap-2 rounded-control border px-3 text-label font-medium"
      >
        <LogOutIcon className="text-ink-soft size-5" />
        {t("signOut")}
      </button>
      {email ? <p className="text-ink-soft mt-2 text-center text-micro">{t("signedInAs", { email })}</p> : null}

      {confirming ? (
        <ConfirmSheet client={client} userId={userId} pending={pending} onClose={() => setConfirming(false)} />
      ) : null}
    </div>
  );
}

function ConfirmSheet({
  client,
  userId,
  pending,
  onClose,
}: {
  client: Client;
  userId: string;
  pending: number;
  onClose: () => void;
}) {
  const t = useTranslations("account");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function sendThenSignOut() {
    setBusy(true);
    setFailed(false);
    try {
      await syncOutbox(remoteGateway(client, userId));
      await signOut(client);
    } catch {
      // Bez spojení se nic neodešle. Odhlásit jde i tak, ale ať o tom ví.
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label={t("signOutCancel")} onClick={onClose} className="bg-ink/25 absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-out-title"
        aria-describedby="sign-out-body"
        className="bg-paper relative rounded-t-sheet px-5 pt-6"
        style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
      >
        <h2 id="sign-out-title" className="text-heading font-semibold">
          {t("signOutTitle")}
        </h2>
        <p id="sign-out-body" className="text-ink-soft mt-2 text-label">
          {t("signOutPending", { count: pending })}
        </p>
        {failed ? (
          <p role="alert" className="text-ink mt-3 text-label">
            {t("signOutSendFailed")}
          </p>
        ) : null}

        <Primary onClick={() => void sendThenSignOut()} disabled={busy}>
          {t("signOutSend")}
        </Primary>
        <button
          type="button"
          {...pressable}
          onClick={() => void signOut(client)}
          disabled={busy}
          className="press press-wide border-line text-ink data-pressed:border-surface-press data-pressed:bg-surface-press mt-2 flex min-h-12 w-full items-center justify-center rounded-control border px-3 text-label font-medium disabled:opacity-40"
        >
          {t("signOutAnyway")}
        </button>
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          className="text-accent mt-1 min-h-12 w-full text-label font-medium"
        >
          {t("signOutCancel")}
        </button>
      </div>
    </div>
  );
}
