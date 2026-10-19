"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CloseIcon, VersusIcon } from "@/components/icons";
import { Monogram } from "@/components/ui/Monogram";
import { Spinner } from "@/components/ui/Spinner";
import { canPlayDuel, duelDeadline, duelPhase } from "@/core/duel";
import { LESSON_LENGTH } from "@/core/lessonPlan";
import type { Duel } from "@/lib/remote";
import { useAction } from "@/lib/useAction";
import { DeadlineBar } from "./DeadlineBar";
import { useNow } from "./data";
import type { DuelActions } from "./DuelsScreen";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * Souboj, na který ukázala notifikace.
 *
 * Kdo klepne na „jana_k tě vyzývá“, chce vědět kdo, z čeho a do kdy —
 * a začít. List vyjede nad seznamem soubojů: po zavření je člověk tam,
 * kde výzvu najde znovu. Dvě tváře proti sobě říkají „souboj“ dřív
 * než jakýkoli text; téma, počet příkladů a lhůta stojí jako tři údaje
 * přístroje, stejně jako série a XP na domovské obrazovce.
 *
 * Ukazuje se jen u souboje, se kterým jde něco udělat: přijmout, nebo
 * hrát. Ostatní (čeká se na soupeře, propadlo) řekne seznam pod ním.
 */
export function DuelInviteSheet({
  duel,
  myHandle,
  actions,
  onClose,
}: {
  duel: Duel;
  myHandle: string;
  actions: Pick<DuelActions, "onPlay" | "onRespond">;
  onClose: () => void;
}) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  const format = useFormatter();
  const now = useNow();
  const action = useAction();
  const [pending, setPending] = useState<"accept" | "later" | "decline" | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const phase = duelPhase(duel);
  const incoming = phase === "incoming";
  const deadline = duelDeadline(duel);
  const topic = duel.topic === "mix" ? t("topicMix") : tCategory(duel.topic);
  const busy = action.busy;

  function run(which: NonNullable<typeof pending>, task: () => Promise<void>, close = false) {
    setPending(which);
    void action
      .run(async () => {
        await task();
        if (close) onClose();
      })
      .finally(() => setPending(null));
  }

  return (
    <BottomSheet
      onClose={onClose}
      scrimLabel={t("close")}
      labelledBy="duel-invite-title"
      initialFocus={closeRef}
      className="flex flex-col"
    >
      <div className="flex shrink-0 justify-end pt-1 pr-2">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="text-ink-soft flex size-11 items-center justify-center"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      <div className="scroll-y px-6" tabIndex={-1}>
        {/* Ty proti soupeři. Soupeř vpředu a větší: výzva je o něm. */}
        <div className="animate-rise flex items-center justify-center">
          <Monogram handle={myHandle} size="md" className="ring-paper -mr-2 ring-4" />
          <span className="bg-paper text-accent border-line relative z-10 grid size-9 place-items-center rounded-full border">
            <VersusIcon className="size-[1.125rem]" />
          </span>
          <Monogram handle={duel.opponentHandle} size="lg" className="ring-paper -ml-2 ring-4" />
        </div>

        <p className="panel-label animate-rise mt-5 text-center [animation-delay:60ms]">
          {t("duelInviteLabel")}
        </p>
        <h2
          id="duel-invite-title"
          className="animate-rise mt-1.5 text-center text-title leading-tight font-semibold text-balance [animation-delay:90ms]"
        >
          {incoming ? t("cardIncoming", { handle: duel.opponentHandle }) : t("duelInviteTurn", { handle: duel.opponentHandle })}
        </h2>

        <dl className="animate-rise border-line divide-line mt-6 grid grid-cols-[1.4fr_1fr] divide-x border-y [animation-delay:140ms]">
          <div className="min-w-0 py-3 pr-3">
            <dt className="panel-label">{t("duelInviteTopic")}</dt>
            <dd className="mt-1 truncate text-heading font-semibold">{topic}</dd>
          </div>
          <div className="py-3 pl-3">
            <dt className="panel-label">{t("duelInviteItems")}</dt>
            <dd className="readout mt-1 text-heading font-semibold" data-numeric>
              {format.number(LESSON_LENGTH)}
            </dd>
          </div>
        </dl>

        {deadline ? (
          <div className="animate-rise mt-4 [animation-delay:180ms]">
            <DeadlineBar
              deadline={deadline}
              now={now}
              label={duel.status === "offered" ? t("deadlineAccept") : t("deadlinePlay")}
            />
          </div>
        ) : null}

        <p className="animate-rise text-ink-soft mt-4 text-label text-pretty [animation-delay:220ms]">
          {duel.playedByThem ? t("duelInviteSealed", { handle: duel.opponentHandle }) : t("duelInviteFair")}
        </p>

        {action.failed ? (
          <p className="text-ink-soft mt-3 text-label" role="status">
            {t("errorNetwork")}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 px-6 pt-5" style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}>
        {incoming ? (
          <>
            <Button
              disabled={busy}
              onClick={() => run("accept", () => actions.onRespond(duel, true, true))}
              className="w-full"
            >
              {pending === "accept" ? <Spinner /> : <VersusIcon className="size-5" />}
              {t("acceptAndPlay")}
            </Button>
            <div className="mt-1 grid grid-cols-2">
              <Button
                disabled={busy}
                onClick={() => run("later", () => actions.onRespond(duel, true, false), true)}
                variant="text" className="gap-2"
              >
                {pending === "later" ? <Spinner className="size-4" /> : null}
                {t("duelInviteLater")}
              </Button>
              <Button
                disabled={busy}
                onClick={() => run("decline", () => actions.onRespond(duel, false, false), true)}
                variant="text" tone="muted" className="gap-2"
              >
                {pending === "decline" ? <Spinner className="size-4" /> : null}
                {t("decline")}
              </Button>
            </div>
          </>
        ) : canPlayDuel(duel) ? (
          <>
            <Button
              onClick={() => actions.onPlay(duel)}
              className="w-full"
            >
              <VersusIcon className="size-5" />
              {t("play")}
            </Button>
            <Button onClick={onClose} variant="text" tone="muted" className="mt-1 w-full">
              {t("duelInviteNotNow")}
            </Button>
          </>
        ) : null}
      </div>
    </BottomSheet>
  );
}
