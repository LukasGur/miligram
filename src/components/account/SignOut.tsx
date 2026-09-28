"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LogOutIcon } from "@/components/icons";
import { pressable } from "@/lib/press";
import { detachPushDevice } from "@/lib/push";
import { withTimeout } from "@/lib/useAction";
import { remoteGateway } from "@/lib/remote";
import type { supabase } from "@/lib/supabase";
import { syncOutbox } from "@/lib/sync";
import { wipeDevice } from "@/lib/account";
import { Primary } from "./SignIn";

type Client = ReturnType<typeof supabase> & object;

/**
 * Odhlášení. Zařízení se nejdřív odpojí od notifikací účtu — jinak by
 * na telefon dál chodily připomínky někoho, kdo už na něm přihlášený není.
 */
async function signOut(client: Client): Promise<void> {
  try {
    await withTimeout(detachPushDevice(client));
  } catch {
    // Chyby odpojení spolkne detachPushDevice sám; tady jde o limit —
    // čekání na service worker nebo síť nesmí odhlášení zablokovat.
  }
  try {
    // Jen tohle sezení. Výchozí rozsah odhlásí účet na všech zařízeních,
    // a to by s „z tohohle telefonu se smaže“ nesedělo.
    const { error } = await withTimeout(client.auth.signOut({ scope: "local" }));
    if (error) throw error;
  } catch {
    // Server nedostupný: sezení se zahodí aspoň v telefonu. Tlačítko, které
    // po klepnutí nic neudělá, je horší než token, který dožije na serveru.
    await client.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

/**
 * Odhlášení.
 *
 * Tlačítko jako ostatní vedlejší akce — rámeček, ikona, plná šířka. Holý
 * šedý text vypadal jako poznámka, ne jako něco, na co se ťuká.
 *
 * Potvrzuje se vždycky: odhlášení z telefonu smaže postup (na účtu
 * zůstává), a to se nemá stát jedním ťuknutím omylem.
 */
export function SignOut({ client, userId, email }: { client: Client; userId: string; email?: string }) {
  const t = useTranslations("account");
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-10">
      <button
        type="button"
        {...pressable}
        onClick={() => setConfirming(true)}
        className="press press-wide border-line text-ink data-pressed:border-surface-press data-pressed:bg-surface-press flex min-h-12 w-full items-center justify-center gap-2 rounded-control border px-3 text-label font-medium"
      >
        <LogOutIcon className="text-ink-soft size-5" />
        {t("signOut")}
      </button>
      {email ? <p className="text-ink-soft mt-2 text-center text-micro">{t("signedInAs", { email })}</p> : null}

      {confirming ? <ConfirmSheet client={client} userId={userId} onClose={() => setConfirming(false)} /> : null}
    </div>
  );
}

/**
 * Odhlášení v pořadí: odeslat, odhlásit, vyčistit. Odeslat první, jinak
 * by se co nevidět smazalo, co server ještě nezná. Odhlásit před
 * vyčištěním, jinak by brána (AccountGate) prázdný telefon hned znovu
 * přiřadila přihlášenému účtu.
 */
async function leave(client: Client): Promise<void> {
  await signOut(client);
  await wipeDevice();
}

function ConfirmSheet({ client, userId, onClose }: { client: Client; userId: string; onClose: () => void }) {
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

  async function sendThenLeave() {
    setBusy(true);
    setFailed(false);
    try {
      await withTimeout(syncOutbox(remoteGateway(client, userId)));
    } catch {
      // Bez spojení se nic neodešle. Odhlásit jde i tak, ale ať o tom ví.
      setFailed(true);
      setBusy(false);
      return;
    }
    await leave(client);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t("signOutCancel")}
        onClick={onClose}
        className="animate-scrim bg-ink/25 absolute inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-out-title"
        aria-describedby="sign-out-body"
        className="animate-sheet bg-paper relative mx-auto w-full max-w-md rounded-t-sheet px-5 pt-6"
        style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
      >
        <h2 id="sign-out-title" className="text-heading font-semibold">
          {t("signOutTitle")}
        </h2>
        <p id="sign-out-body" className="text-ink-soft mt-2 text-label">
          {t("signOutBody")}
        </p>
        {failed ? (
          <p role="alert" className="text-ink mt-3 text-label">
            {t("signOutSendFailed")}
          </p>
        ) : null}

        <Primary onClick={() => void sendThenLeave()} busy={busy && !failed}>
          {t("signOutConfirm")}
        </Primary>
        {failed ? (
          <button
            type="button"
            {...pressable}
            onClick={() => {
              setBusy(true);
              void leave(client).finally(() => setBusy(false));
            }}
            disabled={busy}
            className="press press-wide border-line text-ink data-pressed:border-surface-press data-pressed:bg-surface-press mt-2 flex min-h-12 w-full items-center justify-center rounded-control border px-3 text-label font-medium disabled:opacity-40"
          >
            {t("signOutAnyway")}
          </button>
        ) : null}
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
