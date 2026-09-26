"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronRightIcon, ShieldIcon } from "@/components/icons";
import { Monogram } from "@/components/ui/Monogram";
import type { BadgeState } from "@/core/badges";
import { displayTier, weekEndsAt, ZONES_FROM, TOP_TIER } from "@/core/league";
import { leagueFacts } from "@/core/badges";
import { db, receivedGifts } from "@/lib/db";
import { claimHandle } from "@/lib/remote";
import { badgeStates, duelsNeedingMe } from "@/lib/social";
import { useProfile } from "@/lib/useProfile";
import { Field, Primary } from "@/components/account/SignIn";
import { SignOut } from "@/components/account/SignOut";
import { BadgeGlyph } from "./BadgeGlyph";
import { splitDuration, useNow, type Social } from "./data";
import { SectionTitle } from "./Screen";

export type ProfileRoute = "league" | "duels" | "friends" | "badges";

/**
 * Profil: nahoře „já“ — monogram s odznakem ligy a čtyři odečty. Pod tím
 * dlaždice, které vedou dál, a každá říká, co se v ní právě děje. Nastavení
 * účtu je až dole: mění se jednou, dívá se na ně málokdo.
 */
export function ProfileHome({
  social,
  email,
  onOpen,
}: {
  social: Social;
  email?: string;
  onOpen: (route: ProfileRoute) => void;
}) {
  const t = useTranslations("social");
  const format = useFormatter();
  const now = useNow();
  const { profile: local, streak } = useProfile();
  const lessons = useLiveQuery(() => db().lessons.count(), [], 0);

  const remote = social.profile.data;
  const handle = remote?.handle ?? "";
  const record = social.record.data;
  const league = social.league.data ?? null;
  const duels = social.duels.data ?? [];
  const friends = social.friends.data ?? [];
  const requests = social.requests.data ?? [];
  const needMe = duelsNeedingMe(duels);
  const incoming = duels.find((duel) => duel.status === "offered" && !duel.challengedByMe);

  const me = league?.rows.find((row) => row.userId === social.userId);
  const left = splitDuration(weekEndsAt(new Date(now)).getTime() - now);

  const badges = useBadges(social);
  const unlocked = badges?.filter((badge) => badge.level > 0).length ?? 0;

  return (
    <>
      <section className="pt-1 pb-6">
        <div className="flex items-center gap-5">
          <Monogram handle={handle || "?"} size="lg" tier={league?.tier ?? 1} />
          <div className="min-w-0">
            <p className="truncate text-title font-semibold">{handle}</p>
            {remote ? (
              <p className="text-ink-soft mt-1 text-label">
                {t("since", { date: new Date(remote.createdAt) })}
              </p>
            ) : null}
            <p className="text-accent mt-1.5 text-label font-semibold" data-numeric>
              {t("leagueName", { number: displayTier(league?.tier ?? 1) })}
            </p>
          </div>
        </div>

        <dl className="border-line divide-line mt-5 grid grid-cols-4 divide-x rounded-panel border">
          <Stat label={t("statStreak")} value={format.number(streak)} />
          <Stat label={t("statXp")} value={format.number(local.xp)} />
          <Stat label={t("statLessons")} value={format.number(lessons)} />
          <Stat
            label={t("statDuelWins")}
            value={record ? format.number(record.wins) : "–"}
            hint={record ? t("recordLabel", { ...record }) : undefined}
          />
        </dl>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Tile label={t("leagueTitle")} onClick={() => onOpen("league")}>
          {me && league ? (
            <>
              <span className="readout text-[1.75rem] leading-none font-semibold" data-numeric>
                {format.number(me.rank)}.
              </span>
              <span className="text-ink-soft text-label" data-numeric>
                {t("tileLeague", { size: league.rows.length, days: left.days, hours: left.hours })}
              </span>
            </>
          ) : (
            <span className="text-ink-soft text-label">{t("tileLeagueEmpty")}</span>
          )}
        </Tile>

        <Tile label={t("duelsTitle")} onClick={() => onOpen("duels")} dot={needMe > 0}>
          <span className="readout text-[1.75rem] leading-none font-semibold" data-numeric>
            {format.number(needMe)}
          </span>
          <span className="text-ink-soft text-label">
            {incoming
              ? t("tileDuelsIncoming", { handle: incoming.opponentHandle })
              : needMe > 0
                ? t("tileDuelsWaiting", { count: needMe })
                : t("tileDuelsNone")}
          </span>
        </Tile>

        <button
          type="button"
          onClick={() => onOpen("friends")}
          className="border-line active:bg-surface relative col-span-2 flex min-h-16 items-center gap-3 rounded-panel border px-4 py-3 text-left transition-colors duration-75"
        >
          {requests.length > 0 ? <Dot /> : null}
          <span className="min-w-0 flex-1">
            <span className="panel-label block" data-numeric>
              {t("tileFriends", { count: friends.length })}
            </span>
            {friends.length > 0 ? (
              <span className="mt-1.5 flex gap-1">
                {friends.slice(0, 6).map((friend) => (
                  <Monogram key={friend.userId} handle={friend.handle} size="sm" />
                ))}
                {friends.length > 6 ? (
                  <span className="readout bg-surface text-ink-soft flex size-8 items-center justify-center rounded-[0.375rem] text-micro">
                    +{friends.length - 6}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-ink-soft mt-0.5 block text-label">{t("tileFriendsEmpty")}</span>
            )}
          </span>
          <span className="text-accent text-label font-medium">
            {requests.length > 0 ? t("tileFriendsRequests", { count: requests.length }) : t("invite")}
          </span>
        </button>
      </div>

      <SectionTitle
        aside={
          <span className="readout text-ink-soft text-label" data-numeric>
            {t("badgesCount", { unlocked, total: badges?.length ?? 10 })}
          </span>
        }
      >
        {t("badgesTitle")}
      </SectionTitle>
      <button
        type="button"
        onClick={() => onOpen("badges")}
        aria-label={t("badgesOpen")}
        className="-mx-1 flex w-[calc(100%+0.5rem)] items-start gap-2 overflow-hidden px-1 text-left"
      >
        {(badges ?? [])
          // Získané napřed: profil se chlubí tím, co má, ne tím, co chybí.
          .slice()
          .sort((a, b) => Number(b.level > 0) - Number(a.level > 0))
          .slice(0, 5)
          .map((badge) => (
            <span key={badge.id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <BadgeGlyph id={badge.id} level={badge.level} levels={badge.levels} />
              <span className={`text-center text-micro leading-tight ${badge.level > 0 ? "font-medium" : "text-ink-soft"}`}>
                {t(`badge.${badge.id}.name`)}
              </span>
            </span>
          ))}
      </button>

      <Gifts />

      <SectionTitle>{t("accountTitle")}</SectionTitle>
      <HandleRow social={social} />
      {email ? (
        <div className="border-line flex min-h-13 items-center justify-between gap-3 border-b py-2">
          <span className="text-body">{t("email")}</span>
          <span className="text-ink-soft min-w-0 truncate text-label">{email}</span>
        </div>
      ) : null}
      <SignOut client={social.client} userId={social.userId} email={undefined} />
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-2.5 py-2.5" title={hint}>
      <dd className="readout text-[1.1875rem] leading-tight font-semibold" data-numeric>
        {value}
      </dd>
      <dt className="panel-label mt-0.5 !text-[0.65625rem]">{label}</dt>
    </div>
  );
}

function Tile({
  label,
  onClick,
  dot,
  children,
}: {
  label: string;
  onClick: () => void;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-line active:bg-surface relative flex min-h-28 flex-col items-start gap-1.5 rounded-panel border p-3.5 text-left transition-colors duration-75"
    >
      {dot ? <Dot /> : null}
      <span className="panel-label">{label}</span>
      {children}
    </button>
  );
}

/** Něco čeká. Tečka v akcentu, ne červená — červená patří chybě. */
function Dot() {
  return <span aria-hidden className="bg-accent absolute top-3.5 right-3.5 size-2.5 rounded-full" />;
}

/**
 * Odznaky se skládají z lokálních dat a toho, co ví server o lize,
 * soubojích a darech. Počítají se asynchronně (Dexie), proto vlastní stav.
 */
export function useBadges(social: Social): BadgeState[] | undefined {
  const history = social.history.data;
  const record = social.record.data;
  const gifts = social.giftsSent.data;
  const [states, setStates] = useState<BadgeState[]>();

  useEffect(() => {
    let cancelled = false;
    const league = history ? leagueFacts(history, TOP_TIER, ZONES_FROM) : null;
    void badgeStates({
      promoted: league?.promoted ?? null,
      reachedTopLeague: league?.reachedTopLeague ?? null,
      wonWeek: league?.wonWeek ?? null,
      duelWins: record?.wins ?? null,
      giftsSent: gifts ?? null,
    }).then((next) => {
      if (!cancelled) setStates(next);
    });
    return () => {
      cancelled = true;
    };
  }, [history, record, gifts]);

  return states;
}

/**
 * Dary, které dorazily. Čtou se z místní databáze, ne ze serveru:
 * ochrana se připisuje na zařízení a záznam o daru vzniká spolu s ní.
 */
function Gifts() {
  const t = useTranslations("social");
  const format = useFormatter();
  const gifts = useLiveQuery(() => receivedGifts(), [], []);
  if (gifts.length === 0) return null;

  return (
    <>
      <SectionTitle>{t("giftsTitle")}</SectionTitle>
      <ul className="border-line divide-line divide-y rounded-control border">
        {gifts.map((gift) => (
          <li key={gift.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
            <ShieldIcon className="text-pill size-5 shrink-0" />
            <span className="flex-1 text-body">{t("giftFrom", { handle: gift.fromHandle })}</span>
            <span className="readout text-ink-soft shrink-0 text-micro" data-numeric>
              {format.dateTime(new Date(gift.receivedAt), { dateStyle: "short" })}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Přezdívka v nastavení účtu: řádek, který se rozbalí do formuláře. */
function HandleRow({ social }: { social: Social }) {
  const t = useTranslations("social");
  const [open, setOpen] = useState(false);
  const current = social.profile.data?.handle ?? "";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-line flex min-h-13 w-full items-center justify-between gap-3 border-y py-2 text-left"
      >
        <span className="text-body">{t("handle")}</span>
        <span className="text-ink-soft flex items-center gap-1 text-label">
          <span className="readout">{current}</span>
          <ChevronRightIcon className="size-5" />
        </span>
      </button>
    );
  }

  return (
    <div className="border-line border-y py-3">
      <HandleForm
        social={social}
        onSaved={() => {
          setOpen(false);
          social.profile.refresh();
        }}
      />
    </div>
  );
}

/**
 * Přezdívka. Bez ní není podle čeho člověka najít, takže dokud není
 * nastavená, profil ukazuje jen tenhle formulář.
 */
export function HandleForm({
  social,
  onSaved,
  intro = false,
}: {
  social: Social;
  /** `created` je true u první přezdívky, tedy u právě založeného účtu. */
  onSaved: (created: boolean) => void;
  intro?: boolean;
}) {
  const t = useTranslations("account");
  const current = social.profile.data ?? null;
  const [handle, setHandle] = useState(current?.handle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await claimHandle(social.client, social.userId, handle);
      if (result.ok) onSaved(current === null);
      else setError(t(result.reason === "taken" ? "handleTaken" : "handleInvalid"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      {intro ? <h2 className="text-heading font-semibold">{t("handleTitle")}</h2> : null}
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
