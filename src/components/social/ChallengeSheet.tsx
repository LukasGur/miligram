"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronDownIcon, CloseIcon, VersusIcon } from "@/components/icons";
import { Monogram } from "@/components/ui/Monogram";
import { Pastille } from "@/components/ui/Pastille";
import { MASTERY_MIN_ANSWERS } from "@/core/curriculum";
import { DIFFICULTY_RAMP, newLessonId } from "@/core/lessonPlan";
import { DUEL_TOPICS, DUEL_WIN_PILLS, type DuelTopic } from "@/core/duel";
import type { Category } from "@/core/types";
import { categoryScores } from "@/lib/curriculum";
import { createDuel, type Duel, type FriendSummary } from "@/lib/remote";

type Rate = { answered: number; correct: number };

export type CreatedDuel = { id: string; lessonId: string; topic: DuelTopic; friend: FriendSummary };

/** Běží s kamarádem souboj? Pak další výzva nejde (jeden naráz, migrace 0010). */
export function duelOpenWith(duels: readonly Duel[], friendId: string): boolean {
  return duels.some(
    (duel) => duel.opponentId === friendId && (duel.status === "offered" || duel.status === "accepted"),
  );
}

/**
 * Výzva na jeden krok.
 *
 * Dřív to byla samostatná obrazovka o pěti klepnutích od domova a s tabulkou
 * podmínek nahoře; kdo chtěl vyzvat, musel ji najít. Teď se list otevře
 * tam, kde chuť vzniká — po lekci, po výsledku souboje, u kamaráda — a soupeř
 * i téma jsou předvyplněné. Stačí jedno klepnutí.
 *
 * Téma je čip: kdo ho nechce měnit, nevidí mřížku dvanácti kategorií.
 * Podmínky jsou shrnuté na řádek a celé pod odkazem — pořád žádné
 * překvapení, co se počítá, jen ne v cestě.
 */
export function ChallengeSheet({
  client,
  userId,
  myHandle,
  friends,
  duels,
  friendId: preset,
  topic: presetTopic,
  onClose,
  onCreated,
}: {
  client: SupabaseClient;
  userId: string;
  myHandle: string;
  friends: readonly FriendSummary[];
  duels: readonly Duel[];
  /** Předvybraný soupeř. Bez něj list nabídne řadu kamarádů. */
  friendId?: string;
  topic?: DuelTopic;
  onClose: () => void;
  onCreated: (duel: CreatedDuel, playNow: boolean) => void;
}) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  const format = useFormatter();
  const [friendId, setFriendId] = useState<string | undefined>(preset);
  const [topic, setTopic] = useState<DuelTopic>(presetTopic ?? "mix");
  const [picking, setPicking] = useState(false);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const friend = friends.find((one) => one.userId === friendId);
  const open = friend ? duelOpenWith(duels, friend.userId) : false;
  const mine = useLiveQuery(() => categoryScores(), []);

  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function create(playNow: boolean) {
    if (!friend || busy || open) return;
    setBusy(true);
    setError(null);
    try {
      const lessonId = newLessonId();
      const result = await createDuel(client, userId, friend.userId, lessonId, topic);
      if (result.ok) {
        onCreated({ id: result.id, lessonId, topic, friend }, playNow);
        return;
      }
      setError(result.reason === "open" ? t("errorOpenDuel", { handle: friend.handle }) : t("errorRefused"));
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setBusy(false);
    }
  }

  const topicName = topic === "mix" ? t("topicMix") : tCategory(topic);
  const status = error ?? (friend && open ? t("errorOpenDuel", { handle: friend.handle }) : null);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label={t("close")} onClick={onClose} className="animate-scrim bg-ink/25 absolute inset-0" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-title"
        className="animate-sheet bg-paper relative mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-sheet"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 id="challenge-title" className="text-heading font-semibold">
            {friend && preset ? t("challengeTitle", { handle: friend.handle }) : t("newDuel")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("close")} className="text-ink-soft -mr-3 size-11 p-3">
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div tabIndex={-1} className="scroll-y min-h-0 flex-1 px-5 pb-2">
          {preset && friend ? (
            <Versus me={myHandle} them={friend.handle} />
          ) : (
            <Opponents friends={friends} duels={duels} selected={friendId} onSelect={setFriendId} />
          )}

          {/* Téma: čip, který se rozbalí do mřížky. */}
          <button
            type="button"
            onClick={() => setPicking((value) => !value)}
            aria-expanded={picking}
            className="border-line active:bg-surface mt-4 flex min-h-13 w-full items-center gap-3 rounded-control border px-3.5 text-left transition-colors duration-75"
          >
            <span className="panel-label shrink-0">{t("pickTopic")}</span>
            <span className="min-w-0 flex-1 truncate text-right text-body font-semibold">{topicName}</span>
            <ChevronDownIcon
              className={`text-ink-soft size-5 shrink-0 transition-transform duration-200 ${picking ? "rotate-180" : ""}`}
            />
          </button>

          {picking ? (
            <div className="animate-rise mt-2">
              <div className="grid grid-cols-2 gap-2">
                {DUEL_TOPICS.map((value) => (
                  <TopicButton
                    key={value}
                    topic={value}
                    selected={topic === value}
                    onSelect={() => {
                      setTopic(value);
                      setPicking(false);
                    }}
                    mine={value === "mix" ? total(mine) : mine?.get(value)}
                  />
                ))}
              </div>
              <p className="text-ink-soft mt-2 text-micro" data-numeric>
                {t("rateNote", { min: MASTERY_MIN_ANSWERS })}
              </p>
            </div>
          ) : null}

          {/* Podmínky na jeden řádek, celé pod odkazem. */}
          <div className="text-ink-soft mt-3 flex items-center gap-x-2 text-label">
            <span className="readout min-w-0 flex-1 truncate" data-numeric>
              {t("challengeSummary", { count: DIFFICULTY_RAMP.length })}
            </span>
            <span className="readout text-pill inline-flex shrink-0 items-center gap-1 font-semibold" data-numeric>
              <Pastille className="size-4" />+{format.number(DUEL_WIN_PILLS)}
            </span>
            <button
              type="button"
              onClick={() => setRules((value) => !value)}
              aria-expanded={rules}
              className="text-accent -mr-2 min-h-11 shrink-0 px-2 font-medium"
            >
              {t("challengeRules")}
            </button>
          </div>
          {rules ? <Terms /> : null}
        </div>

        <div className="px-5 pt-2">
          {status ? (
            <p className="text-ink-soft mb-2 text-center text-label" role="status">
              {status}
            </p>
          ) : null}
          <button
            ref={primaryRef}
            type="button"
            onClick={() => void create(true)}
            disabled={!friend || busy || open}
            className="bg-accent active:bg-accent-press flex min-h-14 w-full items-center justify-center gap-2 rounded-control text-body font-semibold text-white transition-colors duration-75 disabled:opacity-40"
          >
            <VersusIcon className="size-5" />
            {t("challengeAndPlay")}
          </button>
          <button
            type="button"
            onClick={() => void create(false)}
            disabled={!friend || busy || open}
            className="text-accent mt-1 min-h-11 w-full text-label font-medium disabled:opacity-40"
          >
            {t("challengeOnly")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Ty proti kamarádovi. Dva monogramy a zkřížené meče mezi nimi. */
function Versus({ me, them }: { me: string; them: string }) {
  const t = useTranslations("social");
  return (
    <div className="bg-surface mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-panel px-3 py-4">
      <span className="flex min-w-0 flex-col items-center gap-1.5">
        <Monogram handle={me || "?"} />
        <span className="text-ink-soft w-full truncate text-center text-micro font-medium">{t("you")}</span>
      </span>
      <span className="bg-paper text-accent grid size-10 place-items-center rounded-full">
        <VersusIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col items-center gap-1.5">
        <Monogram handle={them} />
        <span className="w-full truncate text-center text-micro font-semibold">{them}</span>
      </span>
    </div>
  );
}

/** Řada kamarádů. Kdo má se mnou souboj rozehraný, je ztlumený. */
function Opponents({
  friends,
  duels,
  selected,
  onSelect,
}: {
  friends: readonly FriendSummary[];
  duels: readonly Duel[];
  selected: string | undefined;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("social");
  if (friends.length === 0) return <p className="text-ink-soft mt-3 text-label">{t("noFriendsYet")}</p>;
  return (
    <>
      <p className="panel-label mt-2 mb-2">{t("pickOpponent")}</p>
      <div className="-mx-5 flex gap-1 overflow-x-auto px-4 pb-1">
        {friends.map((one) => {
          const busy = duelOpenWith(duels, one.userId);
          const active = one.userId === selected;
          return (
            <button
              key={one.userId}
              type="button"
              disabled={busy}
              onClick={() => onSelect(one.userId)}
              aria-pressed={active}
              className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-control py-2 disabled:opacity-45"
            >
              <span
                className={`rounded-full p-[3px] transition-shadow duration-150 ${
                  active ? "shadow-[0_0_0_2px_var(--color-accent)]" : ""
                }`}
              >
                <Monogram handle={one.handle} />
              </span>
              <span className={`w-full truncate text-center text-micro ${active ? "font-semibold" : "font-medium"}`}>
                {one.handle}
              </span>
              {busy ? <span className="text-ink-soft -mt-1 text-[0.625rem]">{t("duelRunning")}</span> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function TopicButton({
  topic,
  selected,
  onSelect,
  mine,
}: {
  topic: DuelTopic;
  selected: boolean;
  onSelect: () => void;
  mine: Rate | undefined;
}) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  const mix = topic === "mix";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex gap-1 rounded-control border px-3 py-2 text-left ${
        mix ? "col-span-2 min-h-12 flex-row items-center justify-between" : "min-h-14 flex-col justify-center"
      } ${selected ? "border-accent bg-accent-wash shadow-[inset_0_0_0_1px_var(--color-accent)]" : "border-line"}`}
    >
      <span className="text-label leading-snug font-semibold">{mix ? t("topicMixLong") : tCategory(topic)}</span>
      <span className="readout text-ink-soft text-micro" data-numeric>
        {formatRate(mine)}
      </span>
    </button>
  );
}

/** Podmínky souboje jako ordinace. */
function Terms() {
  const t = useTranslations("social");
  const format = useFormatter();
  const ramp = DIFFICULTY_RAMP.join("‑");
  // [popisek, hodnota, číslo strojopisem, pastilky]
  const rows: [string, string, boolean, boolean?][] = [
    [t("termItems"), t("termItemsValue", { count: DIFFICULTY_RAMP.length, ramp }), true],
    [t("termPoint"), t("termPointValue"), false],
    [t("termTie"), t("termTieValue"), false],
    [t("termDeadline"), t("termDeadlineValue"), false],
    [t("termWin"), t("termWinValue", { pills: format.number(DUEL_WIN_PILLS) }), true, true],
  ];
  return (
    <dl className="animate-rise border-line divide-line mt-1 divide-y rounded-panel border">
      {rows.map(([label, value, numeric, pill]) => (
        <div key={label} className="flex justify-between gap-4 px-3.5 py-2.5 text-label">
          <dt className="text-ink-soft shrink-0">{label}</dt>
          <dd className={`text-right ${numeric ? "readout" : ""} ${pill ? "text-pill font-semibold" : ""}`} data-numeric>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function total(rates: ReadonlyMap<Category, Rate> | undefined): Rate | undefined {
  if (!rates) return undefined;
  let answered = 0;
  let correct = 0;
  for (const rate of rates.values()) {
    answered += rate.answered;
    correct += rate.correct;
  }
  return { answered, correct };
}

/** Úspěšnost se ukazuje až od deseti odpovědí; méně by jen mátlo. */
function formatRate(rate: Rate | undefined): string {
  if (!rate || rate.answered < MASTERY_MIN_ANSWERS) return "—";
  return `${Math.round((rate.correct / rate.answered) * 100)} %`;
}

/** Potvrzení odeslané výzvy. Zmizí samo; na nic se nečeká. */
export function SentNotice({ handle, onDone }: { handle: string; onDone: () => void }) {
  const t = useTranslations("social");
  const done = useEffectEvent(() => onDone());
  useEffect(() => {
    const timer = window.setTimeout(done, 2600);
    return () => window.clearTimeout(timer);
  }, [handle]);
  return (
    <div
      role="status"
      className="animate-rise pointer-events-none fixed inset-x-0 z-50 flex justify-center px-5"
      style={{ bottom: "calc(var(--sa-b) + 1.25rem)" }}
    >
      <p className="bg-ink flex items-center gap-2.5 rounded-full py-2.5 pr-4 pl-2.5 text-label font-medium text-white shadow-lg">
        <Monogram handle={handle} size="sm" />
        {t("challengeSent", { handle })}
      </p>
    </div>
  );
}
