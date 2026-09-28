"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Monogram } from "@/components/ui/Monogram";
import { duelDecision, duelPills, type DuelMark } from "@/core/duel";
import { DIFFICULTY_RAMP } from "@/core/lessonPlan";
import { categoryOfId } from "@/core/templateCategories";
import type { Category } from "@/core/types";
import { markDuelSeen } from "@/lib/duelSeen";
import type { Duel } from "@/lib/remote";
import { outcomeFor } from "@/lib/social";
import { PrimaryButton, Screen, TextButton } from "./Screen";

/**
 * Odhalení výsledku.
 *
 * Moment, kvůli kterému se souboj hraje. Řádky se odkrývají po jednom,
 * příklad vedle příkladu. Příklad bez bodu je šedý obrys, ne červená —
 * tady nejde o chybu v tvém výpočtu, ale o srovnání. Nápověda má značku N
 * jen u tebe; soupeř ji vidí jako „bez bodu“, ať si nikdo nebojí v souboji
 * nechat poradit.
 */
export function DuelReveal({
  duel,
  userId,
  myHandle,
  onBack,
  onRematch,
}: {
  duel: Duel;
  userId: string;
  myHandle: string;
  onBack: () => void;
  onRematch?: () => void;
}) {
  const t = useTranslations("social");
  const tCategory = useTranslations("categories");
  const format = useFormatter();
  const outcome = outcomeFor(userId, duel);
  // Kdo výsledek viděl tady, tomu ho profil znovu neoznamuje.
  useEffect(() => {
    if (outcome !== null) markDuelSeen(userId, duel.id);
  }, [outcome, userId, duel.id]);
  const categories = useItemCategories(duel);
  const count = duel.mine?.count ?? duel.theirs?.count ?? 7;
  const pills = outcome ? duelPills(outcome, duel.mine) : 0;
  // Rozhodla chyba v lehčím příkladu? Jen když se klient se serverem
  // shodne; u rozcházející se starší verze platí serverův výsledek beze slov.
  const decision = duel.mine && duel.theirs && !duel.forfeit ? duelDecision(duel.mine, duel.theirs) : null;
  const decisive = decision?.outcome === outcome ? decision?.decisive : undefined;
  const flawless = outcome === "draw" && !duel.forfeit && duel.mine != null && duel.mine.points === duel.mine.count;

  const verdict =
    outcome === null
      ? t("revealWaiting", { handle: duel.opponentHandle })
      : duel.forfeit
        ? t(`revealForfeit.${outcome === "won" ? "won" : "lost"}`)
        : decisive
          ? t(`revealByMiss.${outcome === "won" ? "won" : "lost"}`)
          : flawless
            ? t("revealFlawless")
            : t(`revealVerdict.${outcome}`);

  return (
    <Screen
      title={t("revealTitle", { topic: duel.topic === "mix" ? t("topicMix") : tCategory(duel.topic) })}
      onBack={onBack}
      footer={
        outcome !== null && onRematch ? (
          <>
            <PrimaryButton onClick={onRematch}>{t("rematch")}</PrimaryButton>
            <TextButton className="mt-1 w-full" onClick={onBack}>
              {t("done")}
            </TextButton>
          </>
        ) : undefined
      }
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-2 pb-5">
        <Side handle={myHandle} label={t("you")} points={duel.mine?.points} win={outcome === "won"} />
        <span className="readout text-ink-soft pt-8 text-[1.75rem]">:</span>
        <Side
          handle={duel.opponentHandle}
          label={duel.opponentHandle}
          points={duel.theirs?.points}
          win={outcome === "lost"}
          sealed={duel.theirs === null && duel.playedByThem}
        />
      </div>

      <p
        className={`flex items-center justify-center gap-2 rounded-control px-3 py-2.5 text-center text-body font-semibold ${
          outcome === "won" ? "bg-accent-wash text-accent" : "bg-surface text-ink"
        }`}
        data-numeric
      >
        {verdict}
        {pills > 0 ? <span className="readout text-pill">+{format.number(pills)}</span> : null}
      </p>

      <div className="border-line mt-4 overflow-hidden rounded-panel border">
        <div className="bg-surface grid min-h-9 grid-cols-[1.75rem_1fr_4rem_4rem] items-center px-3">
          <span />
          <span className="panel-label">{t("revealItem")}</span>
          <span className="panel-label text-center">{t("you")}</span>
          <span className="panel-label truncate text-center">{duel.opponentHandle}</span>
        </div>
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="border-line reveal-row grid min-h-11 grid-cols-[1.75rem_1fr_4rem_4rem] items-center border-t px-3"
            style={{ animationDelay: `${150 + index * 180}ms` }}
          >
            <span className="readout text-ink-soft text-micro" data-numeric>
              {index + 1}
            </span>
            {decisive?.index === index ? (
              <span className="text-ink truncate text-label font-semibold">
                {t("revealDecisive", { difficulty: t(`difficulty.${decisive.difficulty}`) })}
              </span>
            ) : (
              <span className="text-ink-soft truncate text-label">
                {duel.topic !== "mix"
                  ? t(`difficulty.${DIFFICULTY_RAMP[index % DIFFICULTY_RAMP.length]}`)
                  : categories?.[index]
                    ? tCategory(categories[index])
                    : " "}
              </span>
            )}
            <Mark mark={duel.mine?.items?.[index]} decisive={decisive?.index === index && decisive.mine} />
            <Mark
              mark={sealHint(duel.theirs?.items?.[index])}
              decisive={decisive?.index === index && !decisive.mine}
            />
          </div>
        ))}
      </div>

      <p className="text-ink-soft mt-3 flex flex-wrap gap-x-4 gap-y-1 text-micro">
        <span className="flex items-center gap-1.5">
          <Mark mark="ok" small /> {t("legendOk")}
        </span>
        <span className="flex items-center gap-1.5">
          <Mark mark="miss" small /> {t("legendMiss")}
        </span>
        {duel.mine?.items?.includes("hint") ? (
          <span className="flex items-center gap-1.5">
            <Mark mark="hint" small /> {t("legendHint")}
          </span>
        ) : null}
      </p>
    </Screen>
  );
}

function Side({
  handle,
  label,
  points,
  win,
  sealed = false,
}: {
  handle: string;
  label: string;
  points: number | undefined;
  win: boolean;
  sealed?: boolean;
}) {
  const format = useFormatter();
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <Monogram handle={handle} />
      <span className="w-full truncate text-label font-semibold">{label}</span>
      <span
        className={`readout text-[2.75rem] leading-none font-semibold tracking-tight ${win ? "text-accent" : ""} ${
          points === undefined ? "text-ink-soft/40" : ""
        }`}
        data-numeric
      >
        {points === undefined ? (sealed ? "?" : "–") : format.number(points)}
      </span>
    </div>
  );
}

function Mark({
  mark,
  small = false,
  decisive = false,
}: {
  mark: DuelMark | undefined;
  small?: boolean;
  /** Příklad, který rozhodl shodu bodů. Obrys zesílí, barva zůstane. */
  decisive?: boolean;
}) {
  const box = small ? "size-4 rounded-[3px] text-[0.5625rem]" : "size-[1.375rem] rounded-[5px] text-[0.6875rem]";
  const wrap = small ? "inline-flex" : "flex justify-center";
  if (mark === undefined) return <span className={wrap}><span className={`${box} bg-surface`} /></span>;
  return (
    <span className={wrap}>
      {mark === "ok" ? (
        <span className={`${box} bg-accent grid place-items-center text-white`}>
          <svg viewBox="0 0 24 24" className="size-[70%]" aria-hidden>
            <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : mark === "hint" ? (
        <span className={`${box} bg-pill-wash text-pill readout grid place-items-center font-semibold`}>N</span>
      ) : (
        <span className={`${box} ${decisive ? "border-ink border-2" : "border-ink-soft/40 border-[1.5px]"}`} />
      )}
    </span>
  );
}

/** Nápověda soupeře se ukazuje jen jako příklad bez bodu. */
function sealHint(mark: DuelMark | undefined): DuelMark | undefined {
  return mark === "hint" ? "miss" : mark;
}

/**
 * Kategorie příkladů souboje. Plán se sestaví z identifikátoru stejně jako
 * v lekci; modul s šablonami je velký, a tak se dotahuje až tady.
 */
function useItemCategories(duel: Duel): (Category | null)[] | undefined {
  const [categories, setCategories] = useState<(Category | null)[]>();
  useEffect(() => {
    let cancelled = false;
    void import("@/core/lesson").then(({ planDuelLesson }) => {
      if (cancelled) return;
      const plan = planDuelLesson(duel.lessonId, duel.topic);
      setCategories(plan.items.map((item) => categoryOfId(item.templateId)));
    });
    return () => {
      cancelled = true;
    };
  }, [duel.lessonId, duel.topic]);
  return categories;
}
