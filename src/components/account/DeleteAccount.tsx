"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { detachPushDevice } from "@/lib/push";
import { deleteAccount } from "@/lib/remote";
import type { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/useAction";
import { wipeDevice } from "@/lib/account";
import { Field, Primary } from "./SignIn";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

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
      <Button
        onClick={() => setConfirming(true)}
        variant="text" tone="muted" className="px-3"
      >
        {t("deleteAccount")}
      </Button>
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
    <BottomSheet
      onClose={onClose}
      scrimLabel={t("deleteCancel")}
      labelledBy="delete-title"
      describedBy="delete-body"
      initialFocus={cancelRef}
      className="px-5 pt-6"
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
      <Button
        ref={cancelRef}
        onClick={onClose}
        variant="text" className="mt-1 w-full"
      >
        {t("deleteCancel")}
      </Button>
    </BottomSheet>
  );
}
