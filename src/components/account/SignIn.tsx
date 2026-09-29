"use client";

import { useEffect, useRef, useState, type FormEvent, type Ref } from "react";
import { useTranslations } from "next-intl";
import { PillTag } from "@/components/ui/PillTag";
import { Spinner } from "@/components/ui/Spinner";
import { SIGNUP_BONUS } from "@/core/economy";
import { withTimeout } from "@/lib/useAction";
import type { AuthError } from "@supabase/supabase-js";
import { useLocale } from "@/i18n/LocaleProvider";
import { supabase } from "@/lib/supabase";
import { MailCheckIcon } from "@/components/icons";
import { reducedMotion } from "@/components/ui/Flyer";
import { CodeInput } from "./CodeInput";
import { Perks, riseDelay } from "./Perks";
import { PrivacyLink } from "@/components/PrivacySheet";

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
  const [failedAttempts, setFailedAttempts] = useState(0);
  const emailInput = useRef<HTMLInputElement>(null);

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
    let sendError: AuthError | null;
    try {
      ({ error: sendError } = await withTimeout(
        client.auth.signInWithOtp({
          email: email.trim(),
          // Jazyk e-mailu: nový účet ho dostane rovnou, u stávajícího
          // Supabase `data` nezapíše a srovná ho až SyncAgent po přihlášení.
          options: { shouldCreateUser: true, data: { locale } },
        }),
      ));
    } catch {
      // Výjimka místo vrácené chyby (výpadek, časový limit): tlačítko
      // se nesmí zaseknout ve stavu „odesílá se“.
      setBusy(false);
      setError("errorGeneric");
      return;
    }
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
    let verifyError: AuthError | null;
    try {
      ({ error: verifyError } = await withTimeout(client.auth.verifyOtp({ email: email.trim(), token, type: "email" })));
    } catch {
      setBusy(false);
      setError("errorGeneric");
      return;
    }
    setBusy(false);
    if (verifyError) {
      setError(errorKey(verifyError));
      setFailedAttempts((count) => count + 1);
    }
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

  /**
   * Kdo dočte výhody, je dole a formulář zmizel nahoře. Kurzor jde do pole
   * hned, ještě v ťuknutí — jinak iPhone klávesnici neukáže.
   */
  function backToForm() {
    const input = emailInput.current;
    if (!input) return;
    input.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    input.focus({ preventScroll: true });
  }

  return (
    <section>
      {sent ? (
        <h2 className="text-heading font-semibold">{t("codeTitle")}</h2>
      ) : (
        <div className="animate-rise pt-2" style={riseDelay(0)}>
          <p className="panel-label !text-accent">{t("pitchEyebrow")}</p>
          <h2 className="text-title mt-1.5 font-semibold">{t("pitchTitle")}</h2>
        </div>
      )}

      {sent ? (
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
        >
          <div className="animate-tick bg-accent-wash rounded-panel flex gap-3 p-4">
            <MailCheckIcon className="text-accent mt-0.5 size-6 shrink-0" />
            <div className="min-w-0">
              <p className="text-label">
                {t.rich("codeSent", {
                  email: email.trim(),
                  strong: (chunks) => <strong className="font-semibold [overflow-wrap:anywhere]">{chunks}</strong>,
                })}
              </p>
              <p className="text-ink-soft mt-1 text-label">{t("codeHint", { minutes: CODE_VALID_MINUTES })}</p>
            </div>
          </div>
          <div className="mt-6">
            <CodeInput
              label={t("code")}
              value={code}
              onChange={changeCode}
              length={CODE_LENGTH}
              invalid={error === "errorCode"}
              pending={busy}
              attempt={failedAttempts}
              describedBy={error ? "sign-in-error" : undefined}
            />
            {error ? <ErrorMessage text={t(error)} /> : null}
          </div>
          <Primary onClick={() => void verify(code)} busy={busy} disabled={code.length !== CODE_LENGTH}>
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
        <>
          {/* Formulář první: kdo sem přišel založit účet, nemá co hledat
              pod výhodami. Kdo se teprve rozhoduje, najde je hned pod ním. */}
          <form className="animate-rise mt-6" style={riseDelay(1)} onSubmit={send}>
            <Field
              label={t("email")}
              value={email}
              onChange={setEmail}
              inputMode="email"
              autoComplete="email"
              inputRef={emailInput}
            />
            <Primary onClick={() => void send()} busy={busy} disabled={!email.includes("@")}>
              {t("sendCode")}
            </Primary>
            {error ? <ErrorMessage text={t(error)} /> : null}
            <p className="text-ink-soft mt-3 text-center text-label">{t("signInNote")}</p>
            {/* div, ne p: odkaz si nese list, a ten v odstavci být nesmí. */}
            <div className="text-ink-soft mt-1 text-center text-micro">
              {t.rich("signInPrivacy", { link: (chunks) => <PrivacyLink className="min-h-11">{chunks}</PrivacyLink> })}
            </div>
            {/* Bonus jako cenovka, ne jako věta — informace, ne přemlouvání. */}
            <p className="mt-2 flex justify-center text-label">
              <PillTag>{t("perkBonusTitle", { count: SIGNUP_BONUS })}</PillTag>
            </p>
          </form>

          {/* Výhody jen do chvíle, než odejde kód. Pak už je rozhodnuto a obrazovka
              patří políčkům kódu, která musí zůstat vidět nad klávesnicí. */}
          <h3 className="animate-rise mt-10 text-heading font-semibold" style={riseDelay(2)}>
            {t("perksTitle")}
          </h3>
          <Perks />
          <div className="mt-2">
            <Primary onClick={backToForm}>
              {t("perksBackToForm")}
              <span className="text-label">
                <PillTag>
                  <span className="num" data-numeric aria-hidden>
                    +{SIGNUP_BONUS}
                  </span>
                  <span className="sr-only">{t("perkBonusTitle", { count: SIGNUP_BONUS })}</span>
                </PillTag>
              </span>
            </Primary>
          </div>
        </>
      )}
    </section>
  );
}

/** Hláška patří k poli, kterého se týká — u kódu hned pod políčka. */
function ErrorMessage({ text }: { text: string }) {
  return (
    <p id="sign-in-error" role="alert" className="text-danger mt-3 text-label">
      {text}
    </p>
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
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "email" | "text";
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="panel-label">{label}</span>
      <input
        ref={inputRef}
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
        className="border-line bg-paper rounded-readout mt-1.5 min-h-12 w-full border px-3 text-body"
      />
    </label>
  );
}

export function Primary({
  onClick,
  disabled,
  busy = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** Odesílá se: zašedlé se spinnerem. */
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className="bg-accent active:bg-accent-press mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-control text-body font-semibold text-white transition-colors duration-75 disabled:opacity-40"
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
