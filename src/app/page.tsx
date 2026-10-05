"use client";

import { useEffect, useEffectEvent, useState } from "react";
import dynamic from "next/dynamic";
import { useFormatter, useTranslations } from "next-intl";
import { InstallBanner } from "@/components/InstallBanner";
import { NetworkStatus } from "@/components/NetworkStatus";
import { RepairCard } from "@/components/RepairCard";
import { ShopSheet } from "@/components/ShopSheet";
import { Wordmark } from "@/components/Wordmark";
import { ChartIcon, ChevronRightIcon, PersonIcon, SettingsIcon } from "@/components/icons";
import { LogoMark } from "@/components/ui/Logo";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Readout } from "@/components/ui/Readout";
import { Pastille } from "@/components/ui/Pastille";
import { DAILY_REVIEW_ITEMS, LESSON_LENGTH, newLessonId, type LessonPlan } from "@/core/lessonPlan";
import { useLocale } from "@/i18n/LocaleProvider";
import type { WeekDay } from "@/lib/today";
import type { DailySpec, StageId } from "@/core/curriculum";
import { clearProgress, lessonState, type LessonAttempt } from "@/lib/db";
import { dailySpec } from "@/lib/curriculum";
import { useCurriculum, useLessonProgress, useProfile, useToday } from "@/lib/useProfile";
import { onOpenIntent, type OpenIntent } from "@/lib/openIntent";
import { guardedLoad } from "@/lib/screenLoad";
import { ScreenLoading } from "@/components/ScreenLoading";
import { usePulse } from "@/lib/pulse";
import { Monogram } from "@/components/ui/Monogram";
import type { AccountStart, PlayableDuel } from "@/components/account/AccountScreen";

const LESSON_MINUTES = "4–6";

/**
 * Výměna se serverem se dotahuje až po vykreslení. Je v ní klient Supabase
 * (240 kB) a domovská obrazovka na něj nečeká — bez účtu ho nepotřebuje
 * vůbec a s účtem stačí, když se ozve o chvíli později.
 */
const SyncAgent = dynamic(() => import("@/components/SyncAgent").then((module) => module.SyncAgent), {
  ssr: false,
});

/**
 * Brána mezi přihlášením a daty v telefonu. Taky s klientem Supabase,
 * a tak stejně jako výměna se serverem až po vykreslení.
 */
const AccountGate = dynamic(
  () => import("@/components/account/AccountGate").then((module) => module.AccountGate),
  { ssr: false },
);

/**
 * Kód obrazovek za klepnutím. Jedna funkce na obrazovku, protože ji volá
 * `dynamic()` i přednačtení: každé místo s `import()` dostane od Turbopacku
 * vlastní zavaděč a přednačtený by `dynamic()` po klepnutí nepoužil.
 */
const loadAccountScreen = () => import("@/components/account/AccountScreen");
const loadCurriculumScreen = () => import("@/components/CurriculumScreen");
const loadStatsScreen = () => import("@/components/StatsScreen");
const loadLessonView = () => import("@/components/exercise/LessonView");
const loadLesson = () => import("@/core/lesson");

/**
 * Obrazovky se stahují hlídaně (src/lib/screenLoad.ts): když po probuzení
 * z pozadí kód nedorazí, aplikace se přenačte rovnou na ně. Mezitím je
 * vidět načítání, ne bílá plocha.
 */
const AccountScreen = dynamic(
  () => guardedLoad(loadAccountScreen, "/?open=account").then((module) => module.AccountScreen),
  { ssr: false, loading: () => <ScreenLoading /> },
);

/**
 * Nastavení se dotahují až při otevření: je v nich stav přihlášení, tedy
 * klient Supabase, a ten na domovskou obrazovku nepatří.
 */
const SettingsSheet = dynamic(
  () => import("@/components/SettingsSheet").then((module) => module.SettingsSheet),
  { ssr: false },
);

const CurriculumScreen = dynamic(
  () => guardedLoad(loadCurriculumScreen, "/?open=program").then((module) => module.CurriculumScreen),
  { ssr: false, loading: () => <ScreenLoading /> },
);

const StatsScreen = dynamic(
  () => guardedLoad(loadStatsScreen, "/?open=stats").then((module) => module.StatsScreen),
  { ssr: false, loading: () => <ScreenLoading /> },
);

/**
 * Lekce se načítá až při spuštění. Je v ní KaTeX, všech 72 šablon i fond
 * přípravků — dohromady největší kus aplikace, který úvodní obrazovka
 * k ničemu nepotřebuje. Po přenačtení se vrací domů: rozehraná lekce
 * je uložená a nabídne se tam znovu.
 */
const LessonView = dynamic(
  () => guardedLoad(loadLessonView, "/").then((module) => module.LessonView),
  { ssr: false, loading: () => <ScreenLoading /> },
);

/**
 * Chvíli po vykreslení domovské obrazovky se kód ostatních obrazovek
 * stáhne dopředu. Co je jednou načtené, zůstane v paměti i přes uspání,
 * a klepnutí po návratu z pozadí už nic stahovat nemusí. Úvodní obrazovka
 * na to nečeká a offline to nic nestojí — všechno je v precache.
 */
const PRELOAD_DELAY_MS = 1500;

function preloadScreens() {
  // Selhání tady nevadí: obrazovka to po klepnutí zkusí znovu, s pojistkou.
  for (const load of [loadAccountScreen, loadCurriculumScreen, loadStatsScreen, loadLessonView, loadLesson]) {
    load().catch(() => {});
  }
}

/**
 * Výměna se serverem běží jednou za celý běh aplikace, ne s domovskou
 * obrazovkou. Dřív byla uvnitř ní: každý návrat z lekce nebo profilu ji
 * připojil znovu a ta znovu stáhla historii, dary, souboje, ligu a znovu
 * zapsala nastavení upozornění — desítky požadavků za nic.
 */
export default function HomePage() {
  return (
    <>
      <SyncAgent />
      <AccountGate />
      <Home />
    </>
  );
}

function Home() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const tAccount = useTranslations("account");
  const tStats = useTranslations("stats");
  const tCurriculum = useTranslations("curriculum");
  const format = useFormatter();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  /** Kam profil otevřít: notifikace a dohraný souboj míří dovnitř. */
  const [accountStart, setAccountStart] = useState<AccountStart>();
  /** Pozvánka z odkazu `/?pritel=…`. */
  const [invite, setInvite] = useState<string>();
  const pulse = usePulse();
  const [statsOpen, setStatsOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  /**
   * Rozehraná lekce. Denní lekce se sestaví z identifikátoru, trénink
   * a opakování chyb přinesou hotový plán — proto se nese obojí.
   */
  const [lesson, setLesson] = useState<{
    id: string;
    plan?: LessonPlan;
    spec?: DailySpec;
    duelId?: string;
    attempts?: readonly LessonAttempt[];
    helped?: readonly string[];
  } | null>(null);

  const { profile, streak } = useProfile();
  const { solved, week } = useToday();
  const progress = useLessonProgress();
  const curriculum = useCurriculum();
  /** Rozehraná lekce se nabízí, dokud v ní zbývá aspoň jeden příklad. */
  const unfinished = progress?.attempts.length ? progress : null;
  /** Kolik příkladů z rozehrané lekce je vyřešených, ne kolik jich padlo. */
  const unfinishedSolved = unfinished
    ? new Set(unfinished.attempts.filter((one) => one.correct).map((one) => one.seed)).size
    : 0;
  /** Kdo ještě nic nedohrál, potřebuje vědět, do čeho jde. */
  const firstRun = profile.xp === 0 && solved === 0;

  /**
   * Spustí lekci ze stupně programu. Bez argumentu z toho rozepsaného.
   * Plán se staví až v obrazovce lekce, takže se sem nedostane fond
   * přípravků — domovská obrazovka ho nesmí stáhnout.
   */
  function startStage(stage?: StageId) {
    if (!curriculum) return;
    setProgramOpen(false);
    setLesson({ id: newLessonId(), spec: dailySpec(curriculum, stage) });
  }

  /** Denní lekce z domovské obrazovky: rozehraná, jinak nová. */
  function openAccount(start?: AccountStart) {
    setStatsOpen(false);
    setProgramOpen(false);
    setAccountStart(start);
    setAccountOpen(true);
  }

  /**
   * Souboj se sestaví z identifikátoru a tématu (src/core/lesson.ts).
   * Plán se k rozehrané lekci uloží, takže po návratu přijdou tytéž
   * příklady. Sestavení tahá šablony, a tak až tady.
   *
   * Co už v souboji padlo, se načte z databáze. Dřív se souboj otevřený
   * ze seznamu hrál od začátku: student znal příklady a chyba zmizela.
   */
  async function playDuel(duel: PlayableDuel) {
    const [{ planDuelLesson }, done] = await Promise.all([loadLesson(), lessonState(duel.lessonId)]);
    setAccountOpen(false);
    setLesson({
      id: duel.lessonId,
      plan: planDuelLesson(duel.lessonId, duel.topic),
      duelId: duel.id,
      attempts: done.attempts,
      helped: done.helped,
    });
  }

  function startDaily() {
    if (unfinished) {
      setLesson({
        id: unfinished.lessonId,
        plan: unfinished.plan,
        duelId: unfinished.duelId,
        attempts: unfinished.attempts,
        helped: unfinished.helped,
      });
    } else {
      startStage();
    }
  }

  /**
   * Klepnutí na notifikaci: připomínka série otevře rovnou lekci, zprávy
   * od kamarádů a z ligy obrazovku účtu. Rozehraná lekce má přednost —
   * notifikace ji nesmí zahodit.
   */
  const handleIntent = useEffectEvent((intent: OpenIntent): boolean => {
    if (lesson !== null) return false;
    if (intent.startsWith("duel:")) {
      openAccount({ screen: "duel", duelId: intent.slice("duel:".length) });
      return true;
    }
    if (intent.startsWith("invite:")) {
      setInvite(intent.slice("invite:".length));
      openAccount();
      return true;
    }
    if (intent === "account" || intent === "duels" || intent === "league") {
      openAccount(intent === "account" ? undefined : { screen: intent });
      return true;
    }
    if (intent === "stats" || intent === "program") {
      setAccountOpen(false);
      setStatsOpen(intent === "stats");
      setProgramOpen(intent === "program");
      return true;
    }
    // Lekce se dá sestavit, až je načtený program.
    if (!curriculum || progress === undefined) return false;
    setStatsOpen(false);
    setAccountOpen(false);
    startDaily();
    return true;
  });
  // Znovu se přihlásí, když se změní, jestli se dá cíl splnit — čekající
  // cíl se tím nabídne ještě jednou.
  useEffect(() => onOpenIntent(handleIntent), [lesson, curriculum, progress]);

  useEffect(() => {
    const timer = window.setTimeout(preloadScreens, PRELOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (lesson !== null) {
    return (
      <LessonView
        // Nová lekce, nová instance: po výzvě ze shrnutí se rovnou hraje
        // souboj a stav předchozí lekce v něm nesmí zůstat.
        key={lesson.id}
        lessonId={lesson.id}
        plan={lesson.plan}
        spec={lesson.spec}
        duelId={lesson.duelId}
        attempts={lesson.attempts}
        helped={lesson.helped}
        onExit={() => setLesson(null)}
        onAgain={() => startStage(lesson.spec?.stage)}
        onDuelDone={(duelId) => {
          setLesson(null);
          openAccount({ screen: "reveal", duelId });
        }}
        onAccount={() => {
          setLesson(null);
          openAccount();
        }}
        challenge={
          pulse?.handle
            ? {
                handle: pulse.handle,
                onPlay: (duel) => void playDuel(duel),
                onInvite: () => {
                  setLesson(null);
                  openAccount({ screen: "friends" });
                },
                onOpenDuels: () => {
                  setLesson(null);
                  openAccount({ screen: "duels" });
                },
              }
            : undefined
        }
      />
    );
  }

  if (programOpen) {
    return (
      <CurriculumScreen
        state={curriculum}
        onClose={() => setProgramOpen(false)}
        onStart={(stage) => startStage(stage)}
      />
    );
  }

  if (statsOpen) {
    return (
      <StatsScreen
        onClose={() => setStatsOpen(false)}
        onTrain={async (mode) => {
          // Sestavení lekce se dotahuje až tady: je v něm fond přípravků
          // a všech 72 šablon, které domovská obrazovka nepotřebuje.
          const { planCategoryLesson, planFromItems } = await loadLesson();
          const id = newLessonId();
          const plan =
            mode.kind === "mistakes" ? planFromItems(id, mode.items) : planCategoryLesson(id, mode.category);
          setStatsOpen(false);
          setLesson({ id, plan });
        }}
      />
    );
  }

  if (accountOpen) {
    return (
      <AccountScreen
        // Nový začátek, nová instance: jinak by zůstal viset zásobník
        // obrazovek z minulého otevření.
        key={accountStart ? JSON.stringify(accountStart) : "profile"}
        start={accountStart}
        invite={invite}
        onInviteDone={() => setInvite(undefined)}
        onClose={() => {
          setAccountOpen(false);
          setAccountStart(undefined);
        }}
        onPlayDuel={(duel) => void playDuel(duel)}
      />
    );
  }

  const goalMet = solved >= LESSON_LENGTH;

  /** Stupeň, na který se kouká tlačítko: rozehraná lekce má svůj vlastní. */
  const stageId = unfinished?.stageId ?? curriculum?.current;
  const spec = curriculum && stageId ? dailySpec(curriculum, stageId) : null;
  // Opakování plní nejdřív chyby, zbytek zvládnutá látka. Bez ní zůstanou
  // jen místa, která chyby obsadí.
  const review = !spec
    ? 0
    : spec.review.length > 0
      ? DAILY_REVIEW_ITEMS
      : Math.min(spec.mistakes?.length ?? 0, DAILY_REVIEW_ITEMS);
  const mix =
    review > 0
      ? t("mix", { stage: LESSON_LENGTH - review, review })
      : t("mixOnly", { stage: LESSON_LENGTH });

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <NetworkStatus />

      <header
        className="app-chrome flex items-center justify-between px-5 pb-3"
        style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
      >
        <div className="text-accent flex items-center gap-2">
          <LogoMark className="size-5" />
          <Wordmark className="text-heading" />
        </div>
        <div className="-mr-3 flex items-center">
          {/* Pořadí podle toho, jak často se kam sahá: nejčastější v rohu
              u palce, nastavení (mění se párkrát za život) nejdál. Roh
              patří „já“ — tam účet oko hledá a monogram hlavičku ukotví. */}
          <IconButton label={tCommon("settings")} onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="size-[1.375rem]" />
          </IconButton>
          <IconButton label={tStats("title")} onClick={() => setStatsOpen(true)}>
            <ChartIcon className="size-6" />
          </IconButton>
          {/* Po přihlášení monogram místo ikony. Tečka v akcentu, když na
              uživatele něco čeká — výzva, tah v souboji, žádost, výsledek. */}
          <IconButton
            label={pulse?.attention ? tAccount("titleAttention", { count: pulse.attention }) : tAccount("title")}
            onClick={() => openAccount()}
          >
            <span className="relative flex">
              {/* Monogram v tenkém prstenci: je poznat, že jsi přihlášený,
                  a vedle tahových ikon nekřičí. */}
              {pulse?.handle ? (
                <span className="border-line rounded-full border p-[2px]">
                  <Monogram handle={pulse.handle} size="xs" />
                </span>
              ) : (
                <PersonIcon className="size-6" />
              )}
              {pulse?.attention ? (
                <span className="bg-accent border-paper absolute -top-0.5 -right-0.5 size-3 rounded-full border-2" />
              ) : null}
            </span>
          </IconButton>
        </div>
      </header>

      <main tabIndex={0} className="scroll-y mx-auto flex w-full max-w-md flex-1 flex-col px-5">
        {/* Spadlá série se dá krátce po ztrátě obnovit. Nahoře, protože
            lhůta běží — a jinak se karta vůbec neukáže. */}
        <RepairCard />

        {/* Hrdina se drží ve svislém středu volného místa — jinak se obrazovka
            rozpadne na horní půlku s obsahem a spodní s prázdnem. */}
        <section className="flex flex-1 flex-col items-center justify-center gap-7 py-4">
          <div className="flex flex-col items-center">
            <h1 className="panel-label">{t("dailyGoal")}</h1>
            <div className="mt-3">
              <ProgressRing done={solved} total={LESSON_LENGTH}>
                <span className="readout text-display font-semibold" data-numeric>
                  {format.number(Math.min(solved, LESSON_LENGTH))}
                </span>
                <span className="panel-label mt-0.5">
                  {goalMet ? t("dailyDone") : t("dailyOf", { total: LESSON_LENGTH })}
                </span>
              </ProgressRing>
            </div>
          </div>

          {firstRun ? (
            <p className="text-ink-soft text-center text-label" data-numeric>
              {t("lessonMeta", { count: LESSON_LENGTH, minutes: LESSON_MINUTES })}
            </p>
          ) : null}

          <Week week={week} />

          <div className="w-full">
            {/* Série a XP jsou displej: dvě čísla, na která se kouká. */}
            <div className="border-line divide-line grid grid-cols-2 divide-x border-y py-4">
              <div className="pr-3">
                <Readout
                  label={t("streak")}
                  value={format.number(streak)}
                  unit={t("streakUnit", { days: streak })}
                  size="small"
                />
              </div>
              <div className="pl-3">
                <Readout label={t("xp")} value={format.number(profile.xp)} size="small" />
              </div>
            </div>

            {/* Pastilky jsou naproti tomu ovládací prvek, a tak musí i vypadat:
                řádek s rámečkem a šipkou jako výběr tématu dole, klepnutím
                do obchodu. Samotné číslo v mřížce nikdo za tlačítko neměl. */}
            <button
              type="button"
              onClick={() => setShopOpen(true)}
              aria-label={t("wallet", { count: profile.pills })}
              className="border-line mt-3 flex min-h-11 w-full items-center gap-2.5 rounded-control border px-3 text-left"
            >
              <Pastille className="size-5 shrink-0" />
              <span className="panel-label flex-1">{t("pills")}</span>
              <span className="readout text-ink text-body font-semibold" data-numeric>
                {format.number(profile.pills)}
              </span>
              <ChevronRightIcon className="text-ink-soft size-5 shrink-0" />
            </button>
          </div>
        </section>
      </main>

      <div className="app-chrome shrink-0">
        <InstallBanner />
        <footer
          className="bg-paper border-line mx-auto w-full max-w-md border-t px-5 pt-3"
          style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
        >
          {/* Na co lekce je. Bez toho student neví, do čeho jde, a program
              by neměl kudy otevřít. */}
          {stageId ? (
            <button
              type="button"
              onClick={() => setProgramOpen(true)}
              className="border-line mb-3 flex min-h-11 w-full items-center gap-3 rounded-control border px-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="panel-label block truncate">{tCurriculum(`stages.${stageId}`)}</span>
                <span className="text-ink-soft mt-0.5 block text-micro" data-numeric>
                  {mix}
                </span>
              </span>
              <ChevronRightIcon className="text-ink-soft size-5 shrink-0" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={startDaily}
            className="bg-accent active:bg-accent-press min-h-14 w-full rounded-control text-body font-semibold text-white transition-colors duration-75"
          >
            {unfinished
              ? t("resume", { done: unfinishedSolved, total: LESSON_LENGTH })
              : t("start")}
          </button>

          {/* Rozehranou lekci jde odložit stranou. Odpovědi z ní zůstávají
              uložené, jen se v ní už nepokračuje. */}
          {unfinished ? (
            <button
              type="button"
              onClick={() => {
                void clearProgress();
                startStage();
              }}
              className="text-ink-soft min-h-11 w-full text-label"
            >
              {t("startFresh")}
            </button>
          ) : null}
        </footer>
      </div>

      <ShopSheet open={shopOpen} onClose={() => setShopOpen(false)} />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenAccount={() => openAccount()}
      />
    </div>
  );
}

/**
 * Probíhající týden, pondělím počínaje. Dny, které teprve přijdou, jsou
 * jen naznačené — nejsou to zmeškané dny a nemají tak vypadat.
 */
function Week({ week }: { week: WeekDay[] }) {
  const t = useTranslations("home");
  const { locale } = useLocale();
  /* Jednopísmenné zkratky se v češtině opakují (pondělí i pátek je „P"),
     takže se dny nedají rozeznat. Dvoupísmenné ano. */
  const letters = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });

  return (
    <section className="w-full" aria-label={t("weekTitle")}>
      <ul className="flex justify-between gap-1.5">
        {week.map(({ day, active, today, upcoming }) => (
          <li key={day} className="flex flex-1 flex-col items-center gap-2">
            <span className={`panel-label ${today ? "text-ink" : ""}`}>
              {letters.format(new Date(`${day}T00:00:00Z`))}
            </span>
            <span
              className={`h-2 w-full rounded-[1px] ${
                active ? "bg-accent" : today ? "bg-accent/25" : upcoming ? "bg-surface" : "bg-line"
              }`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-ink-soft flex size-11 items-center justify-center"
    >
      {children}
    </button>
  );
}
