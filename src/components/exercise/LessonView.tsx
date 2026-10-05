"use client";

import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dynamic from "next/dynamic";
import { useFormatter, useTranslations } from "next-intl";
import { HINT_COST, PILLS_PER_CORRECT, rewardForLesson } from "@/core/economy";
import { lessonExercise, resolvePlan, type LessonPlan } from "@/core/lesson";
import { buildExercise } from "@/core/templates";
import type { LessonKind } from "@/core/scoring";
import type { DailySpec } from "@/core/curriculum";
import { attemptsOn, firstTryOutcomes, nextIndex, solvedCount } from "@/core/lessonRun";
import { duelScore, mainCategory, type DuelTopic } from "@/core/duel";
import { categoryOfId } from "@/core/templateCategories";
import type { PlayableDuel } from "@/components/account/AccountScreen";
import type { DuelResult } from "@/lib/remote";
import type { BadgeState } from "@/core/badges";
import { freshLocalBadges } from "@/lib/social";
import { BadgeGlyph } from "@/components/social/BadgeGlyph";
import { markGaveUp, markHelped, recordAnswer, recordLesson, spendPills, type LessonAttempt } from "@/lib/db";
import { templateFamiliarity } from "@/lib/learning";
import { streakFacts, useProfile } from "@/lib/useProfile";
import { HomeIcon, RepeatIcon, VersusIcon } from "@/components/icons";
import { Numeral } from "@/components/ui/Numeral";
import { Pastille } from "@/components/ui/Pastille";
import { Balance } from "@/components/ui/Balance";
import { Flyer, bump, reducedMotion, type Flight } from "@/components/ui/Flyer";
import { Tally } from "@/components/ui/Tally";
import { ExerciseView } from "./ExerciseView";
import { requestPersistentStorage } from "@/lib/pwa";

/**
 * Nabídka připomínek se dotahuje až ve shrnutí. Je v ní stav přihlášení,
 * tedy klient Supabase, a lekce sama ho nepotřebuje.
 */
const PushOffer = dynamic(() => import("@/components/push/PushOffer").then((module) => module.PushOffer), {
  ssr: false,
});

/** Výzva kamaráda ve shrnutí. Taky s klientem Supabase, a tak až tady. */
const LessonChallenge = dynamic(
  () => import("@/components/social/LessonChallenge").then((module) => module.LessonChallenge),
  { ssr: false },
);

/** Výzva k založení účtu; ptá se na přihlášení, a tak taky až tady. */
const SignUpNudge = dynamic(
  () => import("@/components/account/SignUpNudge").then((module) => module.SignUpNudge),
  { ssr: false },
);

/** Po lekci se nabízí souboj na totéž téma; jen přihlášenému. */
export type LessonChallengeProps = {
  handle: string;
  onPlay: (duel: PlayableDuel) => void;
  onInvite: () => void;
  onOpenDuels: () => void;
};

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
  helped: resumedHelped,
  onExit,
  onAgain,
  onDuelDone,
  challenge,
  onAccount,
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
  /** Semínka, u kterých už padla nápověda nebo vzor (src/lib/db.ts). */
  helped?: readonly string[];
  onExit: () => void;
  /** Spustí další lekci rovnou ze shrnutí, bez návratu domů. */
  onAgain: () => void;
  /** Po dohraném souboji: přejít rovnou k jeho výsledku. */
  onDuelDone?: (duelId: string) => void;
  challenge?: LessonChallengeProps;
  /** Otevře účet — z výzvy k registraci na konci lekce. */
  onAccount?: () => void;
}) {
  const plan = useMemo(() => resolvePlan({ lessonId, plan: given, spec }), [given, spec, lessonId]);
  // Rozehraná lekce začíná tam, kde uživatel přestal. Pořadí se dopočítá
  // z pokusů, takže se nemusí ukládat vedle.
  const [attempts, setAttempts] = useState<LessonAttempt[]>([...(resumed ?? [])]);
  /**
   * Vyhodnocená odpověď, u které student ještě neklepl na Pokračovat.
   * V databázi už je; do průběhu se přidá až s Pokračovat, aby příklad
   * i s verdiktem zůstal na obrazovce.
   */
  const [checked, setChecked] = useState<LessonAttempt | null>(null);
  const [helped, setHelped] = useState<readonly string[]>(resumedHelped ?? []);
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

  /**
   * Učení nového typu. Souboj ho nemá: oba hráči mají dostat stejné
   * podmínky, a vzor zdarma by zvýhodnil toho, kdo je
   * v aplikaci nový.
   */
  const learn = !duelId;
  const familiarity = useLiveQuery(() => templateFamiliarity(), []);
  const templateId = index === null ? null : plan.items[index].templateId;
  const itemSeed = index === null ? null : plan.items[index].seed;
  /**
   * Vzor je tatáž šablona s jiným semínkem, v nejnižší obtížnosti: jde
   * o postup, a ten je nejlíp vidět na jednoduchých číslech.
   */
  const example = useMemo(
    () => (templateId && itemSeed ? buildExercise(templateId, `${itemSeed}:vzor`, 1) : null),
    [templateId, itemSeed],
  );

  if (index === null || exercise === null) {
    return (
      <LessonSummary
        outcomes={firstTryOutcomes(plan, attempts)}
        kind={plan.kind}
        unsolved={plan.items.length - solved}
        walletBefore={walletBefore}
        onExit={onExit}
        onAgain={onAgain}
        onDuel={duelId && onDuelDone ? () => onDuelDone(duelId) : undefined}
        challenge={duelId ? undefined : challenge}
        onAccount={duelId ? undefined : onAccount}
        topic={mainCategory(plan.items.map((item) => categoryOfId(item.templateId))) ?? undefined}
      />
    );
  }

  // Znalost typů se čte z databáze; bez ní by karta nového typu naskočila
  // až po zobrazení příkladu. Je to jeden rychlý dotaz.
  if (learn && familiarity === undefined) return <div className="bg-paper h-dvh" />;

  const item = plan.items[index];
  const unseen = learn && familiarity !== undefined && !familiarity.seen.has(item.templateId);
  const unmastered = learn && familiarity !== undefined && !familiarity.mastered.has(item.templateId);
  /**
   * Pastilky za vyhodnocenou odpověď přičítá do hlavičky obrazovka příkladu
   * sama, až doletí. Tady se proto do Pokračovat odečtou, ať je v zůstatku
   * jen jednou — ať už je databáze stihla potvrdit, nebo ne.
   */
  const checkedCredit = checked !== null && attempt === 0 && checked.correct ? PILLS_PER_CORRECT : 0;
  const pills = profile.pills + pending - checkedCredit;
  const progressOptions = { plan: spec || given ? plan : undefined, stageId: spec?.stage, duelId };

  /**
   * Poslední uzavřený příklad lekci uzavírá. Zapisuje se v obsluze
   * události, ne při vykreslení shrnutí — událost nastane jednou.
   * Volá se po vyhodnocení i po vzdání: vzdáním se dá uzavřít taky.
   */
  function finishIfDone(next: readonly LessonAttempt[], credit: number) {
    if (nextIndex(plan, next) !== null || recorded.current) return;
    recorded.current = true;
    setWalletBefore(profile.pills + pending + credit);
    const outcomes = firstTryOutcomes(plan, next);
    const reward = rewardForLesson(outcomes, plan.kind);
    void recordLesson({
      lessonId,
      kind: plan.kind,
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

    // Teď už je v telefonu co ztratit; prohlížeč ať úložiště nemaže.
    void requestPersistentStorage();

    // Výsledek souboje jde rovnou na server. Do fronty nepatří:
    // bez připojení nemá souboj koho porovnávat a čekající výzva
    // je srozumitelnější než výsledek, který dorazí za tři dny.
    //
    // Klient Supabase se dotahuje až tady. Souboj je menšina lekcí
    // a 240 kB navíc by jinak čekalo na každou z nich.
    if (duelId) {
      const score = duelScore(
        plan.items.map((item) => item.seed),
        next,
      );
      void reportDuel(duelId, { correct: reward.correct, count: reward.count, ...score });
    }
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
      origin={item.origin}
      newType={unseen && attempt === 0}
      example={unmastered && example ? example : undefined}
      attempt={attempt + 1}
      retryNext={checked !== null && !checked.correct && nextIndex(plan, [...attempts, checked]) === index}
      pills={pills}
      onExit={onExit}
      onHint={() => spendPills(HINT_COST, `hint:${exercise.templateId}`)}
      helped={helped.includes(item.seed)}
      onHelped={() => {
        if (helped.includes(item.seed)) return;
        setHelped((current) => [...current, item.seed]);
        void markHelped(lessonId, item.seed, progressOptions);
      }}
      onChecked={({ correct, hinted }) => {
        // Semínko je identita položky v plánu, ne semínko zobrazeného
        // příkladu: to se u vráceného příkladu mění, aby přišla jiná čísla.
        const zapis: LessonAttempt = {
          templateId: exercise.templateId,
          seed: item.seed,
          difficulty: exercise.difficulty,
          index,
          correct,
          // Nápověda vzatá před odchodem z aplikace se počítá taky.
          hinted: hinted || helped.includes(item.seed),
        };
        setChecked(zapis);
        // Připíše se v recordAnswer; do té doby se drží v zobrazení.
        const credit = attempt === 0 && correct ? PILLS_PER_CORRECT : 0;
        setPending((value) => value + credit);

        // Zápis pokusu je samostatný od zápisu lekce: lekce se nemusí
        // dohrát, odpověď už padla.
        // Plán se ukládá i u denní lekce: sestavil se ze stavu, který se
        // během lekce mění, takže z předpisu by po návratu vyšel jiný.
        void recordAnswer(lessonId, zapis, progressOptions);
        finishIfDone([...attempts, zapis], credit);
      }}
      onContinue={({ gaveUp }) => {
        if (checked === null) return;
        const zapis = gaveUp ? { ...checked, gaveUp: true } : checked;
        const next = [...attempts, zapis];
        if (gaveUp) {
          void markGaveUp(lessonId, zapis.seed);
          finishIfDone(next, 0);
        }
        setChecked(null);
        setAttempts(next);
      }}
    />
  );
}

/**
 * Nahlášení výsledku souboje. Výsledek se nejdřív zapíše stranou, takže
 * bez sítě se neztratí: SyncAgent ho pošle, až se síť vrátí (src/lib/social.ts).
 */
async function reportDuel(duelId: string, result: DuelResult): Promise<void> {
  try {
    const [{ supabase }, { submitDuelResult }] = await Promise.all([
      import("@/lib/supabase"),
      import("@/lib/social"),
    ]);
    const client = supabase();
    if (!client) return;

    const { data } = await client.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    await submitDuelResult(client, userId, duelId, result);
  } catch {
    // Bez sítě zůstane výsledek čekat a pošle se později.
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
  kind,
  unsolved,
  walletBefore,
  onExit,
  onAgain,
  onDuel,
  challenge,
  onAccount,
  topic,
}: {
  /** Jak dopadl první pokus u každého příkladu. Odměna je z toho. */
  outcomes: readonly boolean[];
  kind?: LessonKind;
  /** Kolik příkladů student vzdal. Bez toho nedává denní cíl smysl. */
  unsolved: number;
  /**
   * Zůstatek těsně před připsáním odměny. Chybí u lekce, která se otevřela
   * už dohraná — tam se nic nepřipisuje a peněženka jen ukáže stav.
   */
  walletBefore?: number;
  onExit: () => void;
  onAgain: () => void;
  /** Lekce byla souboj: hlavní akce vede k jeho výsledku. */
  onDuel?: () => void;
  challenge?: LessonChallengeProps;
  onAccount?: () => void;
  /** Převažující téma lekce, pro výzvu. */
  topic?: DuelTopic;
}) {
  const t = useTranslations("lesson");
  const tHome = useTranslations("home");
  const tSocial = useTranslations("social");
  const format = useFormatter();
  const { profile, streak } = useProfile();
  const reward = useMemo(() => rewardForLesson(outcomes, kind), [outcomes, kind]);
  const earned = reward.correct * PILLS_PER_CORRECT;
  const bonus = reward.pills - earned;

  const balanceRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<SVGSVGElement>(null);
  const bonusRef = useRef<SVGSVGElement>(null);
  const [landed, setLanded] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);

  /**
   * Odznaky, které lekce odemkla. Jen po čerstvě dohrané lekci a až po
   * jejím zápisu — počítají se z uložených lekcí a odpovědí.
   */
  const [fresh, setFresh] = useState<BadgeState[]>([]);
  useEffect(() => {
    if (walletBefore === undefined) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void freshLocalBadges().then((found) => {
        if (!cancelled) setFresh(found);
      });
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [walletBefore]);

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

  function onLand(id: number) {
    setFlights((all) => all.filter((flight) => flight.id !== id));
    setLanded((value) => value + PER_FLYER);
    bump(balanceRef.current);
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

          {fresh.length > 0 ? (
            <div className="mt-6 flex flex-col gap-3" role="status">
              {fresh.map((badge) => (
                <div key={badge.id} className="reveal-row flex items-center gap-3">
                  <BadgeGlyph id={badge.id} level={badge.level} levels={badge.levels} />
                  <div>
                    <p className="panel-label">{tSocial("newBadge")}</p>
                    <p className="text-heading font-semibold">
                      {tSocial(`badge.${badge.id}.name`)}
                      {badge.levels > 1 ? ` ${["", "I", "II", "III"][badge.level]}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Jen po čerstvě dohrané lekci: u lekce otevřené už hotové by
              výzva přišla odnikud. */}
          {!challenge && onAccount && walletBefore !== undefined ? <SignUpNudge onOpen={onAccount} /> : null}

          {challenge && walletBefore !== undefined ? (
            <LessonChallenge
              topic={topic}
              myHandle={challenge.handle}
              onPlay={challenge.onPlay}
              onInvite={challenge.onInvite}
              onOpenDuels={challenge.onOpenDuels}
            />
          ) : null}
        </div>
      </main>

      {flights.map((flight) => (
        <Flyer key={flight.id} flight={flight} onLand={() => onLand(flight.id)} />
      ))}

      {/* Jen po čerstvě dohrané lekci, ne u lekce otevřené už hotové. */}
      {walletBefore !== undefined ? (
        <PushOffer
          streak={streak}
          facts={streakFacts(profile)}
        />
      ) : null}

      <footer
        className="bg-paper border-line shrink-0 border-t"
        style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
      >
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          <button
            type="button"
            onClick={onDuel ?? onExit}
            className="bg-accent active:bg-accent-press flex min-h-14 w-full items-center justify-center gap-2 rounded-control text-body font-semibold text-white transition-colors duration-75"
          >
            {onDuel ? <VersusIcon className="size-5" /> : <HomeIcon className="size-5" />}
            {onDuel ? t("duelResult") : t("home")}
          </button>

          {/* Další lekce je tichá volba: po splněném cíli je správné odejít,
              ne hrát dál. Po souboji je tichá volba domů. */}
          <button
            type="button"
            onClick={onDuel ? onExit : onAgain}
            className="text-ink-soft mt-1 flex min-h-11 w-full items-center justify-center gap-2 text-label"
          >
            {onDuel ? <HomeIcon className="size-4" /> : <RepeatIcon className="size-4" />}
            {onDuel ? t("home") : t("again")}
          </button>
        </div>
      </footer>
    </div>
  );
}
