"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { pressable } from "@/lib/press";
import { detachPushDevice } from "@/lib/push";
import { deleteAccount } from "@/lib/remote";
import type { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/useAction";
import { wipeDevice } from "@/lib/account";
import { Field, Primary } from "./SignIn";

type Client = ReturnType<typeof supabase> & object;

/** Opsaná přezdívka; zavináč a velikost písmen nerozhodují. */
function matches(typed: string, handle: string): boolean {
  return typed.trim().replace(/^@/, "").toLowerCase() === handle.toLowerCase();
}

/**
 * Smazání účtu (právo na výmaz). Nevratné, proto se potvrzuje opsáním
 * přezdívky, ne jedním klepnutím.
 */
export function DeleteAccount({ client, handle }: { client: Client; handle: string | null }) {
  const t = useTranslations("account");
  const [confirming, setConfirming] = useState(false);

  if (!handle) return null;

  return (
    <div className="mt-3 flex justify-center">
      <button
        type="button"
        {...pressable}
        onClick={() => setConfirming(true)}
        className="text-ink-soft data-pressed:text-ink min-h-11 px-3 text-label font-medium"
      >
        {t("deleteAccount")}
      </button>
      {confirming ? <ConfirmSheet client={client} handle={handle} onClose={() => setConfirming(false)} /> : null}
    </div>
  );
}

function ConfirmSheet({ client, handle, onClose }: { client: Client; handle: string; onClose: () => void }) {
  const t = useTranslations("account");
  const [typed, setTyped] = useState("");
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

  /**
   * Pořadí: odpojit upozornění, smazat na serveru, odhlásit, vyčistit.
   * Odhlásit před vyčištěním ze stejného důvodu jako v SignOut: brána
   * (AccountGate) by prázdný telefon jinak hned přiřadila účtu.
   */
  async function remove() {
    setBusy(true);
    setFailed(false);
    try {
      await withTimeout(detachPushDevice(client)).catch(() => {});
      await withTimeout(deleteAccount(client));
    } catch {
      setFailed(true);
      setBusy(false);
      return;
    }
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    await wipeDevice();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t("deleteCancel")}
        onClick={onClose}
        className="animate-scrim bg-scrim absolute inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-body"
        className="animate-sheet bg-paper relative mx-auto w-full max-w-md rounded-t-sheet px-5 pt-6"
        style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
      >
        <h2 id="delete-title" className="text-heading font-semibold">
          {t("deleteTitle")}
        </h2>
        <p id="delete-body" className="text-ink-soft mt-2 text-label">
          {t("deleteBody")}
        </p>
        <div className="mt-4">
          <Field label={t("deleteTypeHandle", { handle })} value={typed} onChange={setTyped} />
        </div>
        {failed ? (
          <p role="alert" className="text-ink mt-3 text-label">
            {t("deleteFailed")}
          </p>
        ) : null}

        <Primary onClick={() => void remove()} busy={busy} disabled={!matches(typed, handle)}>
          {t("deleteConfirm")}
        </Primary>
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          className="text-accent mt-1 min-h-12 w-full text-label font-medium"
        >
          {t("deleteCancel")}
        </button>
      </div>
    </div>
  );
}
