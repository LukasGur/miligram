"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { InstallSteps } from "@/components/InstallBanner";
import { Toggle } from "@/components/ui/Toggle";
import { useLocale } from "@/i18n/LocaleProvider";
import { usePlatform } from "@/lib/clientState";
import {
  DEFAULT_PREFS,
  disablePush,
  enablePush,
  fetchPrefs,
  pushOnFor,
  REMINDER_EARLIEST,
  REMINDER_LATEST,
  savePrefs,
  showWelcomeNotice,
  usePushStatus,
  type NotificationPrefs,
} from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { streakFacts, useProfile } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";

/**
 * Upozornění v Nastavení.
 *
 * Každý stav, ve kterém se zapnout nedají, musí říct proč a co s tím —
 * vypínač, který nejde přepnout, a nic k tomu, je nejhorší možná odpověď.
 */
export function PushSettings({ onSignIn }: { onSignIn: () => void }) {
  const t = useTranslations("notifications");
  const { session, ready: sessionReady } = useSession();
  const status = usePushStatus();
  const platform = usePlatform();
  const userId = session?.user.id;
  const on = pushOnFor(status, userId);

  if (!sessionReady || !status.ready) {
    return <p className="text-ink-soft text-label">{t("settingsLoading")}</p>;
  }

  if (!userId) {
    return (
      <>
        <p className="text-ink-soft text-label">{t("settingsSignedOut")}</p>
        <button
          type="button"
          onClick={onSignIn}
          className="border-line text-accent mt-3 min-h-11 rounded-control border px-4 text-label font-semibold"
        >
          {t("settingsSignIn")}
        </button>
      </>
    );
  }

  if (status.availability === "needsInstall") {
    return (
      <>
        <p className="text-ink-soft text-label">{t("settingsInstall")}</p>
        <InstallSteps platform={platform} className="mt-2 text-label" />
      </>
    );
  }

  if (status.availability === "unsupported") {
    return <p className="text-ink-soft text-label">{t("settingsUnsupported")}</p>;
  }

  if (status.permission === "denied") {
    const how =
      platform === "ios-safari" || platform === "ios-other-browser"
        ? t("deniedIos")
        : platform === "android"
          ? t("deniedAndroid")
          : t("deniedDesktop");
    return (
      <>
        <p className="text-body font-medium">{t("deniedTitle")}</p>
        <p className="text-ink-soft mt-1 text-label">{how}</p>
      </>
    );
  }

  return <Controls userId={userId} on={on} />;
}

function Controls({ userId, on }: { userId: string; on: boolean }) {
  const t = useTranslations("notifications");
  const { locale } = useLocale();
  const { profile } = useProfile();
  const timeId = useId();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  // Nastavení je na účtu, ne v telefonu: načte se ze serveru, až když
  // jsou upozornění zapnutá. Do té doby platí výchozí.
  useEffect(() => {
    const client = supabase();
    if (!on || !client) return;
    let cancelled = false;
    fetchPrefs(client, userId)
      .then((loaded) => {
        if (!cancelled) setPrefs(loaded);
      })
      .catch(() => {
        if (!cancelled) setPrefs(DEFAULT_PREFS);
      });
    return () => {
      cancelled = true;
    };
  }, [on, userId]);

  const current = prefs ?? DEFAULT_PREFS;

  async function toggleMaster(next: boolean) {
    const client = supabase();
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      if (next) {
        const result = await enablePush(client, userId, {
          locale,
          ...streakFacts(profile),
        });
        if (result === "enabled") {
          await showWelcomeNotice(t("welcomeTitle"), t("welcomeBody", { time: current.reminderTime }));
        } else if (result === "failed") {
          setError(t("failed"));
        }
        // „denied“ vyřeší nadřazená komponenta: stav povolení se změní
        // a místo vypínače se ukáže postup, kde to povolit.
      } else {
        await disablePush(client);
      }
    } catch {
      setError(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Změna se ukáže hned; když ji server nepřijme, vrátí se zpátky.
   * Čas se ukládá s odstupem: kolečko na iOS hlásí změnu při každém
   * pootočení a na server má dojít jen to, kde se zastavilo.
   */
  function update(patch: Partial<NotificationPrefs>, delay = 0) {
    const client = supabase();
    if (!client) return;
    const before = current;
    setPrefs({ ...current, ...patch });
    setError(null);
    const save = () =>
      savePrefs(client, userId, patch).catch(() => {
        setPrefs(before);
        setError(t("saveFailed"));
      });
    if (delay === 0) {
      void save();
      return;
    }
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void save(), delay);
  }

  return (
    <>
      <div className="border-line divide-line divide-y rounded-control border">
        <Toggle checked={on} onChange={(next) => void toggleMaster(next)} disabled={busy}>
          {t("settingsMaster")}
        </Toggle>

        {on ? (
          <>
            <Toggle checked={current.streak} onChange={(streak) => update({ streak })} disabled={!prefs}>
              {t("settingsStreak")}
            </Toggle>

            {current.streak ? (
              <label
                htmlFor={timeId}
                className="flex min-h-12 w-full items-center justify-between gap-4 px-4 py-2 text-body"
              >
                {t("settingsTime")}
                <input
                  id={timeId}
                  type="time"
                  value={current.reminderTime}
                  min={REMINDER_EARLIEST}
                  max={REMINDER_LATEST}
                  step={900}
                  disabled={!prefs}
                  onChange={(event) => {
                    if (event.target.value) update({ reminderTime: event.target.value }, 800);
                  }}
                  className="readout bg-surface text-accent min-h-10 rounded-readout px-3 text-body font-semibold disabled:opacity-40"
                  data-numeric
                />
              </label>
            ) : null}

            <Toggle
              checked={current.lastChance}
              onChange={(lastChance) => update({ lastChance })}
              disabled={!prefs}
              hint={t("settingsLastChanceHint")}
            >
              {t("settingsLastChance")}
            </Toggle>
            <Toggle checked={current.social} onChange={(social) => update({ social })} disabled={!prefs}>
              {t("settingsSocial")}
            </Toggle>
            <Toggle checked={current.league} onChange={(league) => update({ league })} disabled={!prefs}>
              {t("settingsLeague")}
            </Toggle>
          </>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-ink mt-2 text-label font-medium">
          {error}
        </p>
      ) : null}
      <p className="text-ink-soft mt-2 text-micro">{t("settingsHint")}</p>
    </>
  );
}
