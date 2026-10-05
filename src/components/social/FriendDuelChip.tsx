"use client";

import { useTranslations } from "next-intl";
import { HourglassIcon, PlayIcon, PlusIcon, VersusIcon } from "@/components/icons";
import { Monogram } from "@/components/ui/Monogram";
import { FRIEND_DUEL_ORDER, friendDuelState, type FriendDuelState } from "@/core/duel";
import type { Duel, FriendSummary } from "@/lib/remote";

/** Kamarádi seřazení podle toho, kde mám něco udělat já. */
export function friendsByDuelState(
  friends: readonly FriendSummary[],
  duels: readonly Duel[],
): { friend: FriendSummary; state: FriendDuelState }[] {
  return friends
    .map((friend) => ({ friend, state: friendDuelState(duels, friend.userId) }))
    .sort((a, b) => FRIEND_DUEL_ORDER[a.state] - FRIEND_DUEL_ORDER[b.state]);
}

/**
 * Kamarád v řadě soubojů: monogram, v rohu odznak se stavem a pod jménem
 * slovo, co se s ním dá dělat.
 *
 * Dřív to rozlišovalo jen zašednutí — a zašednutí říká „na tohle nesahej“,
 * ne „čeká se na něj“. Teď má každý stav svou ikonu a svoje slovo, barva
 * jen zdůrazní, kde je na tahu uživatel: indigový prstenec kolem
 * monogramu, jako když na tebe někdo čeká. Nic není vypnuté; i čekající
 * souboj se dá otevřít.
 */
export function FriendDuelChip({
  friend,
  state,
  onSelect,
  disabled = false,
  selected = false,
}: {
  friend: FriendSummary;
  state: FriendDuelState;
  onSelect: () => void;
  /** Ve výběru soupeře nejde vyzvat toho, s kým souboj běží. */
  disabled?: boolean;
  selected?: boolean;
}) {
  const t = useTranslations("social");
  const mine = state === "incoming" || state === "myTurn";
  const label = t(`friendState.${state}`, { handle: friend.handle });

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected || undefined}
      aria-label={label}
      className="active:bg-surface flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-control pt-1.5 pb-1 disabled:opacity-45"
    >
      <span
        className={`relative rounded-full p-[3px] transition-shadow duration-150 ${
          selected || mine ? "shadow-[0_0_0_2px_var(--color-accent)]" : ""
        }`}
      >
        <Monogram handle={friend.handle} />
        <Badge state={state} />
      </span>
      <span className="w-full truncate px-0.5 text-center text-micro leading-tight font-medium">{friend.handle}</span>
      <span
        className={`-mt-0.5 w-full truncate px-0.5 text-center text-[0.6875rem] leading-tight ${
          mine ? "text-accent font-semibold" : state === "free" ? "text-accent" : "text-ink-soft"
        }`}
      >
        {t(`friendStateShort.${state}`)}
      </span>
    </button>
  );
}

/** Odznak v rohu. Plný indigo, když se dá něco udělat; šedý, když se čeká. */
function Badge({ state }: { state: FriendDuelState }) {
  const waiting = state === "waiting";
  return (
    <span
      aria-hidden
      className={`border-paper absolute -right-0.5 -bottom-0.5 grid size-[1.375rem] place-items-center rounded-full border-2 ${
        waiting ? "bg-surface text-ink-soft" : "bg-accent text-on-accent"
      }`}
    >
      {state === "free" ? (
        <VersusIcon className="size-3" />
      ) : state === "myTurn" ? (
        <PlayIcon className="ml-px size-2.5" />
      ) : state === "incoming" ? (
        <span className="text-[0.6875rem] leading-none font-bold">!</span>
      ) : (
        <HourglassIcon className="size-3" />
      )}
    </span>
  );
}

/** Poslední v řadě: pozvat dalšího. Stejné rozměry jako kamarád vedle. */
export function InviteChip({ onSelect }: { onSelect: () => void }) {
  const t = useTranslations("social");
  return (
    <button
      type="button"
      onClick={onSelect}
      className="active:bg-surface flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-control pt-1.5 pb-1"
    >
      <span className="p-[3px]">
        <span className="border-ink-soft/40 text-ink-soft grid size-12 place-items-center rounded-full border border-dashed">
          <PlusIcon className="size-5" />
        </span>
      </span>
      <span className="text-ink-soft w-full truncate text-center text-micro leading-tight font-medium">{t("invite")}</span>
      <span className="text-ink-soft -mt-0.5 w-full truncate text-center text-[0.6875rem] leading-tight">
        {t("inviteWho")}
      </span>
    </button>
  );
}
