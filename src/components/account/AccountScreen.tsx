"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import {
  claimHandle,
  fetchProfile,
  leagueStanding,
  listDuels,
  remoteGateway,
  type Duel,
  type LeagueStanding,
  type RemoteProfile,
} from "@/lib/remote";
import { useRemoteQuery } from "@/lib/remoteQuery";
import { supabase, isRemoteConfigured } from "@/lib/supabase";
import { syncOutbox } from "@/lib/sync";
import { usePendingEvents } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";
import { Field, Primary, SignIn } from "./SignIn";
import { Friends } from "./Friends";
import { Duels } from "./Duels";
import { League } from "./League";

/**
 * Účet, přátelé a žebříček.
 *
 * Celá obrazovka je nepovinná: bez přihlášení i bez nastaveného serveru
 * aplikace funguje dál, jen se nedá s nikým porovnat. Proto se sem nedostane
 * nic, bez čeho by lekce nešla dohrát.
 */
export function AccountScreen({
  onClose,
  onPlayDuel,
}: {
  onClose: () => void;
  onPlayDuel: (duel: { id: string; lessonId: string }) => void;
}) {
  const t = useTranslations("account");
  const { session, ready } = useSession();
  const client = supabase();

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <header
        className="app-chrome flex items-center justify-between px-5 pb-2"
        style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
      >
        <h1 className="text-heading font-semibold">{t("title")}</h1>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("title")}
          className="text-ink-soft -mr-3 flex size-11 items-center justify-center"
        >
          <CloseIcon className="size-6" />
        </button>
      </header>

      <main tabIndex={0} className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-10">
          {!isRemoteConfigured() || client === null ? (
            <section>
              <h2 className="text-heading font-semibold">{t("disabledTitle")}</h2>
              <p className="text-ink-soft mt-1.5 text-label">{t("disabledBody")}</p>
            </section>
          ) : !ready ? (
            <p className="text-ink-soft text-label">{t("loading")}</p>
          ) : session === null ? (
            <SignIn />
          ) : (
            <SignedIn client={client} userId={session.user.id} onPlayDuel={onPlayDuel} />
          )}
        </div>
      </main>
    </div>
  );
}

function SignedIn({
  client,
  userId,
  onPlayDuel,
}: {
  client: ReturnType<typeof supabase> & object;
  userId: string;
  onPlayDuel: (duel: { id: string; lessonId: string }) => void;
}) {
  const t = useTranslations("account");
  const profile = useRemoteQuery<RemoteProfile | null>(`profile:${userId}`, () =>
    fetchProfile(client, userId),
  );
  const duels = useRemoteQuery<Duel[]>(`duels:${userId}`, () => listDuels(client, userId));
  const league = useRemoteQuery<LeagueStanding | null>(`league:${userId}`, () =>
    leagueStanding(client, userId),
  );

  return (
    <>
      <HandleForm
        /**
         * Klíč vynutí novou instanci, jakmile profil dorazí ze serveru.
         * Formulář si počáteční hodnotu bere z props jen při vytvoření —
         * bez klíče by pole zůstalo prázdné, i když přezdívka existuje.
         */
        key={profile.data?.handle ?? "bez-prezdivky"}
        client={client}
        userId={userId}
        current={profile.data ?? null}
        onSaved={profile.refresh}
      />
      {profile.data ? (
        <>
          <League standing={league.data ?? null} userId={userId} />
          <Friends client={client} userId={userId} onChallenged={duels.refresh} />
          <Duels duels={duels.data ?? []} loading={duels.loading} onPlay={onPlayDuel} />
        </>
      ) : null}
      <Sync client={client} userId={userId} />
      <button
        type="button"
        onClick={() => client.auth.signOut()}
        className="text-ink-soft mt-10 min-h-11 text-label font-medium"
      >
        {t("signOut")}
      </button>
    </>
  );
}

/**
 * Přezdívka. Bez ní není podle čeho člověka najít, takže dokud není
 * nastavená, žebříček se nezobrazuje — nebylo by v něm koho hledat.
 */
function HandleForm({
  client,
  userId,
  current,
  onSaved,
}: {
  client: ReturnType<typeof supabase> & object;
  userId: string;
  current: RemoteProfile | null;
  onSaved: () => void;
}) {
  const t = useTranslations("account");
  const [handle, setHandle] = useState(current?.handle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await claimHandle(client, userId, handle);
      if (result.ok) onSaved();
      else setError(t(result.reason === "taken" ? "handleTaken" : "handleInvalid"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="text-heading font-semibold">{t("handleTitle")}</h2>
      <p className="text-ink-soft mt-1.5 text-label">{t("handleHint")}</p>
      <div className="mt-3">
        <Field label={t("handleTitle")} value={handle} onChange={setHandle} inputMode="text" />
      </div>
      <Primary onClick={save} disabled={busy || handle.trim().length < 3 || handle === current?.handle}>
        {t("handleSave")}
      </Primary>
      {error ? <p className="text-danger mt-2 text-label">{error}</p> : null}
    </section>
  );
}

/**
 * Odeslání fronty. Ručně, ne na pozadí — dokud není jasné, jak se aplikace
 * chová na slabé síti, je lepší, aby uživatel viděl, co se posílá a kdy.
 */
function Sync({ client, userId }: { client: ReturnType<typeof supabase> & object; userId: string }) {
  const t = useTranslations("account");
  const pending = usePendingEvents();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await syncOutbox(remoteGateway(client, userId));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-heading font-semibold">{t("syncTitle")}</h2>
      <p className="text-ink-soft mt-1.5 text-label" data-numeric>
        {t("syncPending", { count: pending })}
      </p>
      {pending > 0 ? (
        <Primary onClick={send} disabled={busy}>
          {t("syncNow")}
        </Primary>
      ) : null}
      {failed ? <p className="text-danger mt-2 text-label">{t("syncFailed")}</p> : null}
    </section>
  );
}
