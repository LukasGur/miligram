"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { BellIcon, CaretDownIcon, LadderIcon, ShieldIcon, VersusIcon } from "@/components/icons";
import { Notice } from "@/components/push/ReminderPreview";

/** Rozestup nástupu jednotlivých karet. Dost na to, aby šel vidět sled, ne čekání. */
const STAGGER_MS = 70;

/**
 * Co účet přinese — ukázané, ne vyjmenované.
 *
 * Každá výhoda má malý náhled toho, jak vypadá doopravdy: kousek ligy
 * s tebou uprostřed, výsledek souboje, dar od kamaráda. Náhledy jsou
 * pro odečítač skryté; význam nese nadpis a věta pod ním.
 *
 * Pořadí: kamarádi a souboje první — táhnou nejvíc a všechno ostatní
 * na nich stojí. Liga hned za nimi, je to druhý důvod vracet se. Dárky
 * až po nich, bez kamarádů nemají smysl. Připomínky nakonec, nabídnou
 * se stejně hned po registraci.
 *
 * Pastilky na start tu kartu nemají. Mezi věcmi, které účet umí, by
 * působily jako úplatek; stojí jako cenovka u formuláře a na tlačítku.
 *
 * Záloha postupu tu schválně chybí. Postup zůstává v telefonu i bez účtu
 * a lákat na ni by znělo, jako by bez účtu hrozilo, že o něj člověk přijde.
 */
export function Perks() {
  const t = useTranslations("account");
  const list = useRevealOnView<HTMLUListElement>();

  return (
    <ul ref={list} className="mt-3 space-y-3">
      <Perk icon={<VersusIcon className="size-5" />} title={t("perkDuelsTitle")} body={t("perkDuelsBody")}>
        <DuelPreview />
      </Perk>
      <Perk icon={<LadderIcon className="size-5" />} title={t("perkLeagueTitle")} body={t("perkLeagueBody")}>
        <LeaguePreview />
      </Perk>
      <Perk icon={<ShieldIcon className="size-5" />} title={t("perkGiftsTitle")} body={t("perkGiftsBody")}>
        <GiftPreview />
      </Perk>
      <Perk icon={<BellIcon className="size-5" />} title={t("perkRemindersTitle")} body={t("perkRemindersBody")}>
        <ReminderPerkPreview />
      </Perk>
    </ul>
  );
}

/**
 * Karty stojí pod formulářem, většinou pod okrajem obrazovky. Animace
 * spuštěná při otevření by doběhla dřív, než k ní člověk doscrolluje —
 * hlavně prohození v lize. Proto každá karta čeká zastavená
 * (`data-seen="false"` v globals.css), dokud nevjede do záběru.
 *
 * Karty, které se ukážou naráz (vyšší displej), nastoupí postupně.
 * Přímo přes DOM: jde o jednorázové spuštění, kvůli kterému
 * není potřeba překreslovat.
 */
function useRevealOnView<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const items = Array.from(ref.current?.children ?? []) as HTMLElement[];
    const reveal = (item: HTMLElement, order: number) => {
      item.style.animationDelay = `${order * STAGGER_MS}ms`;
      item.dataset.seen = "true";
    };
    if (typeof IntersectionObserver === "undefined") {
      items.forEach(reveal);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement)
          .sort((a, b) => items.indexOf(a) - items.indexOf(b))
          .forEach((item, order) => {
            observer.unobserve(item);
            reveal(item, order);
          });
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return ref;
}

/** Zpoždění nástupu pro n-tý prvek horní části obrazovky účtu. */
export function riseDelay(index: number): CSSProperties {
  return { animationDelay: `${index * STAGGER_MS}ms` };
}

function Perk({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <li data-seen="false" className="animate-rise border-line overflow-hidden rounded-panel border">
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
          mine ? "bg-accent text-on-accent" : "bg-paper border-line text-ink border"
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

/** Připomínka série, jak přijde na zamčenou obrazovku. */
function ReminderPerkPreview() {
  const t = useTranslations("notifications");
  const tPush = useTranslations("push");

  return (
    <Notice
      className="mx-auto max-w-72"
      app={t("previewApp")}
      time="19:00"
      title={tPush("streakTitle", { days: 12 })}
      body={tPush("streakBody", { fresh: "no", variant: "a" })}
    />
  );
}
