"use client";

import { useTranslations } from "next-intl";
import { BackspaceIcon } from "@/components/icons";
import { pressable } from "@/lib/press";

/**
 * Numerická klávesnice.
 *
 * Vlastní, ne systémová. Důvody jsou tři: systémová klávesnice na iOS
 * překryje spodní třetinu obrazovky i s tlačítkem odpovědi, nabízí znaky,
 * které v odpovědi nedávají smysl, a mezi zařízeními vypadá pokaždé jinak.
 * Tady je jistota, že desetinná čárka je čárka a že se dá odpovědět palcem.
 */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export function Keypad({
  onAppend,
  onBackspace,
  disabled = false,
}: {
  onAppend: (character: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("lesson");

  return (
    <div className="app-chrome grid grid-cols-3 gap-2" role="group" aria-label={t("answerLabel")}>
      {KEYS.map((key) => (
        <Key key={key} label={key} onPress={() => onAppend(key)} disabled={disabled} />
      ))}
      <Key label="," ariaLabel={t("decimal")} onPress={() => onAppend(",")} disabled={disabled} />
      <Key label="0" onPress={() => onAppend("0")} disabled={disabled} />
      <Key ariaLabel={t("backspace")} onPress={onBackspace} disabled={disabled}>
        <BackspaceIcon className="size-6" />
      </Key>
    </div>
  );
}

function Key({
  label,
  ariaLabel,
  onPress,
  disabled,
  children,
}: {
  label?: string;
  ariaLabel?: string;
  onPress: () => void;
  disabled: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      {...pressable}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className="press bg-surface data-pressed:bg-surface-press readout text-ink flex min-h-12 items-center justify-center rounded-control text-title font-medium disabled:opacity-40"
    >
      {children ?? label}
    </button>
  );
}
