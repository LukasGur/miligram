"use client";

import { useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HINT_COST, REPAIR_COST, rewardForLesson } from "@/core/economy";
import { lessonExercise, planLesson, type LessonPlan } from "@/core/lesson";
import { recordLesson, spendPills } from "@/lib/db";
import { recordDuelResult } from "@/lib/remote";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useProfile } from "@/lib/useProfile";
import { ExerciseView } from "./ExerciseView";

type Answered = {
  templateId: string;
  seed: string;
  difficulty: number;
  correct: boolean;
  hinted: boolean;
  repaired: boolean;
};

/**
 * Průběh lekce.
 *
 * Drží jen pořadové číslo a seznam výsledků. Zadání se nikam neukládá —
 * příklad je určený dvojicí (šablona, semínko), takže se dá kdykoli
 * sestavit znovu ze samotného identifikátoru lekce.
 */
export function LessonView({
  lessonId,
  plan: given,
  duelId,
  onExit,
}: {
  lessonId: string;
  /**
   * Hotový plán z tréninku nebo opakování chyb. Bez něj se sestaví
   * denní lekce z identifikátoru.
   */
  plan?: LessonPlan;
  /** Je-li vyplněné, hlásí se po dokončení výsledek do souboje. */
  duelId?: string;
  onExit: () => void;
}) {
  const plan = useMemo(() => given ?? planLesson(lessonId), [given, lessonId]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const { profile } = useProfile();
  const { session } = useSession();
  /**
   * Zápis se smí provést jen jednou. Vykreslení se opakovat může,
   * a v ostrém režimu React některé části schválně spouští dvakrát —
   * lekce připsaná dvakrát by uživateli nadělila dvojnásobek prášků.
   */
  const recorded = useRef(false);

  const exercise = useMemo(
    () => (index < plan.items.length ? lessonExercise(plan, index) : null),
    [plan, index],
  );

  if (exercise === null) {
    return <LessonSummary answers={answers} onExit={onExit} />;
  }

  return (
    <ExerciseView
      /**
       * Klíč vynutí novou instanci pro každý příklad. Rozepsaná odpověď,
       * verdikt i odrolování se tím vynulují samy — bez efektu, který by
       * stav uklízel ručně.
       */
      key={`${exercise.templateId}:${exercise.seed}`}
      exercise={exercise}
      index={index}
      count={plan.items.length}
      pills={profile.pills}
      onExit={onExit}
      onHint={() => spendPills(HINT_COST, `hint:${exercise.templateId}`)}
      onRepair={() => spendPills(REPAIR_COST, `repair:${exercise.templateId}`)}
      onAnswered={({ correct, hinted, repaired }) => {
        const answered: Answered[] = [
          ...answers,
          {
            templateId: exercise.templateId,
            seed: exercise.seed,
            difficulty: exercise.difficulty,
            correct,
            hinted,
            repaired,
          },
        ];
        setAnswers(answered);
        setIndex(index + 1);

        // Poslední odpověď lekci uzavírá. Zapisuje se tady, v obsluze
        // události, ne při vykreslení shrnutí — událost nastane jednou.
        if (answered.length === plan.items.length && !recorded.current) {
          recorded.current = true;
          const reward = rewardForLesson(answered.map((item) => item.correct));
          void recordLesson({ lessonId, answers: answered, reward });

          // Výsledek souboje jde rovnou na server. Do fronty nepatří:
          // bez připojení nemá souboj koho porovnávat a čekající výzva
          // je srozumitelnější než výsledek, který dorazí za tři dny.
          const client = supabase();
          const userId = session?.user.id;
          if (duelId && client && userId) {
            void recordDuelResult(client, duelId, userId, reward.correct, reward.count).catch(() => {});
          }
        }
      }}
    />
  );
}

function LessonSummary({
  answers,
  onExit,
}: {
  answers: readonly Answered[];
  onExit: () => void;
}) {
  const t = useTranslations("lesson");
  const tHome = useTranslations("home");
  const format = useFormatter();
  const reward = useMemo(() => rewardForLesson(answers.map((answer) => answer.correct)), [answers]);

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <div className="scroll-y flex-1">
        <div
          className="mx-auto flex w-full max-w-md flex-col justify-center px-5"
          style={{ paddingTop: "calc(var(--sa-t) + 3rem)" }}
        >
          <h1 className="text-title font-semibold">{t("summaryTitle")}</h1>

          <p className="num text-display mt-6 font-semibold" data-numeric>
            {t("summaryScore", { correct: reward.correct, count: reward.count })}
          </p>

          {reward.flawless ? (
            <p className="text-accent mt-2 text-heading font-semibold">{t("summaryPerfect")}</p>
          ) : null}

          <dl className="border-line divide-line mt-8 grid grid-cols-2 divide-x border-y py-4">
            <div className="pr-3">
              <dt className="text-ink-soft text-micro">{tHome("xp")}</dt>
              <dd className="num mt-0.5 text-title font-semibold">+{format.number(reward.xp)}</dd>
            </div>
            <div className="pl-3">
              <dt className="text-ink-soft text-micro">{tHome("pills")}</dt>
              <dd className="num text-pill mt-0.5 text-title font-semibold">+{format.number(reward.pills)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div
        className="bg-paper border-line shrink-0 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          <button
            type="button"
            onClick={onExit}
            className="bg-accent active:bg-accent-press min-h-14 w-full rounded-control text-body font-semibold text-white transition-colors duration-75"
          >
            {t("home")}
          </button>
        </div>
      </div>
    </div>
  );
}
