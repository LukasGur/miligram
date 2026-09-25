"use client";

import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HINT_COST, PILLS_PER_CORRECT, rewardForLesson } from "@/core/economy";
import { lessonExercise, resolvePlan, type LessonPlan } from "@/core/lesson";
import type { DailySpec } from "@/core/curriculum";
import { attemptsOn, firstTryOutcomes, nextIndex, solvedCount } from "@/core/lessonRun";
import { recordAnswer, recordLesson, spendPills, type LessonAttempt } from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import { HomeIcon, RepeatIcon } from "@/components/icons";
import { Numeral } from "@/components/ui/Numeral";
import { Pastille } from "@/components/ui/Pastille";
import { Balance } from "@/components/ui/Balance";
import { Flyer, bump, reducedMotion, type Flight } from "@/components/ui/Flyer";
import { chime, flourish } from "@/lib/sound";
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
  /** Zůstatek na konci posledního příkladu. Shrnutí k němu přičítá bonus. */
  const [walletBefore, setWalletBefore] = useState<number>();
  /**
   * Pastilky za příklad, které už student viděl doletět, ale databáze
   * je ještě nepotvrdila. Bez nich by další příklad na okamžik ukázal
   * zůstatek o dvě menší. Jakmile se zůstatek v profilu pohne, jsou
   * v něm a nečekají na nic.
   */
  const [pending, setPending] = useState(0);
  const [seenPills, setSeenPills] = useState(profile.pills);
  if (profile.pills !== seenPills) {
    setSeenPills(profile.pills);
    setPending(0);
  }

  const index = nextIndex(plan, attempts);
  /**
   * Kolikrát už student na tenhle příklad sáhl. Vrácený příklad dostane
   * jiná čísla, takže nestačí opsat správnou hodnotu z verdiktu.
   */
  const attempt = index === null ? 0 : attemptsOn(attempts, plan.items[index].seed);
  const exercise = useMemo(
    () => (index === null ? null : lessonExercise(plan, index, attempt)),
    [plan, index, attempt],
  );
  const solved = solvedCount(plan, attempts);

  if (index === null || exercise === null) {
    return (
      <LessonSummary
        outcomes={firstTryOutcomes(plan, attempts)}
        unsolved={plan.items.length - solved}
        walletBefore={walletBefore}
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
      key={exercise.seed}
      exercise={exercise}
      solved={solved}
      count={plan.items.length}
      /** Opakování: příklad, na kterém už student jednou pohořel. */
      repeat={attempt > 0}
      mistake={plan.items[index].origin === "mistake"}
      attempt={attempt + 1}
      pills={profile.pills + pending}
      onExit={onExit}
      onHint={() => spendPills(HINT_COST, `hint:${exercise.templateId}`)}
      onAnswered={({ correct, hinted, gaveUp }) => {
        // Semínko je identita položky v plánu, ne semínko zobrazeného
        // příkladu: to se u vráceného příkladu mění, aby přišla jiná čísla.
        const zapis: LessonAttempt = {
          templateId: exercise.templateId,
          seed: plan.items[index].seed,
          difficulty: exercise.difficulty,
          index,
          correct,
          hinted,
          ...(gaveUp ? { gaveUp: true } : {}),
        };
        const next = [...attempts, zapis];
        setAttempts(next);
        // Připíše se v recordAnswer; do té doby se drží v zobrazení.
        const credit = attempt === 0 && correct ? PILLS_PER_CORRECT : 0;
        setPending((value) => value + credit);

        // Zápis pokusu je samostatný od zápisu lekce: lekce se nemusí
        // dohrát, odpověď už padla.
        // Plán se ukládá i u denní lekce: sestavil se ze stavu, který se
        // během lekce mění, takže z předpisu by po návratu vyšel jiný.
        void recordAnswer(lessonId, zapis, {
          plan: spec || given ? plan : undefined,
          stageId: spec?.stage,
          duelId,
        });

        // Poslední vyřešený příklad lekci uzavírá. Zapisuje se tady,
        // v obsluze události, ne při vykreslení shrnutí — událost nastane
        // jednou.
        if (nextIndex(plan, next) === null && !recorded.current) {
          recorded.current = true;
          setWalletBefore(profile.pills + pending + credit);
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

/**
 * Řádek odměny. Číslo doběhne od nuly, ať je vidět, že něco přibylo.
 * Pastilky mají u čísla svou ikonu — z ní bonus vyletí do zůstatku.
 */
function Award({
  label,
  note,
  value,
  pastille,
  iconRef,
}: {
  label: string;
  note?: string;
  value: number;
  pastille?: boolean;
  iconRef?: Ref<SVGSVGElement>;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt>
        <span className="panel-label block">{label}</span>
        {note ? <span className="text-ink-soft block text-micro">{note}</span> : null}
      </dt>
      <dd className={`flex items-center gap-1.5 text-title font-semibold ${pastille ? "text-pill" : ""}`}>
        <Tally value={value} prefix="+" />
        {pastille ? <Pastille ref={iconRef} className="size-6 shrink-0" /> : null}
      </dd>
    </div>
  );
}

/** Kolik pastilek nese jedna letící. Víc letících by splynulo v šmouhu. */
const PER_FLYER = 2;

function LessonSummary({
  outcomes,
  unsolved,
  walletBefore,
  onExit,
  onAgain,
}: {
  /** Jak dopadl první pokus u každého příkladu. Odměna je z toho. */
  outcomes: readonly boolean[];
  /** Kolik příkladů student vzdal. Bez toho nedává denní cíl smysl. */
  unsolved: number;
  /**
   * Zůstatek těsně před připsáním odměny. Chybí u lekce, která se otevřela
   * už dohraná — tam se nic nepřipisuje a peněženka jen ukáže stav.
   */
  walletBefore?: number;
  onExit: () => void;
  onAgain: () => void;
}) {
  const t = useTranslations("lesson");
  const tHome = useTranslations("home");
  const format = useFormatter();
  const { profile } = useProfile();
  const reward = useMemo(() => rewardForLesson(outcomes), [outcomes]);
  const earned = reward.correct * PILLS_PER_CORRECT;
  const bonus = reward.pills - earned;

  const balanceRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<SVGSVGElement>(null);
  const bonusRef = useRef<SVGSVGElement>(null);
  const [landed, setLanded] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);

  // Pastilky za příklady už v zůstatku jsou, přiletí jen bonus.
  const animate = walletBefore !== undefined && bonus > 0;
  const shown = walletBefore === undefined ? profile.pills : walletBefore + Math.min(landed, bonus);

  useEffect(() => {
    if (!animate) return;
    const still = reducedMotion();
    // Nejdřív doběhnou čísla v řádcích, pak bonus odletí do zůstatku.
    const timer = window.setTimeout(
      () => {
        const from = bonusRef.current?.getBoundingClientRect();
        const to = targetRef.current?.getBoundingClientRect();
        if (still || !from || !to) {
          setLanded(bonus);
          return;
        }
        setFlights(
          Array.from({ length: Math.ceil(bonus / PER_FLYER) }, (_, id) => ({ id, from, to, delay: id * 80 })),
        );
      },
      still ? 0 : 800,
    );
    return () => window.clearTimeout(timer);
  }, [animate, bonus]);

  // Dopady se počítají stranou: dva ve stejném snímku by ze stavu
  // přečetly totéž a závěrečná tečka by nezazněla.
  const arrivals = useRef(0);
  function onLand(id: number) {
    arrivals.current += 1;
    const last = arrivals.current === Math.ceil(bonus / PER_FLYER);
    setFlights((all) => all.filter((flight) => flight.id !== id));
    setLanded((value) => value + PER_FLYER);
    chime(id);
    bump(balanceRef.current);
    if (last) window.setTimeout(flourish, 120);
  }

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <header
        className="app-chrome flex shrink-0 justify-end px-5 pb-2"
        style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
      >
        <div className="mx-auto flex w-full max-w-md justify-end">
          <Balance
            ref={balanceRef}
            iconRef={targetRef}
            value={format.number(shown)}
            label={t("balance", { count: walletBefore === undefined ? profile.pills : walletBefore + bonus })}
          />
        </div>
      </header>

      <main tabIndex={0} className="scroll-y flex-1">
        {/* Zpráva se drží ve středu, ne u horní hrany — jinak pod ní zůstane
            půl obrazovky prázdna. */}
        <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center px-5">
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
            <Award label={t("earnedDuring")} note={t("earnedDuringNote")} value={earned} pastille />
            {bonus > 0 ? (
              <Award label={t("flawlessBonus")} value={bonus} pastille iconRef={bonusRef} />
            ) : null}
          </dl>
        </div>
      </main>

      {flights.map((flight) => (
        <Flyer key={flight.id} flight={flight} onLand={() => onLand(flight.id)} />
      ))}

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
