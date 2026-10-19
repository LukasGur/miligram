"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import { Balance } from "@/components/ui/Balance";
import { Flyer, bump, reducedMotion, type Flight } from "@/components/ui/Flyer";
import { Monogram } from "@/components/ui/Monogram";
import { Pastille } from "@/components/ui/Pastille";
import { Tally } from "@/components/ui/Tally";
import { duelDecision, duelPills } from "@/core/duel";
import { db } from "@/lib/db";
import type { Duel } from "@/lib/remote";
import { outcomeFor } from "@/lib/social";
import { useProfile } from "@/lib/useProfile";
import { Button } from "@/components/ui/Button";

/** Po kolika pastilkách letí jedna. Víc než pět letících působí jako roj. */
const PER_FLYER = 5;

/**
 * Výsledek souboje, který se rozhodl bez tebe.
 *
 * Kdo dohrál první, dozví se výsledek až tady: jednou, při otevření
 * profilu, jako konec týdne. Výhra se slaví po přístrojovém — skóre
 * doběhne, kolem vítěze se dokreslí prstenec a pastilky odletí
 * do zůstatku. Prohra je tatáž obrazovka, jen tichá: skóre a věta,
 * odveta nabídnutá, ne vnucená.
 */
export function DuelOutcome({
  duel,
  userId,
  myHandle,
  position,
  onRematch,
  onDetail,
  onClose,
}: {
  duel: Duel;
  userId: string;
  myHandle: string;
  /** Pořadí mezi novými výsledky, když jich čeká víc. */
  position: { index: number; total: number };
  onRematch?: () => void;
  onDetail: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  const format = useFormatter();
  const outcome = outcomeFor(userId, duel) ?? "draw";
  const won = outcome === "won";
  const lost = outcome === "lost";

  const decision = duel.mine && duel.theirs && !duel.forfeit ? duelDecision(duel.mine, duel.theirs) : null;
  const decisive = decision?.outcome === outcome && decision.decisive !== undefined;
  const flawless = outcome === "draw" && !duel.forfeit && duel.mine != null && duel.mine.points === duel.mine.count;
  const kind = duel.forfeit ? "forfeit" : decisive ? "byMiss" : flawless ? "flawless" : "plain";

  const { amount, balance, shown, balanceRef, targetRef, sourceRef, flights, land } = useReward(duel, outcome);
  const more = position.index + 1 < position.total;
  const closeLabel = more ? t("outcomeNext", { index: position.index + 2, total: position.total }) : t("done");

  return (
    <div
      className="bg-paper fixed inset-0 z-40 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duel-outcome"
    >
      <header
        className="mx-auto flex min-h-11 w-full max-w-md items-center justify-between px-5"
        style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
      >
        <span className="panel-label" data-numeric>
          {position.total > 1 ? t("outcomeCounter", { index: position.index + 1, total: position.total }) : null}
        </span>
        {amount > 0 ? (
          <Balance
            ref={balanceRef}
            iconRef={targetRef}
            value={format.number(shown)}
            label={t("outcomeBalance", { count: balance })}
          />
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-7 text-center">
        <p className="panel-label animate-rise">
          {t("revealTitle", { topic: duel.topic === "mix" ? t("topicMix") : tCategory(duel.topic) })}
        </p>

        <div className="animate-rise mt-7 grid w-full grid-cols-[1fr_auto_1fr] items-end gap-3 [animation-delay:80ms]">
          <Side handle={myHandle} label={t("you")} points={duel.mine?.points} winner={won} dim={lost} />
          <span className="readout text-display text-ink-soft/50 font-semibold">:</span>
          <Side handle={duel.opponentHandle} label={duel.opponentHandle} points={duel.theirs?.points} winner={false} dim={won} />
        </div>

        <h2
          id="duel-outcome"
          className={`animate-rise mt-8 text-[1.75rem] leading-tight font-semibold tracking-tight text-balance [animation-delay:500ms] ${
            won ? "text-accent" : ""
          }`}
        >
          {kind === "flawless" ? t("outcomeHeadline.flawless") : t(`outcomeHeadline.${outcome}`)}
        </h2>
        <p className="animate-rise text-ink-soft mt-2 text-body text-balance [animation-delay:580ms]" data-numeric>
          {t(`outcomeBody.${kind}.${outcome}`, { handle: duel.opponentHandle, count: duel.mine?.count ?? 7 })}
        </p>

        {amount > 0 ? (
          <div className="animate-rise border-line bg-pill-wash/40 mt-7 flex min-h-13 w-full items-center gap-3 rounded-panel border px-4 [animation-delay:700ms]">
            <Pastille ref={sourceRef} className="size-6 shrink-0" />
            <span className="flex-1 text-left text-body font-medium">
              {t(`outcomeReward.${flawless ? "flawless" : outcome}`)}
            </span>
            <span className="text-pill text-heading font-semibold">
              <Tally value={amount} prefix="+" />
            </span>
          </div>
        ) : null}
      </div>

      <footer
        className="mx-auto w-full max-w-md px-5 pt-3"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        {lost ? (
          <>
            <Button className="w-full" onClick={onClose}>{more ? closeLabel : t("outcomeOk")}</Button>
            <div className="mt-1 grid grid-cols-2">
              {onRematch ? <Button variant="text" onClick={onRematch}>{t("rematch")}</Button> : <span />}
              <Button variant="text" onClick={onDetail}>{t("outcomeDetail")}</Button>
            </div>
          </>
        ) : (
          <>
            {onRematch ? (
              <Button className="w-full" onClick={onRematch}>{t("outcomeRematch")}</Button>
            ) : (
              <Button className="w-full" onClick={onClose}>{closeLabel}</Button>
            )}
            <div className="mt-1 grid grid-cols-2">
              <Button variant="text" onClick={onDetail}>{t("outcomeDetail")}</Button>
              {onRematch ? (
                <Button variant="text" tone="muted" onClick={onClose}>
                  {closeLabel}
                </Button>
              ) : (
                <span />
              )}
            </div>
          </>
        )}
      </footer>

      {flights.map((flight) => (
        <Flyer key={flight.id} flight={flight} onLand={() => land(flight.id)} />
      ))}
    </div>
  );
}

/**
 * Jedna strana souboje: monogram, jméno, skóre. Kolem vítěze se dokreslí
 * prstenec v akcentu; poražený ztichne jen skóre, člověk zůstává.
 */
function Side({
  handle,
  label,
  points,
  winner,
  dim,
}: {
  handle: string;
  label: string;
  points: number | undefined;
  winner: boolean;
  dim: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <span className="relative grid size-[6rem] place-items-center">
        <Monogram handle={handle} size="lg" />
        {winner ? (
          <svg viewBox="0 0 100 100" className="text-accent absolute inset-0 -rotate-90" aria-hidden>
            <circle
              className="ring-draw"
              cx="50"
              cy="50"
              r="47"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
            />
          </svg>
        ) : null}
      </span>
      <span className="mt-2 w-full truncate text-label font-semibold">{label}</span>
      <span
        className={`text-display mt-2 font-semibold ${winner ? "text-accent" : dim ? "text-ink-soft" : "text-ink"}`}
      >
        {points === undefined ? <span className="readout">–</span> : <Tally value={points} />}
      </span>
    </div>
  );
}

/**
 * Pastilky za souboj. Připsané už jsou (collectDuelRewards), tady jen
 * doletí do zůstatku: ten začne na hodnotě před výhrou a s každou
 * dopadlou pastilkou poskočí. Kolik se připsalo, ví záznam v databázi;
 * souboj rozhodnutý před vznikem profilu dal nulu a nic neletí.
 */
function useReward(duel: Duel, outcome: "won" | "lost" | "draw") {
  const { profile } = useProfile();
  const record = useLiveQuery(async () => (await db().duelRewards.get(duel.id)) ?? null, [duel.id]);
  const credited = record !== undefined && record !== null;
  const amount = credited ? record.pills : record === null ? duelPills(outcome, duel.mine) : 0;
  // Dokud se pastilky nepřipsaly, zůstatek je ještě ten starý.
  const balance = credited ? profile.pills : profile.pills + amount;
  const before = balance - amount;

  const balanceRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<SVGSVGElement>(null);
  const sourceRef = useRef<SVGSVGElement>(null);
  const [landed, setLanded] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);

  const ready = credited && amount > 0;
  useEffect(() => {
    if (!ready) return;
    const still = reducedMotion();
    // Nejdřív doběhne skóre a řádek s odměnou, pak pastilky odletí.
    const timer = window.setTimeout(
      () => {
        const from = sourceRef.current?.getBoundingClientRect();
        const to = targetRef.current?.getBoundingClientRect();
        if (still || !from || !to) {
          setLanded(amount);
          return;
        }
        setFlights(
          Array.from({ length: Math.ceil(amount / PER_FLYER) }, (_, id) => ({ id, from, to, delay: id * 90 })),
        );
      },
      still ? 0 : 1400,
    );
    return () => window.clearTimeout(timer);
  }, [ready, amount]);

  function land(id: number) {
    setFlights((all) => all.filter((flight) => flight.id !== id));
    setLanded((value) => Math.min(value + PER_FLYER, amount));
    bump(balanceRef.current);
  }

  return {
    amount,
    balance,
    shown: before + landed,
    balanceRef,
    targetRef,
    sourceRef,
    flights,
    land,
  };
}
