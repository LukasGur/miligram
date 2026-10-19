"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CloseIcon, PersonIcon } from "@/components/icons";
import { Pastille } from "@/components/ui/Pastille";
import { Readout } from "@/components/ui/Readout";
import { Spinner } from "@/components/ui/Spinner";
import { adoptDevice, bindDecision, wipeDevice, type DeviceSummary } from "@/lib/account";
import { dismissBonus, useBonus } from "@/lib/bonus";
import { accountHasHistory } from "@/lib/remote";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/useAction";
import { useProfile } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";
import { Primary } from "./SignIn";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

type Pending = { userId: string; reason: "anonymous" | "otherAccount"; summary: DeviceSummary };

/**
 * Brána mezi přihlášením a daty v telefonu.
 *
 * Po přihlášení rozhodne, komu data v telefonu patří (src/lib/account.ts).
 * Registrace si je vezme bez ptaní. Když ale účet už svůj postup má,
 * data z telefonu by se smazala — a to se nesmí stát potichu. Student
 * dostane upozornění s tím, co přesně zmizí, a může couvnout.
 *
 * Dokud se nerozhodne, synchronizace stojí (SyncAgent mluví jen za
 * vlastníka dat), takže se nic nesmíchá ani neodešle za cizí účet.
 *
 * Nic jiného nevykresluje než upozornění a oznámení o bonusu.
 */
export function AccountGate() {
  const { session } = useSession();
  const { profile, ready } = useProfile();
  const userId = session?.user.id;
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    const client = supabase();
    if (!client || !ready || !userId || profile.ownerId === userId) return;

    let cancelled = false;
    let running = false;
    const decide = async () => {
      if (cancelled || running) return;
      running = true;
      try {
        const decision = await bindDecision(userId, () => withTimeout(accountHasHistory(client, userId)));
        if (cancelled) return;
        if (decision.action === "adopt") await adoptDevice(userId);
        else setPending({ userId, reason: decision.reason, summary: decision.summary });
      } catch {
        // Bez sítě se nedá zjistit, jestli účet svoje data má. Počká se
        // na ni; fronta mezitím stojí, takže se nic neodešle špatně.
      } finally {
        running = false;
      }
    };

    void decide();
    window.addEventListener("online", decide);
    return () => {
      cancelled = true;
      window.removeEventListener("online", decide);
    };
  }, [ready, userId, profile.ownerId]);

  // Odhlášení nebo jiný účet: upozornění pro předchozí už neplatí.
  const open = pending !== null && pending.userId === userId && profile.ownerId !== userId;

  return (
    <>
      {open ? <BindSheet pending={pending} onDone={() => setPending(null)} /> : null}
      <BonusNotice />
    </>
  );
}

/**
 * Upozornění před smazáním dat z telefonu.
 *
 * Hlavní akce je přihlásit se: kdo zadal kód ke svému účtu, většinou
 * chce svůj účet, ne pár lekcí odehraných bez něj. Proto ale musí být
 * vidět, co přesně zmizí, a cesta ven hned pod ní. „Zpět“ přihlášení
 * zruší a data v telefonu nechá.
 *
 * Nic z toho není červené — červená patří chybné odpovědi.
 */
function BindSheet({ pending, onDone }: { pending: Pending; onDone: () => void }) {
  const t = useTranslations("account");
  const format = useFormatter();
  const [busy, setBusy] = useState<"confirm" | "back" | null>(null);
  const [failed, setFailed] = useState(false);
  const { summary, reason } = pending;
  const anonymous = reason === "anonymous";

  async function back() {
    const client = supabase();
    if (!client || busy) return;
    setBusy("back");
    // Jen z tohohle telefonu. Jinde přihlášený účet se tím odhlásit nesmí.
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    setBusy(null);
    onDone();
  }

  async function confirm() {
    if (busy) return;
    setBusy("confirm");
    setFailed(false);
    try {
      await wipeDevice(pending.userId);
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <BottomSheet
      onClose={() => void back()}
      role="alertdialog"
      labelledBy="bind-title"
      describedBy="bind-body"
      className="px-5 pt-6"
      style={{ paddingBottom: "calc(var(--sa-b) + 1rem)" }}
    >
      <span className="bg-accent-wash text-accent flex size-11 items-center justify-center rounded-full">
        <PersonIcon className="size-6" />
      </span>
      <h2 id="bind-title" className="mt-4 text-heading font-semibold">
        {anonymous ? t("bindTitleAnonymous") : t("bindTitleOther")}
      </h2>
      <p id="bind-body" className="text-ink-soft mt-1.5 text-label">
        {anonymous ? t("bindBodyAnonymous") : t("bindBodyOther")}
      </p>

      {/* Co zmizí, jako odečty: tři čísla, na která se kouká. */}
      <section className="bg-surface rounded-panel mt-5 px-4 pt-3 pb-3.5" aria-label={t("bindLoses")}>
        <h3 className="panel-label">{t("bindLoses")}</h3>
        <div className="divide-line mt-2 grid grid-cols-3 divide-x">
          <div className="pr-3">
            <Readout label={t("bindLessons")} value={format.number(summary.lessons)} size="small" />
          </div>
          <div className="px-3">
            <Readout
              label={t("bindStreak")}
              value={format.number(summary.streak)}
              unit={t("bindStreakUnit", { days: summary.streak })}
              size="small"
            />
          </div>
          <div className="pl-3">
            <p className="panel-label">{t("bindPills")}</p>
            <p className="readout text-heading mt-0.5 flex items-center gap-1 font-semibold" data-numeric>
              <Pastille className="size-4 shrink-0" />
              {format.number(summary.pills)}
            </p>
          </div>
        </div>
        {summary.unfinished ? <p className="text-ink-soft mt-2.5 text-micro">{t("bindUnfinished")}</p> : null}
      </section>

      {anonymous ? (
        <p className="mt-4 text-label">
          <strong className="font-semibold">{t("bindKeepTitle")}</strong>{" "}
          <span className="text-ink-soft">{t("bindKeepBody")}</span>
        </p>
      ) : null}

      {failed ? (
        <p role="alert" className="text-ink mt-3 text-label">
          {t("bindFailed")}
        </p>
      ) : null}

      <div className="mt-2">
        <Primary onClick={() => void confirm()} busy={busy === "confirm"} disabled={busy === "back"}>
          {anonymous ? t("bindConfirm") : t("bindContinue")}
        </Primary>
      </div>
      <Button
        onClick={() => void back()}
        disabled={busy !== null}
        variant="text" className="mt-1 w-full gap-2"
      >
        {busy === "back" ? <Spinner className="text-accent" /> : null}
        {t("bindBack")}
      </Button>
    </BottomSheet>
  );
}

/** Jak dlouho oznámení visí. Dost na přečtení dvou řádků, ne na překážení. */
const NOTICE_MS = 6000;

/**
 * Oznámení o bonusu za registraci. Nahoře, jako notifikace — obrazovka
 * pod ním může být zrovna výběr přezdívky a nesmí se přerušit.
 */
function BonusNotice() {
  const t = useTranslations("account");
  const amount = useBonus();

  useEffect(() => {
    if (amount === null) return;
    const timer = window.setTimeout(dismissBonus, NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [amount]);

  if (amount === null) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] px-4"
      style={{ paddingTop: "calc(var(--sa-t) + 0.5rem)" }}
    >
      <div
        role="status"
        className="animate-notice bg-paper border-line pointer-events-auto mx-auto flex w-full max-w-md items-center gap-3 rounded-panel border py-3 pr-1 pl-3.5 shadow-lg"
        style={{ animationDelay: "0ms" }}
      >
        <span className="bg-pill-wash flex size-10 shrink-0 items-center justify-center rounded-full">
          <Pastille className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-pill text-body font-semibold" data-numeric>
            {t("bonusTitle", { count: amount })}
          </p>
          <p className="text-ink-soft text-label">{t("bonusBody")}</p>
        </div>
        <button
          type="button"
          onClick={dismissBonus}
          aria-label={t("bonusDismiss")}
          className="text-ink-soft flex size-11 shrink-0 items-center justify-center"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}
