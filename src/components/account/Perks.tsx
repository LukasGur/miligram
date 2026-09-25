"use client";

import type { CSSProperties, ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CaretDownIcon, LadderIcon, ShieldIcon, VersusIcon } from "@/components/icons";

/** Rozestup nástupu jednotlivých karet. Dost na to, aby šel vidět sled, ne čekání. */
const STAGGER_MS = 70;

/**
 * Co účet přinese — ukázané, ne vyjmenované.
 *
 * Každá výhoda má malý náhled toho, jak vypadá doopravdy: kousek ligy
 * s tebou uprostřed, výsledek souboje, dar od kamaráda. Náhledy jsou
 * pro odečítač skryté; význam nese nadpis a věta pod ním.
 *
 * Záloha postupu tu schválně chybí. Postup zůstává v telefonu i bez účtu
 * a lákat na ni by znělo, jako by bez účtu hrozilo, že o něj člověk přijde.
 */
export function Perks({ first = 0 }: { first?: number }) {
  const t = useTranslations("account");

  return (
    <ul className="mt-6 space-y-3">
      <Perk
        index={first}
        icon={<LadderIcon className="size-5" />}
        title={t("perkLeagueTitle")}
        body={t("perkLeagueBody")}
      >
        <LeaguePreview />
      </Perk>
      <Perk
        index={first + 1}
        icon={<VersusIcon className="size-5" />}
        title={t("perkDuelsTitle")}
        body={t("perkDuelsBody")}
      >
        <DuelPreview />
      </Perk>
      <Perk
        index={first + 2}
        icon={<ShieldIcon className="size-5" />}
        title={t("perkGiftsTitle")}
        body={t("perkGiftsBody")}
      >
        <GiftPreview />
      </Perk>
    </ul>
  );
}

/** Zpoždění nástupu pro n-tý prvek obrazovky. Sdílí ho i formulář pod výhodami. */
export function riseDelay(index: number): CSSProperties {
  return { animationDelay: `${index * STAGGER_MS}ms` };
}

function Perk({
  index,
  icon,
  title,
  body,
  children,
}: {
  index: number;
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <li className="animate-rise border-line overflow-hidden rounded-panel border" style={riseDelay(index)}>
      <div aria-hidden="true" className="bg-surface px-4 py-4">
        {children}
      </div>
      <div className="flex gap-3 px-4 py-3.5">
        <span className="bg-accent-wash text-accent flex size-9 shrink-0 items-center justify-center rounded-control">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-body font-semibold">{title}</h3>
          <p className="text-ink-soft mt-0.5 text-label">{body}</p>
        </div>
      </div>
    </li>
  );
}

/**
 * Tři řádky ligy, uprostřed ty. Chvíli po nástupu se prohodíš s tím,
 * kdo byl před tebou — přesně to, kvůli čemu se do ligy chodí.
 *
 * Pořadí stojí ve vlastním sloupci a nehýbe se, jezdí jen lidé. Jinak by
 * uprostřed prohození stálo pod sebou 3, 5, 4. Řádky mají pevnou výšku,
 * aby posun o 100 % sedl přesně na sousední místo.
 */
function LeaguePreview() {
  const t = useTranslations("account");
  const format = useFormatter();
  const xp = (value: number) => t("previewXp", { xp: format.number(value) });

  return (
    <div className="mx-auto flex max-w-72 gap-2">
      <ol className="readout text-ink-soft text-label" data-numeric>
        <li className="flex h-9 w-4 items-center">3</li>
        <li className="text-accent flex h-9 w-4 items-center font-semibold">4</li>
        <li className="flex h-9 w-4 items-center">5</li>
      </ol>
      <ul className="min-w-0 flex-1">
        <li className="flex h-9 items-center gap-3 px-3">
          <span className="flex-1 truncate text-label">{t("previewLeader")}</span>
          <span className="readout text-ink-soft text-label" data-numeric>{xp(240)}</span>
        </li>
        <li className="animate-climb-up bg-paper border-accent relative z-10 flex h-9 items-center gap-3 rounded-control border px-3 shadow-sm">
          <span className="flex flex-1 items-center gap-1 text-label font-semibold">
            {t("you")}
            <CaretDownIcon className="animate-climb-mark text-accent size-4 rotate-180" />
          </span>
          <span className="readout text-label font-semibold" data-numeric>{xp(210)}</span>
        </li>
        <li className="animate-climb-down flex h-9 items-center gap-3 px-3">
          <span className="flex-1 truncate text-label">{t("previewRival")}</span>
          <span className="readout text-ink-soft text-label" data-numeric>{xp(190)}</span>
        </li>
      </ul>
    </div>
  );
}

/** Výsledek souboje ve stejné lekci, jak ho ukazuje seznam soubojů. */
function DuelPreview() {
  const t = useTranslations("account");
  const friend = t("previewFriend");

  return (
    <div className="flex items-center justify-center gap-4">
      <Avatar label={t("you")} mine />
      <div className="text-center">
        <p className="readout text-title font-semibold" data-numeric>
          {t("duelScore", { mine: 5, theirs: 3 })}
        </p>
        <p className="panel-label !text-accent mt-0.5">{t("duelWon")}</p>
      </div>
      <Avatar label={friend} />
    </div>
  );
}

function Avatar({ label, mine = false }: { label: string; mine?: boolean }) {
  return (
    <div className="flex w-14 flex-col items-center gap-1">
      <span
        className={`flex size-10 items-center justify-center rounded-full text-body font-semibold uppercase ${
          mine ? "bg-accent text-white" : "bg-paper border-line text-ink border"
        }`}
      >
        {label.charAt(0)}
      </span>
      <span className="text-ink-soft max-w-full truncate text-micro">{label}</span>
    </div>
  );
}

/** Dar, jak dorazí do seznamu darů. */
function GiftPreview() {
  const t = useTranslations("account");

  return (
    <div className="bg-paper border-line mx-auto flex max-w-72 items-center gap-3 rounded-control border px-3 py-2.5 shadow-sm">
      <ShieldIcon className="text-accent size-5 shrink-0" />
      <span className="flex-1 text-label">{t("giftFrom", { handle: t("previewFriend") })}</span>
      <span className="text-ink-soft text-micro">{t("previewGiftWhen")}</span>
    </div>
  );
}
