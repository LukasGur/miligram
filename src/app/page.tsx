"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useFormatter, useTranslations } from "next-intl";
import { newLessonId, LESSON_LENGTH } from "@/core/lesson";
import { useProfile } from "@/lib/useProfile";
import { InstallBanner } from "@/components/InstallBanner";
import { NetworkStatus } from "@/components/NetworkStatus";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Wordmark } from "@/components/Wordmark";
import { SettingsIcon } from "@/components/icons";

const LESSON_MINUTES = "4–6";

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
  const format = useFormatter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const { profile, streak } = useProfile();

  if (lessonId !== null) {
    return <LessonView lessonId={lessonId} onExit={() => setLessonId(null)} />;
  }

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <NetworkStatus />

      <header
        className="app-chrome flex items-center justify-between px-5 pb-2"
        style={{ paddingTop: "calc(var(--sa-t) + 0.75rem)" }}
      >
        <Wordmark className="text-accent text-heading" />
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={tCommon("settings")}
          className="text-ink-soft -mr-3 flex size-11 items-center justify-center"
        >
          <SettingsIcon className="size-6" />
        </button>
      </header>

      <main className="scroll-y mx-auto w-full max-w-md flex-1 px-5 pb-8">
        <dl className="border-line divide-line grid grid-cols-3 divide-x border-y py-4">
          <Stat label={t("streak")} value={format.number(streak)} suffix={t("streakUnit", { days: streak })} />
          <Stat label={t("pills")} value={format.number(profile.pills)} />
          <Stat label={t("xp")} value={format.number(profile.xp)} />
        </dl>

        <section className="bg-accent-wash rounded-panel mt-6 px-5 py-6">
          <h1 className="text-title font-semibold">{t("lessonTitle")}</h1>
          <p className="text-ink-soft mt-1.5 text-label" data-numeric>
            {t("lessonMeta", { count: LESSON_LENGTH, minutes: LESSON_MINUTES })}
          </p>
        </section>

        <section className="border-line mt-8 border-l-2 pl-4">
          <h2 className="text-label font-semibold">{t("buildNoticeTitle")}</h2>
          <p className="text-ink-soft mt-1 text-label">{t("buildNoticeBody")}</p>
        </section>
      </main>

      <div className="app-chrome shrink-0">
        <InstallBanner />
        <div
          className="bg-paper border-line mx-auto w-full max-w-md border-t px-5 pt-3"
          style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
        >
          <button
            type="button"
            onClick={() => setLessonId(newLessonId())}
            className="bg-accent active:bg-accent-press min-h-14 w-full rounded-control text-body font-semibold text-white transition-colors duration-75"
          >
            {t("start")}
          </button>
        </div>
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <dt className="text-ink-soft text-micro">{label}</dt>
      <dd className="num mt-0.5 text-title font-semibold">
        {value}
        {suffix ? <span className="text-ink-soft ml-1 text-label font-normal">{suffix}</span> : null}
      </dd>
    </div>
  );
}
