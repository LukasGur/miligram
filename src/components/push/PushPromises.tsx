"use client";

import { useTranslations } from "next-intl";
import { CheckIcon } from "@/components/icons";

const POINTS = ["pointStreak", "pointFriends", "pointSettings"] as const;

/**
 * Co přesně přijde — a že se to dá vypnout. Stejný seznam v nabídce po
 * registraci i po lekci, ať obě slibují totéž.
 *
 * Jen věty, které uklidní. Omezení typu „nejvýš pár zpráv denně“ tu
 * schválně nejsou: zněla by, jako by bez nich hrozila záplava.
 */
export function PushPromises({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const t = useTranslations("notifications");

  return (
    <ul className={`space-y-3 ${className}`} style={style}>
      {POINTS.map((key) => (
        <li key={key} className="flex items-start gap-3 text-label">
          <span className="bg-accent-wash text-accent mt-px flex size-5 shrink-0 items-center justify-center rounded-full">
            <CheckIcon className="size-3.5" />
          </span>
          {t(key)}
        </li>
      ))}
    </ul>
  );
}
