"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";

/**
 * Přihlášení kódem z e-mailu.
 *
 * Ne odkazem: odkaz otevře prohlížeč a uživatele z aplikace přidané na
 * plochu vytáhne ven, odkud se zpátky nedostane. Šestimístný kód se opíše
 * a přihlášení se dokončí tam, kde začalo.
 */
export function SignIn() {
  const t = useTranslations("account");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const client = supabase();
    if (!client || busy) return;
    setBusy(true);
    setError(null);
    const { error: sendError } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (sendError) setError(sendError.message);
    else setSent(true);
  }

  async function verify() {
    const client = supabase();
    if (!client || busy) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await client.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (verifyError) setError(verifyError.message);
  }

  return (
    <section>
      <h2 className="text-heading font-semibold">{t("signedOutTitle")}</h2>
      <p className="text-ink-soft mt-1.5 text-label">{t("signedOutBody")}</p>

      {sent ? (
        <div className="mt-5">
          <p className="text-label">{t("codeSent", { email })}</p>
          <Field
            label={t("code")}
            value={code}
            onChange={setCode}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <Primary onClick={verify} disabled={busy || code.trim().length < 6}>
            {t("verify")}
          </Primary>
          <button
            type="button"
            onClick={() => { setSent(false); setCode(""); }}
            className="text-accent mt-3 min-h-11 text-label font-medium"
          >
            {t("otherEmail")}
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <Field
            label={t("email")}
            value={email}
            onChange={setEmail}
            inputMode="email"
            autoComplete="email"
          />
          <Primary onClick={send} disabled={busy || !email.includes("@")}>
            {t("sendCode")}
          </Primary>
        </div>
      )}

      {error ? <p className="text-danger mt-3 text-label">{error}</p> : null}
    </section>
  );
}

export function Field({
  label,
  value,
  onChange,
  inputMode,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "email" | "numeric" | "text";
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-ink-soft text-micro">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="border-line bg-paper mt-1 min-h-12 w-full rounded-control border px-3 text-body"
      />
    </label>
  );
}

export function Primary({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bg-accent active:bg-accent-press mt-4 min-h-12 w-full rounded-control text-body font-semibold text-white transition-colors duration-75 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
