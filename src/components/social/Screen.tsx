"use client";

import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";

/**
 * Rámec podobrazovky profilu: hlavička se zpět nebo zavřením, rolovací
 * obsah a volitelná lišta dole pro hlavní akci (ve spodní třetině, kam
 * dosáhne palec).
 */
export function Screen({
  title,
  onBack,
  onClose,
  aside,
  footer,
  refresh = "/?open=account",
  children,
}: {
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  /** Kam se aplikace přenačte, když obnova potažením nepomůže. */
  refresh?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("social");
  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <header
        className="app-chrome flex min-h-14 shrink-0 items-center gap-1 px-2 pb-1"
        style={{ paddingTop: "calc(var(--sa-t) + 0.5rem)" }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("back")}
            className="text-ink-soft flex size-11 shrink-0 items-center justify-center"
          >
            <BackIcon className="size-6" />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-heading font-semibold">{title}</h1>
        {aside}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="text-ink-soft flex size-11 shrink-0 items-center justify-center"
          >
            <CloseIcon className="size-6" />
          </button>
        ) : null}
      </header>

      <main tabIndex={0} data-refresh={refresh} className="scroll-y flex-1">
        <div className="mx-auto w-full max-w-md px-5 pb-8">{children}</div>
      </main>

      {footer ? (
        <footer
          className="app-chrome bg-paper border-line shrink-0 border-t"
          style={{ paddingBottom: "calc(var(--sa-b) + 0.75rem)" }}
        >
          <div className="mx-auto w-full max-w-md px-5 pt-3">{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Nadpis oddílu s volitelným údajem vpravo. */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-heading font-semibold">{children}</h2>
      {aside}
    </div>
  );
}
