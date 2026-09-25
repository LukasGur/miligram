"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, type Ref } from "react";
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
import { Wallet } from "@/components/ui/Wallet";
import { chime } from "@/lib/sound";
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
  /** Zůstatek před odměnou. Shrnutí z něj přičítá, co přiletí. */
  const [walletBefore, setWalletBefore] = useState<number>();

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
      pills={profile.pills}
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
          setWalletBefore(profile.pills);
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
 * Pastilky mají u čísla svou ikonu a z ní vyletí do peněženky.
 */
function Award({
  label,
  value,
  pastille,
  iconRef,
}: {
  label: string;
  value: number;
  pastille?: boolean;
  iconRef?: Ref<SVGSVGElement>;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="panel-label">{label}</dt>
      <dd className={`flex items-center gap-1.5 text-title font-semibold ${pastille ? "text-pill" : ""}`}>
        <Tally value={value} prefix="+" />
        {pastille ? <Pastille ref={iconRef} className="size-7 shrink-0" /> : null}
      </dd>
    </div>
  );
}

/** Jedna pastilka v letu: dráha a kdy vyrazí. */
type Flight = { id: number; from: DOMRect; to: DOMRect; delay: number };

/**
 * Pastilka letí obloukem z řádku odměny do peněženky. Letí nad vším
 * a mimo tok stránky, takže nic neodsune; po dopadu zmizí.
 */
function Flyer({ flight, onLand }: { flight: Flight; onLand: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const land = useEffectEvent(onLand);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { from, to, delay, id } = flight;
    const x0 = from.left + from.width / 2 - 12;
    const y0 = from.top + from.height / 2 - 12;
    const x1 = to.left + to.width / 2 - 12;
    const y1 = to.top + to.height / 2 - 12;
    // Střídavě vlevo a vpravo od přímky, ať pastilky neletí v zástupu.
    const bend = id % 2 ? 36 : -28;
    const animation = el.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
        {
          transform: `translate(${(x0 + x1) / 2 + bend}px, ${Math.min(y0, y1) + (y0 - y1) * 0.35}px) scale(1.15)`,
          opacity: 1,
          offset: 0.45,
        },
        { transform: `translate(${x1}px, ${y1}px) scale(0.9)`, opacity: 1 },
      ],
      { duration: 620, delay, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "both" },
    );
    animation.onfinish = () => land();
    return () => animation.cancel();
  }, [flight]);

  return (
    <span ref={ref} className="pointer-events-none fixed top-0 left-0 z-10 size-6" aria-hidden>
      <Pastille className="size-6" />
    </span>
  );
}

/** Kolik pastilek nese jedna letící. Víc letících by splynulo v šmouhu. */
const PER_FLYER = PILLS_PER_CORRECT;

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

  const walletRef = useRef<HTMLElement>(null);
  const targetRef = useRef<SVGSVGElement>(null);
  const earnedRef = useRef<SVGSVGElement>(null);
  const bonusRef = useRef<SVGSVGElement>(null);
  const [landed, setLanded] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);

  const animate = walletBefore !== undefined && reward.pills > 0;
  const shown = walletBefore === undefined ? profile.pills : walletBefore + Math.min(landed, reward.pills);

  useEffect(() => {
    if (!animate) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Nejdřív doběhnou čísla v řádcích, pak se pastilky vydají na cestu.
    // Bonus letí druhou vlnou, ať je vidět, že je navíc. Bez pohybu se
    // jen přepíše zůstatek.
    const timer = window.setTimeout(() => {
      if (still) {
        setLanded(reward.pills);
        return;
      }
      const to = targetRef.current?.getBoundingClientRect();
      if (!to) return;
      const waves: Flight[] = [];
      let id = 0;
      const wave = (source: SVGSVGElement | null, amount: number, start: number) => {
        const from = source?.getBoundingClientRect();
        if (!from) return;
        for (let i = 0; i < Math.ceil(amount / PER_FLYER); i++) {
          waves.push({ id: id++, from, to, delay: start + i * 70 });
        }
      };
      wave(earnedRef.current, earned, 0);
      wave(bonusRef.current, bonus, Math.ceil(earned / PER_FLYER) * 70 + 450);
      setFlights(waves);
    }, still ? 0 : 800);
    return () => window.clearTimeout(timer);
  }, [animate, reward.pills, earned, bonus]);

  function onLand(index: number) {
    setFlights((all) => all.filter((flight) => flight.id !== index));
    setLanded((value) => value + PER_FLYER);
    chime(index);
    walletRef.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }],
      { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <header
        className="app-chrome flex shrink-0 justify-end px-5 pb-2"
        style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
      >
        <div className="mx-auto flex w-full max-w-md justify-end">
          <Wallet
            ref={walletRef}
            iconRef={targetRef}
            value={format.number(shown)}
            label={t("walletAfter", { count: walletBefore === undefined ? profile.pills : walletBefore + reward.pills })}
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
            <Award label={tHome("pills")} value={earned} pastille iconRef={earnedRef} />
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
