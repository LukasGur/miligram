"use client";

import { useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HINT_COST, rewardForLesson } from "@/core/economy";
import { lessonExercise, resolvePlan, type LessonPlan } from "@/core/lesson";
import type { DailySpec } from "@/core/curriculum";
import { attemptsOn, firstTryOutcomes, nextIndex, solvedCount } from "@/core/lessonRun";
import { recordAnswer, recordLesson, spendPills, type LessonAttempt } from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import { HomeIcon, RepeatIcon } from "@/components/icons";
import { Numeral } from "@/components/ui/Numeral";
import { Tally } from "@/components/ui/Tally";
import { ExerciseView } from "./ExerciseView";

/**
 * Průběh lekce.
 *
 * Drží jen pořadové číslo a seznam výsledků. Zadání se nikam neukládá —
 * příklad je určený dvojicí (šablona, semínko), takže se dá kdykoli
 * sestavit znovu ze samotného identifikátoru lekce.
 *
 * Každá odpověď se zapisuje hned. Rozehraná lekce tím přežije odchod
 * z obrazovky i zavření aplikace a dá se v ní pokračovat.
 */
export function LessonView({
  lessonId,
  plan: given,
  spec,
  duelId,
  attempts: resumed,
  onExit,
  onAgain,
}: {
  lessonId: string;
  /** Hotový plán z tréninku, opakování chyb nebo rozehrané lekce. */
  plan?: LessonPlan;
  /**
   * Předpis denní lekce. Plán se z něj sestaví tady a hned se uloží
   * k rozehrané lekci, aby se po návratu předložily tytéž příklady.
   */
  spec?: DailySpec;
  /** Je-li vyplněné, hlásí se po dokončení výsledek do souboje. */
  duelId?: string;
  /** Pokusy z rozehrané lekce, na které se navazuje. */
  attempts?: readonly LessonAttempt[];
  onExit: () => void;
  /** Spustí další lekci rovnou ze shrnutí, bez návratu domů. */
  onAgain: () => void;
}) {
  const plan = useMemo(() => resolvePlan({ lessonId, plan: given, spec }), [given, spec, lessonId]);
  // Rozehraná lekce začíná tam, kde uživatel přestal. Pořadí se dopočítá
  // z pokusů, takže se nemusí ukládat vedle.
  const [attempts, setAttempts] = useState<LessonAttempt[]>([...(resumed ?? [])]);
  const { profile } = useProfile();
  /**
   * Zápis se smí provést jen jednou. Vykreslení se opakovat může,
   * a v ostrém režimu React některé části schválně spouští dvakrát —
   * lekce připsaná dvakrát by uživateli nadělila dvojnásobek prášků.
   */
  const recorded = useRef(false);

  const index = nextIndex(plan, attempts);
  const exercise = useMemo(
    () => (index === null ? null : lessonExercise(plan, index)),
    [plan, index],
  );
  const solved = solvedCount(plan, attempts);

  if (index === null || exercise === null) {
    return (
      <LessonSummary
        outcomes={firstTryOutcomes(plan, attempts)}
        unsolved={plan.items.length - solved}
        onExit={onExit}
        onAgain={onAgain}
      />
    );
  }

  return (
    <ExerciseView
      /**
       * Klíč vynutí novou instanci pro každý příklad. Rozepsaná odpověď,
       * verdikt i odrolování se tím vynulují samy — bez efektu, který by
       * stav uklízel ručně.
       */
      key={`${exercise.seed}:${attempts.length}`}
      exercise={exercise}
      solved={solved}
      count={plan.items.length}
      /** Opakování: příklad, na kterém už student jednou pohořel. */
      repeat={attemptsOn(attempts, exercise.seed) > 0}
      attempt={attemptsOn(attempts, exercise.seed) + 1}
      pills={profile.pills}
      onExit={onExit}
      onHint={() => spendPills(HINT_COST, `hint:${exercise.templateId}`)}
      onAnswered={({ correct, hinted, gaveUp }) => {
        const attempt: LessonAttempt = {
          templateId: exercise.templateId,
          seed: exercise.seed,
          difficulty: exercise.difficulty,
          index,
          correct,
          hinted,
          ...(gaveUp ? { gaveUp: true } : {}),
        };
        const next = [...attempts, attempt];
        setAttempts(next);

        // Zápis pokusu je samostatný od zápisu lekce: lekce se nemusí
        // dohrát, odpověď už padla.
        // Plán se ukládá i u denní lekce: sestavil se ze stavu, který se
        // během lekce mění, takže z předpisu by po návratu vyšel jiný.
        void recordAnswer(lessonId, attempt, {
          plan: spec || given ? plan : undefined,
          stageId: spec?.stage,
          duelId,
        });

        // Poslední vyřešený příklad lekci uzavírá. Zapisuje se tady,
        // v obsluze události, ne při vykreslení shrnutí — událost nastane
        // jednou.
        if (nextIndex(plan, next) === null && !recorded.current) {
          recorded.current = true;
          const outcomes = firstTryOutcomes(plan, next);
          const reward = rewardForLesson(outcomes);
          void recordLesson({
            lessonId,
            // Na server jde jeden záznam na příklad a v něm první pokus.
            // Opakování je na učení; kdyby se posílalo, přičetlo by XP.
            answers: plan.items.map((item, position) => ({
              templateId: item.templateId,
              seed: item.seed,
              difficulty: item.difficulty,
              correct: outcomes[position],
              hinted: next.some((one) => one.seed === item.seed && one.hinted),
            })),
            reward,
          });

          // Výsledek souboje jde rovnou na server. Do fronty nepatří:
          // bez připojení nemá souboj koho porovnávat a čekající výzva
          // je srozumitelnější než výsledek, který dorazí za tři dny.
          //
          // Klient Supabase se dotahuje až tady. Souboj je menšina lekcí
          // a 240 kB navíc by jinak čekalo na každou z nich.
          if (duelId) void reportDuel(duelId, reward.correct, reward.count);
        }
      }}
    />
  );
}

/** Nahlášení výsledku souboje. Tichý neúspěch: výzva zůstane nedohraná. */
async function reportDuel(duelId: string, correct: number, count: number): Promise<void> {
  try {
    const [{ supabase }, { recordDuelResult }] = await Promise.all([
      import("@/lib/supabase"),
      import("@/lib/remote"),
    ]);
    const client = supabase();
    if (!client) return;

    const { data } = await client.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    await recordDuelResult(client, duelId, userId, correct, count);
  } catch {
    // Bez sítě se výsledek nezapíše a souboj zůstane otevřený.
  }
}

/** Řádek odměny. Číslo doběhne od nuly, ať je vidět, že něco přibylo. */
function Award({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <dt className="panel-label">{label}</dt>
      <dd className="text-title font-semibold">
        <Tally value={value} prefix="+" />
      </dd>
    </div>
  );
}

function LessonSummary({
  outcomes,
  unsolved,
  onExit,
  onAgain,
}: {
  /** Jak dopadl první pokus u každého příkladu. Odměna je z toho. */
  outcomes: readonly boolean[];
  /** Kolik příkladů student vzdal. Bez toho nedává denní cíl smysl. */
  unsolved: number;
  onExit: () => void;
  onAgain: () => void;
}) {
  const t = useTranslations("lesson");
  const tHome = useTranslations("home");
  const format = useFormatter();
  const reward = useMemo(() => rewardForLesson(outcomes), [outcomes]);

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <main tabIndex={0} className="scroll-y flex-1">
        {/* Zpráva se drží ve středu, ne u horní hrany — jinak pod ní zůstane
            půl obrazovky prázdna. */}
        <div
          className="mx-auto flex h-full w-full max-w-md flex-col justify-center px-5"
          style={{ paddingTop: "var(--sa-t)" }}
        >
          <h1 className="panel-label">{t("summaryTitle")}</h1>

          <p className="readout text-display mt-3 font-semibold" data-numeric>
            <Numeral value={`${format.number(reward.correct)}/${format.number(reward.count)}`} />
          </p>
          <p className="panel-label mt-1">{t("summaryScoreLabel")}</p>

          {reward.flawless ? (
            <p className="text-accent mt-5 text-heading font-semibold">{t("summaryPerfect")}</p>
          ) : null}

          {unsolved > 0 ? (
            <p className="text-ink-soft mt-4 text-label" data-numeric>
              {t("summaryUnsolved", { count: unsolved })}
            </p>
          ) : null}

          <dl className="border-line divide-line mt-8 divide-y border-y">
            <Award label={tHome("xp")} value={reward.xp} />
            <Award label={tHome("pills")} value={reward.pills} />
          </dl>
        </div>
      </main>

      <footer
        className="bg-paper border-line shrink-0 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          <button
            type="button"
            onClick={onExit}
            className="bg-accent active:bg-accent-press flex min-h-14 w-full items-center justify-center gap-2 rounded-control text-body font-semibold text-white transition-colors duration-75"
          >
            <HomeIcon className="size-5" />
            {t("home")}
          </button>

          {/* Další lekce je tichá volba: po splněném cíli je správné odejít,
              ne hrát dál. */}
          <button
            type="button"
            onClick={onAgain}
            className="text-ink-soft mt-1 flex min-h-11 w-full items-center justify-center gap-2 text-label"
          >
            <RepeatIcon className="size-4" />
            {t("again")}
          </button>
        </div>
      </footer>
    </div>
  );
}
