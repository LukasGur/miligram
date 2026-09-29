"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronRightIcon, PencilIcon, ShieldIcon, VersusIcon } from "@/components/icons";
import { Monogram } from "@/components/ui/Monogram";
import type { BadgeState } from "@/core/badges";
import { displayTier, weekEndsAt, ZONES_FROM, TOP_TIER } from "@/core/league";
import { leagueFacts, showcaseOrder } from "@/core/badges";
import { db, receivedGifts } from "@/lib/db";
import { claimHandle } from "@/lib/remote";
import { badgeStates, duelsNeedingMe, publishBadgesIfChanged } from "@/lib/social";
import { useProfile } from "@/lib/useProfile";
import { Field, Primary } from "@/components/account/SignIn";
import { SignOut } from "@/components/account/SignOut";
import { DeleteAccount } from "@/components/account/DeleteAccount";
import { withTimeout } from "@/lib/useAction";
import { BadgeGlyph } from "./BadgeGlyph";
import { BadgeSheet } from "./BadgeSheet";
import { friendsByDuelState, FriendDuelChip, InviteChip } from "./FriendDuelChip";
import { splitDuration, useNow, type Social } from "./data";
import { SectionTitle } from "./Screen";

export type ProfileRoute = "league" | "duels" | "friends" | "badges";

/**
 * Profil: nahoře „já“ — monogram s odznakem ligy a čtyři odečty. Pod tím
 * souboje s řadou kamarádů, na které stačí klepnout, a dlaždice, které
 * vedou dál. Nastavení účtu je až dole: mění se jednou, dívá se na ně
 * málokdo.
 */
export function ProfileHome({
  social,
  email,
  onOpen,
  onChallenge,
  onEditTone,
}: {
  social: Social;
  email?: string;
  onOpen: (route: ProfileRoute) => void;
  /** Otevře výzvu; bez kamaráda s výběrem soupeře. */
  onChallenge: (friendId?: string) => void;
  onEditTone: () => void;
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
  const [openBadge, setOpenBadge] = useState<BadgeState | null>(null);

  return (
    <>
      <section className="pt-1 pb-6">
        <div className="flex items-center gap-5">
          {/* Vlastní monogram je zároveň volba barvy. Tužka říká, že na něj
              jde sáhnout; odznak ligy zůstává v opačném rohu. */}
          <button
            type="button"
            onClick={onEditTone}
            aria-label={t("toneOpen")}
            className="relative shrink-0 rounded-full"
          >
            <Monogram handle={handle || "?"} size="lg" tier={league?.tier ?? 1} />
            <span className="bg-paper border-line text-ink-soft absolute -top-0.5 -right-0.5 grid size-6 place-items-center rounded-full border">
              <PencilIcon className="size-3.5" />
            </span>
          </button>
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

      <DuelsCard
        social={social}
        needMe={needMe}
        incoming={incoming?.opponentHandle}
        onOpen={() => onOpen("duels")}
        onChallenge={onChallenge}
        onInvite={() => onOpen("friends")}
      />

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
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

        <Tile label={t("friendsTitle")} onClick={() => onOpen("friends")} dot={requests.length > 0}>
          {friends.length > 0 ? (
            <span className="flex items-center">
              {friends.slice(0, 4).map((friend, index) => (
                <Monogram
                  key={friend.userId}
                  handle={friend.handle}
                  size="sm"
                  className={`ring-paper ring-2 ${index > 0 ? "-ml-2" : ""}`}
                />
              ))}
              {friends.length > 4 ? (
                <span className="readout bg-surface text-ink-soft ring-paper -ml-2 flex size-8 items-center justify-center rounded-full text-micro ring-2">
                  +{friends.length - 4}
                </span>
              ) : null}
            </span>
          ) : null}
          <span className={`text-label ${requests.length > 0 ? "text-accent font-medium" : "text-ink-soft"}`} data-numeric>
            {requests.length > 0
              ? t("tileFriendsRequests", { count: requests.length })
              : friends.length > 0
                ? t("tileFriendsCount", { count: friends.length })
                : t("tileFriendsEmpty")}
          </span>
        </Tile>
      </div>

      <SectionTitle
        aside={
          <button
            type="button"
            onClick={() => onOpen("badges")}
            aria-label={t("badgesOpen")}
            className="text-ink-soft active:text-ink -my-3 -mr-2 flex min-h-11 items-center gap-0.5 pl-3 transition-colors duration-75"
          >
            <span className="readout text-label" data-numeric>
              {t("badgesCount", { unlocked, total: badges?.length ?? 10 })}
            </span>
            <ChevronRightIcon className="size-5" />
          </button>
        }
      >
        {t("badgesTitle")}
      </SectionTitle>
      <BadgeShelf badges={badges} onSelect={setOpenBadge} onAll={() => onOpen("badges")} />
      {openBadge ? <BadgeSheet badge={openBadge} onClose={() => setOpenBadge(null)} /> : null}

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
      <DeleteAccount client={social.client} handle={social.profile.data?.handle ?? null} />
    </>
  );
}

/**
 * Souboje. Hlavička vede na seznam, pod ní řada kamarádů se stavem
 * (FriendDuelChip): volného klepnutí rovnou vyzve, ostatní vedou
 * na souboje. Dřív vedla výzva přes seznam soubojů
 * a výběr soupeře — pět klepnutí, a tak se skoro nevyzývalo.
 */
function DuelsCard({
  social,
  needMe,
  incoming,
  onOpen,
  onChallenge,
  onInvite,
}: {
  social: Social;
  needMe: number;
  incoming: string | undefined;
  onOpen: () => void;
  onChallenge: (friendId?: string) => void;
  onInvite: () => void;
}) {
  const t = useTranslations("social");
  const format = useFormatter();
  const friends = social.friends.data ?? [];
  const duels = social.duels.data ?? [];
  const ordered = friendsByDuelState(friends, duels);

  return (
    <section className="border-line rounded-panel border">
      <button
        type="button"
        onClick={onOpen}
        className="active:bg-surface relative flex min-h-14 w-full items-center gap-3 rounded-t-panel px-3.5 py-3 text-left transition-colors duration-75"
      >
        <span className="bg-accent-wash text-accent grid size-9 shrink-0 place-items-center rounded-full">
          <VersusIcon className="size-[1.125rem]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="panel-label block">{t("duelsTitle")}</span>
          <span className={`block truncate text-label ${needMe > 0 ? "text-ink font-medium" : "text-ink-soft"}`}>
            {incoming
              ? t("tileDuelsIncoming", { handle: incoming })
              : needMe > 0
                ? t("tileDuelsWaiting", { count: needMe })
                : t("tileDuelsNone")}
          </span>
        </span>
        {needMe > 0 ? (
          <span className="readout bg-accent grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-micro font-semibold text-white" data-numeric>
            {format.number(needMe)}
          </span>
        ) : null}
        <ChevronRightIcon className="text-ink-soft size-5 shrink-0" />
      </button>

      <div className="border-line border-t px-1.5 pt-2.5 pb-2">
        <p className="panel-label px-2">{t("challengeRow")}</p>
        <div className="mt-1 flex overflow-x-auto">
          {ordered.map(({ friend, state }) => (
            <FriendDuelChip
              key={friend.userId}
              friend={friend}
              state={state}
              onSelect={() => (state === "free" ? onChallenge(friend.userId) : onOpen())}
            />
          ))}
          <InviteChip onSelect={onInvite} />
        </div>
      </div>
    </section>
  );
}

/**
 * Odznaky na profilu: vodorovná police až k okraji displeje. Šířka položek
 * je spočítaná tak, aby u pravého okraje vždycky vykukovala půlka dalšího
 * odznaku — říká „posuň mě“, ne „něco se uřízlo“. Každý odznak otevře
 * detail, police končí cestou na všechny.
 */
function BadgeShelf({
  badges,
  onSelect,
  onAll,
}: {
  badges: BadgeState[] | undefined;
  onSelect: (badge: BadgeState) => void;
  onAll: () => void;
}) {
  const t = useTranslations("social");
  // Obsahová šířka police je šířka sloupce (odsazení 1.25rem z obou stran),
  // vidět je navíc pravý okraj; 4,5 položky a čtyři mezery po 0.5rem.
  const item = "w-[max(4.25rem,calc((100%-0.75rem)/4.5))]";
  return (
    <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {showcaseOrder(badges ?? []).map((badge) => (
        <button
          key={badge.id}
          type="button"
          onClick={() => onSelect(badge)}
          className={`group flex shrink-0 snap-start flex-col items-center gap-1.5 pt-0.5 ${item}`}
        >
          <span className="transition-transform duration-150 group-active:scale-94">
            <BadgeGlyph id={badge.id} level={badge.level} levels={badge.levels} />
          </span>
          <span className={`text-center text-micro leading-tight ${badge.level > 0 ? "font-medium" : "text-ink-soft"}`}>
            {t(`badge.${badge.id}.name`)}
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onAll}
        className={`group flex shrink-0 snap-start flex-col items-center gap-1.5 pt-0.5 ${item}`}
      >
        <span className="border-line text-ink-soft group-active:bg-surface grid size-14 place-items-center rounded-full border transition-colors duration-75">
          <ChevronRightIcon className="size-6" />
        </span>
        <span className="text-ink-soft text-center text-micro leading-tight">{t("badgesAll")}</span>
      </button>
      {/* Konec police: pravé odsazení, které Safari u posuvného flexu jinak zahodí. */}
      <span aria-hidden className="w-3 shrink-0" />
    </div>
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
      // Ligové a soubojové odznaky se dopočítají až tady.
      void publishBadgesIfChanged(social.client, social.userId).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [history, record, gifts, social.client, social.userId]);

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
        onSaved={() => setOpen(false)}
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
  const tSocial = useTranslations("social");
  const current = social.profile.data ?? null;
  const [handle, setHandle] = useState(current?.handle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await withTimeout(claimHandle(social.client, social.userId, handle));
      if (result.ok) onSaved(current === null);
      else setError(t(result.reason === "taken" ? "handleTaken" : "handleInvalid"));
    } catch {
      setError(tSocial("errorNetwork"));
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
      <Primary onClick={save} busy={busy} disabled={handle.trim().length < 3 || handle === current?.handle}>
        {t("handleSave")}
      </Primary>
      {error ? <p className="text-danger mt-2 text-label">{error}</p> : null}
    </section>
  );
}
