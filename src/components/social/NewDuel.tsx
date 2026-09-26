"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import { Monogram } from "@/components/ui/Monogram";
import { MASTERY_MIN_ANSWERS } from "@/core/curriculum";
import { DIFFICULTY_RAMP } from "@/core/lessonPlan";
import { DUEL_TOPICS, DUEL_WIN_PILLS, type DuelTopic } from "@/core/duel";
import type { Category } from "@/core/types";
import { categoryScores } from "@/lib/curriculum";
import type { Duel, FriendSummary } from "@/lib/remote";
import type { Social } from "./data";
import { PrimaryButton, Screen, TextButton } from "./Screen";

type Rate = { answered: number; correct: number };

/**
 * Nová výzva.
 *
 * Téma se volí s daty: u každé kategorie tvoje úspěšnost napoprvé.
 * Soupeřova tu není — úspěšnost je soukromá (migrace 0012). Podmínky souboje stojí pod výběrem jako ordinace — žádné
 * překvapení, co se počítá.
 */
export function NewDuel({
  social,
  friendId: preset,
  topic: presetTopic,
  onBack,
  onCreate,
}: {
  social: Social;
  friendId?: string;
  topic?: DuelTopic;
  onBack: () => void;
  onCreate: (friend: FriendSummary, topic: DuelTopic, playNow: boolean) => Promise<"ok" | "open" | "refused">;
}) {
  const t = useTranslations("social");
  const friends = social.friends.data ?? [];
  const duels = social.duels.data ?? [];
  const [friendId, setFriendId] = useState<string | undefined>(preset);
  const [topic, setTopic] = useState<DuelTopic>(presetTopic ?? "mix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const friend = friends.find((one) => one.userId === friendId);
  const openWith = (id: string) => duels.some((duel) => duel.opponentId === id && (duel.status === "offered" || duel.status === "accepted"));

  const mine = useLiveQuery(() => categoryScores(), []);

  async function create(playNow: boolean) {
    if (!friend || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onCreate(friend, topic, playNow);
      if (result === "open") setError(t("errorOpenDuel", { handle: friend.handle }));
      if (result === "refused") setError(t("errorRefused"));
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title={friend ? t("challengeTitle", { handle: friend.handle }) : t("newDuel")}
      onBack={onBack}
      footer={
        <>
          {error || (friend && openWith(friend.userId)) ? (
            <p className="text-ink-soft mb-2 text-center text-label" role="status">
              {error ?? t("errorOpenDuel", { handle: friend?.handle ?? "" })}
            </p>
          ) : null}
          <PrimaryButton onClick={() => void create(true)} disabled={!friend || busy || openWith(friend.userId)}>
            {t("challengeAndPlay")}
          </PrimaryButton>
          <TextButton
            className="mt-1 w-full"
            onClick={() => {
              if (friend && !openWith(friend.userId)) void create(false);
            }}
          >
            {t("challengeOnly")}
          </TextButton>
        </>
      }
    >
      {!preset ? (
        <>
          <p className="panel-label mt-1 mb-2">{t("pickOpponent")}</p>
          {friends.length === 0 ? (
            <p className="text-ink-soft text-label">{t("noFriendsYet")}</p>
          ) : (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {friends.map((one) => {
                const busyPair = openWith(one.userId);
                const selected = one.userId === friendId;
                return (
                  <button
                    key={one.userId}
                    type="button"
                    disabled={busyPair}
                    onClick={() => setFriendId(one.userId)}
                    aria-pressed={selected}
                    className={`flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-control border px-1 py-2.5 disabled:opacity-45 ${
                      selected ? "border-accent bg-accent-wash" : "border-line"
                    }`}
                  >
                    <Monogram handle={one.handle} />
                    <span className="w-full truncate text-center text-micro font-medium">{one.handle}</span>
                    {busyPair ? <span className="text-ink-soft text-[0.625rem]">{t("duelRunning")}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      <p className="panel-label mt-5 mb-2">{t("pickTopic")}</p>
      <div className="grid grid-cols-2 gap-2">
        {DUEL_TOPICS.map((value) => (
          <TopicButton
            key={value}
            topic={value}
            selected={topic === value}
            onSelect={() => setTopic(value)}
            mine={value === "mix" ? total(mine) : mine?.get(value)}
          />
        ))}
      </div>
      <p className="text-ink-soft mt-2 text-micro" data-numeric>
        {t("rateNote", { min: MASTERY_MIN_ANSWERS })}
      </p>

      <Terms />
    </Screen>
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
        mix ? "col-span-2 min-h-13 flex-row items-center justify-between" : "min-h-15 flex-col justify-center"
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
    <dl className="border-line divide-line mt-6 divide-y rounded-panel border">
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

export type { Duel };
