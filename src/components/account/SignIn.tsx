"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AuthError } from "@supabase/supabase-js";
import { useLocale } from "@/i18n/LocaleProvider";
import { supabase } from "@/lib/supabase";

/**
 * Délka a platnost kódu. Musí sedět s nastavením v Supabase, které nahrává
 * scripts/supabase/auth-emails.mjs — tam je stejné číslo i v textu e-mailu.
 */
const CODE_LENGTH = 6;
const CODE_VALID_MINUTES = 15;
/** Supabase pošle na stejnou adresu nejvýš jeden kód za minutu. */
const RESEND_AFTER_SECONDS = 60;

type ErrorKey = "errorCode" | "errorTooMany" | "errorEmail" | "errorGeneric";

/**
 * Chyby Supabase jsou anglické a technické („Token has expired or is
 * invalid“). Student potřebuje vědět, co dál: opsat kód znovu, počkat,
 * nebo opravit adresu.
 */
function errorKey(error: AuthError): ErrorKey {
  switch (error.code) {
    case "otp_expired":
      return "errorCode";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "errorTooMany";
    case "email_address_invalid":
    case "validation_failed":
      return "errorEmail";
  }
  return error.status === 429 ? "errorTooMany" : "errorGeneric";
}

/**
 * Přihlášení kódem z e-mailu.
 *
 * Ne odkazem: odkaz otevře prohlížeč a uživatele z aplikace přidané na
 * plochu vytáhne ven, odkud se zpátky nedostane. Šestimístný kód se opíše
 * a přihlášení se dokončí tam, kde začalo.
 *
 * Kód je i v předmětu e-mailu, takže ho telefon může nabídnout nad
 * klávesnicí. Po šesté číslici se přihlášení odešle samo — ťuknutí na
 * nabídnutý nebo vložení zkopírovaného kódu je tak celé přihlášení.
 */
export function SignIn() {
  const t = useTranslations("account");
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const client = supabase();
    if (!client || busy || !email.includes("@")) return;
    setBusy(true);
    setError(null);
    const { error: sendError } = await client.auth.signInWithOtp({
      email: email.trim(),
      // Jazyk e-mailu: nový účet ho dostane rovnou, u stávajícího
      // Supabase `data` nezapíše a srovná ho až SyncAgent po přihlášení.
      options: { shouldCreateUser: true, data: { locale } },
    });
    setBusy(false);
    if (sendError) {
      setError(errorKey(sendError));
      return;
    }
    setSent(true);
    setCode("");
    setResendIn(RESEND_AFTER_SECONDS);
  }

  async function verify(token: string) {
    const client = supabase();
    if (!client || busy || token.length !== CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await client.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    setBusy(false);
    if (verifyError) setError(errorKey(verifyError));
  }

  /**
   * Jen číslice a nejvýš šest. Vložený kód „482 915“ nebo s tečkou za ním
   * se tak nerozbije a po poslední číslici se rovnou ověří.
   */
  function changeCode(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (error === "errorCode") setError(null);
    if (digits.length === CODE_LENGTH) void verify(digits);
  }

  return (
    <section>
      <h2 className="text-heading font-semibold">{t("signedOutTitle")}</h2>
      <p className="text-ink-soft mt-1.5 text-label">{t("signedOutBody")}</p>

      {sent ? (
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
        >
          <p className="text-label">{t("codeSent", { email: email.trim() })}</p>
          <p className="text-ink-soft mt-1 mb-4 text-label">{t("codeHint", { minutes: CODE_VALID_MINUTES })}</p>
          <Field
            label={t("code")}
            value={code}
            onChange={changeCode}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          <Primary onClick={() => void verify(code)} disabled={busy || code.length !== CODE_LENGTH}>
            {t("verify")}
          </Primary>
          <div className="mt-3 flex flex-wrap justify-between gap-x-4">
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || resendIn > 0}
              className="text-accent min-h-11 text-label font-medium disabled:text-ink-soft"
            >
              {resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")}
            </button>
            <button
              type="button"
              onClick={() => { setSent(false); setCode(""); setError(null); }}
              className="text-accent min-h-11 text-label font-medium"
            >
              {t("otherEmail")}
            </button>
          </div>
        </form>
      ) : (
        <form className="mt-5" onSubmit={send}>
          <Field
            label={t("email")}
            value={email}
            onChange={setEmail}
            inputMode="email"
            autoComplete="email"
          />
          <Primary onClick={() => void send()} disabled={busy || !email.includes("@")}>
            {t("sendCode")}
          </Primary>
        </form>
      )}

      {error ? (
        <p role="alert" className="text-danger mt-3 text-label">
          {t(error)}
        </p>
      ) : null}
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
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "email" | "numeric" | "text";
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="panel-label">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        type={inputMode === "email" ? "email" : "text"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        /* Číselný kód se píše strojopisem — číslice mají stejnou šířku,
           takže se dá při opisování z e-mailu hlídat pozice. */
        className={`border-line bg-paper rounded-readout mt-1.5 min-h-12 w-full border px-3 text-body ${
          inputMode === "numeric" ? "readout tracking-[0.3em]" : ""
        }`}
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
