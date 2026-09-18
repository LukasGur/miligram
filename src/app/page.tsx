"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useFormatter, useTranslations } from "next-intl";
import { InstallBanner } from "@/components/InstallBanner";
import { NetworkStatus } from "@/components/NetworkStatus";
import { SettingsSheet } from "@/components/SettingsSheet";
import { ShopSheet } from "@/components/ShopSheet";
import { Wordmark } from "@/components/Wordmark";
import { ChartIcon, PersonIcon, SettingsIcon } from "@/components/icons";
import { LogoMark } from "@/components/ui/Logo";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Readout } from "@/components/ui/Readout";
import { LESSON_LENGTH, newLessonId, type LessonPlan } from "@/core/lessonPlan";
import { useLocale } from "@/i18n/LocaleProvider";
import type { WeekDay } from "@/lib/today";
import { clearProgress, type LessonAttempt } from "@/lib/db";
import { useLessonProgress, useProfile, useToday } from "@/lib/useProfile";

const LESSON_MINUTES = "4–6";

/**
 * Výměna se serverem se dotahuje až po vykreslení. Je v ní klient Supabase
 * (240 kB) a domovská obrazovka na něj nečeká — bez účtu ho nepotřebuje
 * vůbec a s účtem stačí, když se ozve o chvíli později.
 */
const SyncAgent = dynamic(() => import("@/components/SyncAgent").then((module) => module.SyncAgent), {
  ssr: false,
});

const AccountScreen = dynamic(
  () => import("@/components/account/AccountScreen").then((module) => module.AccountScreen),
  { ssr: false },
);

const StatsScreen = dynamic(
  () => import("@/components/StatsScreen").then((module) => module.StatsScreen),
  { ssr: false },
);

/**
 * Lekce se načítá až při spuštění. Je v ní KaTeX, všech 72 šablon i fond
 * přípravků — dohromady největší kus aplikace, který úvodní obrazovka
 * k ničemu nepotřebuje.
 */
const LessonView = dynamic(
  () => import("@/components/exercise/LessonView").then((module) => module.LessonView),
  { ssr: false },
);

export default function HomePage() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const tAccount = useTranslations("account");
  const tStats = useTranslations("stats");
  const format = useFormatter();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  /**
   * Rozehraná lekce. Denní lekce se sestaví z identifikátoru, trénink
   * a opakování chyb přinesou hotový plán — proto se nese obojí.
   */
  const [lesson, setLesson] = useState<{
    id: string;
    plan?: LessonPlan;
    duelId?: string;
    attempts?: readonly LessonAttempt[];
  } | null>(null);

  const { profile, streak } = useProfile();
  const { solved, week } = useToday();
  const progress = useLessonProgress();
  /** Rozehraná lekce se nabízí, dokud v ní zbývá aspoň jeden příklad. */
  const unfinished = progress?.attempts.length ? progress : null;
  /** Kolik příkladů z rozehrané lekce je vyřešených, ne kolik jich padlo. */
  const unfinishedSolved = unfinished
    ? new Set(unfinished.attempts.filter((one) => one.correct).map((one) => one.seed)).size
    : 0;
  /** Kdo ještě nic nedohrál, potřebuje vědět, do čeho jde. */
  const firstRun = profile.xp === 0 && solved === 0;

  if (lesson !== null) {
    return (
      <LessonView
        lessonId={lesson.id}
        plan={lesson.plan}
        duelId={lesson.duelId}
        attempts={lesson.attempts}
        onExit={() => setLesson(null)}
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
          const { planCategoryLesson, planFromItems } = await import("@/core/lesson");
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
        onClose={() => setAccountOpen(false)}
        onPlayDuel={(duel) => {
          setAccountOpen(false);
          setLesson({ id: duel.lessonId, duelId: duel.id });
        }}
      />
    );
  }

  const goalMet = solved >= LESSON_LENGTH;

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <NetworkStatus />
      <SyncAgent />

      <header
        className="app-chrome flex items-center justify-between px-5 pb-3"
        style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
      >
        <div className="text-accent flex items-center gap-2">
          <LogoMark className="size-5" />
          <Wordmark className="text-heading" />
        </div>
        <div className="-mr-3 flex items-center">
          <IconButton label={tStats("title")} onClick={() => setStatsOpen(true)}>
            <ChartIcon className="size-6" />
          </IconButton>
          <IconButton label={tAccount("title")} onClick={() => setAccountOpen(true)}>
            <PersonIcon className="size-6" />
          </IconButton>
          <IconButton label={tCommon("settings")} onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="size-6" />
          </IconButton>
        </div>
      </header>

      <main tabIndex={0} className="scroll-y mx-auto flex w-full max-w-md flex-1 flex-col px-5">
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

          {/* Ne <dl>: jedna z hodnot je tlačítko a seznam definic v sobě
              nesmí mít nic než dvojice dt/dd. */}
          <div className="border-line divide-line grid w-full grid-cols-3 divide-x border-t pt-4">
          <div className="pr-3">
            <Readout label={t("streak")} value={format.number(streak)} unit={t("streakUnit", { days: streak })} size="small" />
          </div>
          <button
            type="button"
            onClick={() => setShopOpen(true)}
            aria-label={t("openShop")}
            className="px-3 text-left"
          >
            <Readout label={t("pills")} value={format.number(profile.pills)} size="small" tone="accent" />
          </button>
          <div className="pl-3">
            <Readout label={t("xp")} value={format.number(profile.xp)} size="small" />
          </div>
          </div>
        </section>
      </main>

      <div className="app-chrome shrink-0">
        <InstallBanner />
        <footer
          className="bg-paper border-line mx-auto w-full max-w-md border-t px-5 pt-3"
          style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
        >
          <button
            type="button"
            onClick={() =>
              unfinished
                ? setLesson({
                    id: unfinished.lessonId,
                    plan: unfinished.plan as LessonPlan | undefined,
                    duelId: unfinished.duelId,
                    attempts: unfinished.attempts,
                  })
                : setLesson({ id: newLessonId() })
            }
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
                setLesson({ id: newLessonId() });
              }}
              className="text-ink-soft min-h-11 w-full text-label"
            >
              {t("startFresh")}
            </button>
          ) : null}
        </footer>
      </div>

      <ShopSheet open={shopOpen} onClose={() => setShopOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
