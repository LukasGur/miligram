"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckIcon, ChevronDownIcon, CloseIcon, VersusIcon } from "@/components/icons";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Monogram } from "@/components/ui/Monogram";
import { Pastille } from "@/components/ui/Pastille";
import { MASTERY_MIN_ANSWERS } from "@/core/curriculum";
import { DIFFICULTY_RAMP, newLessonId } from "@/core/lessonPlan";
import { DUEL_WIN_PILLS, type DuelTopic } from "@/core/duel";
import { CATEGORIES, type Category } from "@/core/types";
import { categoryScores, lastTrainedCategory } from "@/lib/curriculum";
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
 * Téma je pole s konkrétní kategorií, kterou student zná (z lekce, z odvety,
 * jinak naposledy trénovanou), a stejné téma nese hlavní tlačítko:
 * „Vyzvat · Ředění“. Předvybraný Mix se přehlížel — vypadal jako výchozí
 * nastavení, které se nechá být. Konkrétní téma vyvolá otázku „chci
 * zrovna tohle?“ a kdo chce jiné, hledá, kde ho změnit. Mix je proto
 * v nabídce až poslední. Podmínky jsou shrnuté na řádek a celé pod odkazem — pořád žádné
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
  const [chosen, setChosen] = useState<DuelTopic | undefined>(presetTopic);
  // Bez tématu z kontextu naposledy trénované; kdo nic nehrál, základ.
  // Undefined jen na okamžik, než odpoví místní databáze.
  const recent = useLiveQuery(() => lastTrainedCategory(), []);
  const topic: DuelTopic | undefined = chosen ?? (recent === undefined ? undefined : (recent ?? CATEGORIES[0]));
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
    if (!friend || !topic || busy || open) return;
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

          <TopicField
            topic={topic}
            onSelect={setChosen}
            rates={mine}
          />

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
            disabled={!friend || !topic || busy || open}
            className="bg-accent active:bg-accent-press flex min-h-14 w-full items-center justify-center gap-2 rounded-control text-body font-semibold text-white transition-colors duration-75 disabled:opacity-40"
          >
            <VersusIcon className="size-5 shrink-0" />
            <span className="truncate">
              {topic ? t("challengeTopic", { topic: topic === "mix" ? t("topicMix") : tCategory(topic) }) : t("challengeAndPlay")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void create(false)}
            disabled={!friend || !topic || busy || open}
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

/** Mix až na konec: předvybírá se konkrétní téma, mix je volba navíc. */
const TOPIC_ORDER: readonly DuelTopic[] = [...CATEGORIES, "mix"];

/**
 * Téma jako pole formuláře: popisek nad ním, rámeček, ikona, název tučně
 * a vpravo „Změnit“ se šipkou. Rozbalí se do mřížky všech témat přímo
 * v listu, u každého tvoje úspěšnost napoprvé (vidíš ji jen ty).
 */
function TopicField({
  topic,
  onSelect,
  rates,
}: {
  topic: DuelTopic | undefined;
  onSelect: (topic: DuelTopic) => void;
  rates: ReadonlyMap<Category, Rate> | undefined;
}) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  const [open, setOpen] = useState(false);
  const name = (value: DuelTopic) => (value === "mix" ? t("topicMixLong") : tCategory(value));

  return (
    <div className="mt-5">
      <p className="panel-label mb-2">{t("pickTopic")}</p>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`active:bg-surface flex min-h-14 w-full items-center gap-3 rounded-control border px-3.5 text-left transition-colors duration-150 ${
          open ? "border-accent shadow-[inset_0_0_0_1px_var(--color-accent)]" : "border-ink-soft/40"
        }`}
      >
        <span className="bg-accent-wash text-accent grid size-8 shrink-0 place-items-center rounded-full">
          {topic && topic !== "mix" ? <CategoryIcon category={topic} className="size-[1.125rem]" /> : <MixGlyph />}
        </span>
        <span className="min-w-0 flex-1 truncate text-body font-semibold">{topic ? name(topic) : "\u00a0"}</span>
        <span className="text-accent flex shrink-0 items-center gap-1 text-label font-medium">
          {t("topicChange")}
          <ChevronDownIcon className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open ? (
        <div className="animate-rise mt-2">
          <div className="grid grid-cols-2 gap-2">
            {TOPIC_ORDER.map((value) => {
              const active = value === topic;
              const mix = value === "mix";
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    onSelect(value);
                    setOpen(false);
                  }}
                  aria-pressed={active}
                  className={`relative flex min-h-14 items-center gap-2.5 rounded-control border px-3 py-2 text-left ${
                    mix ? "col-span-2" : ""
                  } ${active ? "border-accent bg-accent-wash shadow-[inset_0_0_0_1px_var(--color-accent)]" : "border-line active:bg-surface"}`}
                >
                  <span className={active ? "text-accent" : "text-ink-soft"}>
                    {mix ? <MixGlyph /> : <CategoryIcon category={value} className="size-[1.125rem]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-label leading-snug font-semibold">{name(value)}</span>
                    <span className="readout text-ink-soft block text-micro" data-numeric>
                      {formatRate(mix ? total(rates) : rates?.get(value))}
                    </span>
                  </span>
                  {active ? <CheckIcon className="text-accent size-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
          <p className="text-ink-soft mt-2 text-micro" data-numeric>
            {t("rateNote", { min: MASTERY_MIN_ANSWERS })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Mix: čtyři tečky, jako čtyři kategorie v jedné lekci. */
function MixGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-[1.125rem]">
      <g fill="currentColor">
        <circle cx="7.5" cy="7.5" r="2.25" />
        <circle cx="16.5" cy="7.5" r="2.25" />
        <circle cx="7.5" cy="16.5" r="2.25" />
        <circle cx="16.5" cy="16.5" r="2.25" />
      </g>
    </svg>
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
