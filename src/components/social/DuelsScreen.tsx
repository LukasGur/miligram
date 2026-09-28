"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronRightIcon } from "@/components/icons";
import { Monogram } from "@/components/ui/Monogram";
import { canPlayDuel, duelDeadline, duelPhase, duelPills, type DuelTopic } from "@/core/duel";
import type { Duel, DuelRecord } from "@/lib/remote";
import { outcomeFor } from "@/lib/social";
import { Spinner } from "@/components/ui/Spinner";
import { useAction } from "@/lib/useAction";
import { DeadlineBar } from "./DeadlineBar";
import { useNow } from "./data";
import { PrimaryButton, Screen, SecondaryButton } from "./Screen";

export type DuelActions = {
  onPlay: (duel: Duel) => void;
  onRespond: (duel: Duel, accept: boolean, play: boolean) => Promise<void>;
  onCancel: (duel: Duel) => Promise<void>;
  onReveal: (duel: Duel) => void;
  onNew: () => void;
};

/**
 * Souboje.
 *
 * Nahoře jen to, co chce akci uživatele; pod tím, co čeká na druhé; dole
 * historie. Otevřený souboj má hodiny 48 h jako dílky stupnice.
 * Odmítnuté a propadlé výzvy jsou šedé a do bilance nejdou.
 */
export function DuelsScreen({
  duels,
  record,
  userId,
  loading,
  onBack,
  actions,
}: {
  duels: readonly Duel[];
  record: DuelRecord | undefined;
  userId: string;
  loading: boolean;
  onBack: () => void;
  actions: DuelActions;
}) {
  const t = useTranslations("social");
  const now = useNow();

  const phased = duels.map((duel) => ({ duel, phase: duelPhase(duel) }));
  const mine = phased.filter(
    ({ duel, phase }) => phase === "incoming" || phase === "myTurn" || (phase === "outgoing" && !duel.playedByMe),
  );
  const theirs = phased.filter(
    ({ duel, phase }) => phase === "waiting" || (phase === "outgoing" && duel.playedByMe),
  );
  const done = phased.filter(({ phase }) => phase === "finished" || phase === "void").slice(0, 12);

  return (
    <Screen
      title={t("duelsTitle")}
      onBack={onBack}
      aside={
        record ? (
          <span className="readout text-ink-soft mr-2 text-label" data-numeric aria-label={t("recordLabel", { ...record })}>
            {record.wins}‑{record.losses}‑{record.draws}
          </span>
        ) : null
      }
      footer={<PrimaryButton onClick={actions.onNew}>{t("newDuel")}</PrimaryButton>}
    >
      {loading && duels.length === 0 ? (
        <p className="text-ink-soft mt-2 text-label">{t("loading")}</p>
      ) : duels.length === 0 ? (
        <Empty />
      ) : null}

      {mine.length > 0 ? (
        <>
          <p className="panel-label mt-2 mb-2">{t("groupMine")}</p>
          <div className="flex flex-col gap-2.5">
            {mine.map(({ duel, phase }) => (
              <ActionCard key={duel.id} duel={duel} phase={phase} now={now} actions={actions} />
            ))}
          </div>
        </>
      ) : null}

      {theirs.length > 0 ? (
        <>
          <p className="panel-label mt-7 mb-1">{t("groupTheirs")}</p>
          <ul>
            {theirs.map(({ duel }) => (
              <WaitingRow key={duel.id} duel={duel} now={now} />
            ))}
          </ul>
        </>
      ) : null}

      {done.length > 0 ? (
        <>
          <p className="panel-label mt-7 mb-1">{t("groupDone")}</p>
          <ul>
            {done.map(({ duel }) => (
              <DoneRow key={duel.id} duel={duel} userId={userId} onOpen={() => actions.onReveal(duel)} />
            ))}
          </ul>
        </>
      ) : null}

      <RulesNote />
    </Screen>
  );
}

function Empty() {
  const t = useTranslations("social");
  return (
    <div className="border-line mt-2 rounded-panel border border-dashed px-5 py-6 text-center">
      <p className="text-heading font-semibold">{t("duelsEmptyTitle")}</p>
      <p className="text-ink-soft mt-1.5 text-label">{t("duelsEmptyBody")}</p>
    </div>
  );
}

function TopicChip({ topic }: { topic: DuelTopic }) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  return (
    <span className="bg-surface text-ink-soft max-w-[55%] shrink-0 truncate rounded-[4px] px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-[0.04em] uppercase">
      {topic === "mix" ? t("topicMix") : tCategory(topic)}
    </span>
  );
}

function ActionCard({
  duel,
  phase,
  now,
  actions,
}: {
  duel: Duel;
  phase: ReturnType<typeof duelPhase>;
  now: number;
  actions: DuelActions;
}) {
  const t = useTranslations("social");
  const action = useAction();
  /** Které tlačítko běží — spinner patří jen na to, na které se klepnulo. */
  const [pending, setPending] = useState<"decline" | "accept" | "later" | "withdraw" | null>(null);
  const busy = action.busy;
  const deadline = duelDeadline(duel);
  const hot = phase === "incoming";

  function run(which: NonNullable<typeof pending>, task: () => Promise<void>) {
    setPending(which);
    void action.run(task).finally(() => setPending(null));
  }

  const title =
    phase === "incoming"
      ? t("cardIncoming", { handle: duel.opponentHandle })
      : phase === "myTurn"
        ? duel.opponentHandle
        : t("cardOutgoing", { handle: duel.opponentHandle });
  const subtitle =
    phase === "incoming"
      ? duel.playedByThem
        ? t("cardSealed")
        : t("cardNotPlayed")
      : phase === "myTurn"
        ? t("cardYourTurn")
        : t("cardNotAccepted");

  return (
    <article
      className={`bg-paper flex flex-col gap-3 rounded-panel border p-3.5 ${
        hot ? "border-accent shadow-[inset_0_0_0_1px_var(--color-accent)]" : "border-line"
      }`}
    >
      <div className="flex items-center gap-3">
        <Monogram handle={duel.opponentHandle} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold">{title}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-2">
            <TopicChip topic={duel.topic} />
            <span className="text-ink-soft truncate text-micro">{subtitle}</span>
          </p>
        </div>
      </div>

      {deadline ? (
        <DeadlineBar
          deadline={deadline}
          now={now}
          label={duel.status === "offered" ? t("deadlineAccept") : t("deadlinePlay")}
        />
      ) : null}

      {phase === "incoming" ? (
        <>
          <div className="flex gap-2">
            <SecondaryButton className="!w-auto flex-1" disabled={busy} onClick={() => run("decline", () => actions.onRespond(duel, false, false))}>
              {pending === "decline" ? <Spinner /> : null}
              {t("decline")}
            </SecondaryButton>
            <button
              type="button"
              disabled={busy}
              onClick={() => run("accept", () => actions.onRespond(duel, true, true))}
              className="bg-accent active:bg-accent-press flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-control text-body font-semibold text-white disabled:opacity-40"
            >
              {pending === "accept" ? <Spinner /> : null}
              {t("acceptAndPlay")}
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("later", () => actions.onRespond(duel, true, false))}
            className="text-accent -my-2 flex min-h-11 items-center gap-2 self-center text-label font-medium disabled:opacity-40"
          >
            {pending === "later" ? <Spinner className="size-4" /> : null}
            {t("acceptLater")}
          </button>
        </>
      ) : canPlayDuel(duel) ? (
        <div className="flex items-center gap-2">
          {/* Stáhnout je orámované tlačítko, ne šedý text — ten vypadal
              jako poznámka a nikdo na něj neklepl. */}
          {phase === "outgoing" ? (
            <SecondaryButton className="!w-auto flex-1" disabled={busy} onClick={() => run("withdraw", () => actions.onCancel(duel))}>
              {pending === "withdraw" ? <Spinner /> : null}
              {t("withdraw")}
            </SecondaryButton>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => actions.onPlay(duel)}
            className="bg-accent active:bg-accent-press min-h-12 flex-[2] rounded-control text-body font-semibold text-white disabled:opacity-40"
          >
            {t("play")}
          </button>
        </div>
      ) : null}

      {action.failed ? (
        <p className="text-ink-soft -mt-1 text-center text-label" role="status">
          {t("errorNetwork")}
        </p>
      ) : null}
    </article>
  );
}

function WaitingRow({ duel, now }: { duel: Duel; now: number }) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  const format = useFormatter();
  const deadline = duelDeadline(duel);
  const hours = deadline ? Math.max(Math.ceil((deadline.getTime() - now) / 3_600_000), 0) : 0;
  const topic = duel.topic === "mix" ? t("topicMix") : tCategory(duel.topic);

  return (
    <li className="border-line flex min-h-16 items-center gap-3 border-b py-2">
      <Monogram handle={duel.opponentHandle} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold">{duel.opponentHandle}</p>
        <p className="text-ink-soft truncate text-micro" data-numeric>
          {duel.status === "offered" ? t("waitAccept", { topic, hours }) : t("waitPlay", { topic, hours })}
        </p>
      </div>
      {duel.mine ? (
        <span className="text-ink-soft flex items-center gap-1.5 text-micro" title={t("sealedHint")}>
          <LockIcon className="size-3.5" />
          <span className="readout" data-numeric>
            {format.number(duel.mine.points)}/{format.number(duel.mine.count)}
          </span>
        </span>
      ) : null}
    </li>
  );
}

function DoneRow({ duel, userId, onOpen }: { duel: Duel; userId: string; onOpen: () => void }) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  const format = useFormatter();
  const outcome = outcomeFor(userId, duel);
  const topic = duel.topic === "mix" ? t("topicMix") : tCategory(duel.topic);

  if (outcome === null) {
    // Nepočítá se: odmítnuto, propadlo, nedohráno.
    return (
      <li className="border-line flex min-h-14 items-center gap-3 border-b py-2 opacity-60">
        <Monogram handle={duel.opponentHandle} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold">{t(`void.${duel.status}`, { handle: duel.opponentHandle })}</p>
          <p className="text-ink-soft text-micro">{t("voidNote")}</p>
        </div>
      </li>
    );
  }

  const pills = duelPills(outcome, duel.mine);
  return (
    <li>
      <button type="button" onClick={onOpen} className="border-line active:bg-surface flex min-h-16 w-full items-center gap-3 border-b py-2 text-left">
        <Monogram handle={duel.opponentHandle} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold">
            {t(`outcomeTitle.${outcome}`, { handle: duel.opponentHandle })}
          </p>
          <p className="text-ink-soft truncate text-micro">
            {duel.forfeit ? t("forfeitNote", { topic }) : topic}
          </p>
        </div>
        <span className="flex flex-col items-end">
          <span className="readout text-body font-semibold" data-numeric>
            {duel.mine ? format.number(duel.mine.points) : "–"} : {duel.theirs ? format.number(duel.theirs.points) : "–"}
          </span>
          {pills > 0 ? (
            <span className="readout text-pill text-micro font-semibold" data-numeric>
              +{format.number(pills)}
            </span>
          ) : null}
        </span>
        <ChevronRightIcon className="text-ink-soft size-5 shrink-0" />
      </button>
    </li>
  );
}

function RulesNote() {
  const t = useTranslations("social");
  return (
    <details className="border-line group mt-8 rounded-panel border px-4">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-label font-medium">
        {t("duelRulesTitle")}
        <ChevronRightIcon className="text-ink-soft size-5 transition-transform group-open:rotate-90" />
      </summary>
      <ul className="text-ink-soft -mt-1 flex list-disc flex-col gap-1.5 pb-4 pl-4 text-label">
        <li>{t("duelRule1")}</li>
        <li>{t("duelRule2")}</li>
        <li>{t("duelRule3")}</li>
        <li>{t("duelRule4")}</li>
        <li>{t("duelRule5")}</li>
      </ul>
    </details>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </g>
    </svg>
  );
}
