// Přihlašovací e-maily a jejich nastavení v Supabase.
//
//   node scripts/supabase/auth-emails.mjs --preview   → out-emails/*.html k prohlédnutí
//   node scripts/supabase/auth-emails.mjs --push      → nahraje šablony, SMTP a délku kódu
//
// --push čte z prostředí SUPABASE_ACCESS_TOKEN (osobní token ze Supabase)
// a SMTP_PASSWORD (heslo schránky miligram@lukasgurecky.cz), typicky:
//   set -a; . ./.env.secrets.local; . ./.env.local; set +a; node scripts/supabase/auth-emails.mjs --push
//
// Šablony se v dashboardu Supabase needitují — zdroj pravdy je tenhle soubor.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APP_URL = "https://miligram-app.pages.dev";
const SENDER = { name: "Miligram", email: "miligram@lukasgurecky.cz" };

/**
 * Délka a platnost kódu. Aplikace slibuje „šestimístný kód“ a pole
 * ho po šesti číslicích odešle, takže délka musí sedět přesně. Platnost
 * se vypisuje do e-mailu — mění se jen tady, aby text nelhal.
 */
const OTP_LENGTH = 6;
const OTP_MINUTES = 15;

/* Barvy z tokenů aplikace (src/app/globals.css). Tmavé varianty aplikace
   nemá; e-mail je potřebuje, protože Apple Mail v tmavém režimu jinak
   světlý e-mail přebarví po svém. */
const C = {
  surface: "#f2f4f8",
  paper: "#ffffff",
  line: "#e2e6ee",
  ink: "#0e1116",
  inkSoft: "#5a6472",
  accent: "#3730d9",
  accentWash: "#eeedfb",
  accentWashLine: "#d9d6f6",
};
const D = {
  surface: "#0b0d11",
  paper: "#151920",
  line: "#262c36",
  ink: "#eef1f6",
  inkSoft: "#98a2b0",
  accent: "#b3adff",
  accentWash: "#1e1b45",
  accentWashLine: "#332d78",
};

const SANS = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

/**
 * Jeden e-mail s kódem. Kód stojí samostatně, velký a strojopisem —
 * opisuje se číslice po číslici, takže musí mít stejnou šířku a nesmí
 * obsahovat mezery, které by se vložily s ním. Oddělení číslic dělá jen
 * prostrkání písma.
 */
function codeEmail({ lang, eyebrow, heading, lead, preheader, validity, ignore, sentTo, question }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${heading}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { color:${C.accent}; }
  @media (max-width:520px) {
    .card { padding:28px 22px !important; }
    .code { font-size:34px !important; letter-spacing:8px !important; padding-left:8px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .bg { background:${D.surface} !important; }
    .card { background:${D.paper} !important; border-color:${D.line} !important; }
    .ink { color:${D.ink} !important; }
    .soft { color:${D.inkSoft} !important; }
    .rule { border-color:${D.line} !important; }
    .codebox { background:${D.accentWash} !important; border-color:${D.accentWashLine} !important; }
    .code { color:${D.accent} !important; }
    a { color:${D.accent} !important; }
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${C.surface};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.surface};">
<tr><td align="center" style="padding:36px 16px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

    <tr><td style="padding:0 2px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;"><img src="${APP_URL}/icons/icon-96.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:8px;"></td>
        <td class="ink" style="vertical-align:middle;padding-left:10px;font-family:${SANS};font-size:18px;font-weight:600;letter-spacing:-0.2px;color:${C.ink};">Miligram</td>
      </tr></table>
    </td></tr>

    <tr><td class="card" style="background:${C.paper};border:1px solid ${C.line};border-radius:12px;padding:36px 32px;">
      <p class="soft" style="margin:0 0 10px;font-family:${MONO};font-size:12px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:${C.inkSoft};">${eyebrow}</p>
      <h1 class="ink" style="margin:0 0 10px;font-family:${SANS};font-size:24px;line-height:1.25;font-weight:600;color:${C.ink};">${heading}</h1>
      <p class="soft" style="margin:0 0 24px;font-family:${SANS};font-size:16px;line-height:1.5;color:${C.inkSoft};">${lead}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="codebox" align="center" style="background:${C.accentWash};border:1px solid ${C.accentWashLine};border-radius:4px;padding:22px 12px;">
          <span class="code" style="display:inline-block;padding-left:12px;font-family:${MONO};font-size:40px;line-height:1;font-weight:500;letter-spacing:12px;color:${C.accent};">{{ .Token }}</span>
        </td>
      </tr></table>

      <p class="soft" style="margin:14px 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.inkSoft};text-align:center;">${validity}</p>

      <!-- Mezera řádkem tabulky: okraje buněk poštovní klienti nedrží. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:28px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td class="rule" style="border-top:1px solid ${C.line};height:1px;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
      <p class="soft" style="margin:20px 0 0;font-family:${SANS};font-size:14px;line-height:1.55;color:${C.inkSoft};">${ignore}</p>
    </td></tr>

    <tr><td style="padding:22px 4px 0;">
      <p class="soft" style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.inkSoft};">${sentTo(`<a href="${APP_URL}" style="color:${C.accent};text-decoration:none;">Miligram</a>`)}</p>
      <p class="soft" style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.inkSoft};">${question}</p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>
`;
}

/**
 * Jazyk e-mailu podle účtu. Supabase má na každý druh e-mailu jednu
 * šablonu, takže obě jazykové verze jsou v ní a vybírá mezi nimi
 * `locale` z metadat uživatele. Aplikace ho zapíše při založení účtu
 * a srovná po přihlášení i při přepnutí jazyka (src/components/SyncAgent.tsx).
 * Účet bez údaje dostane češtinu.
 */
const LOCALES = ["cs", "sk"];
const byLocale = (render) => `{{ if eq .Data.locale "sk" }}${render("sk")}{{ else }}${render("cs")}{{ end }}`;

/** Předmět nese kód, aby byl vidět už v notifikaci a telefon ho mohl nabídnout sám. */
const SUBJECTS = {
  cs: "{{ .Token }} je tvůj kód do Miligramu",
  sk: "{{ .Token }} je tvoj kód do Miligramu",
};

const COMMON = {
  cs: {
    validity: `Platí ${OTP_MINUTES}&nbsp;minut a&nbsp;použít jde jen jednou.`,
    ignore: "Kód nepotřebuješ? Tak e-mail klidně smaž. Bez kódu se do účtu nikdo nedostane.",
    sentTo: (app) => `Kód jsme poslali na {{ .Email }}, protože tahle adresa byla zadaná v&nbsp;aplikaci ${app}.`,
    question: "Máš otázku? Stačí odpovědět na tenhle e-mail.",
  },
  sk: {
    validity: `Platí ${OTP_MINUTES}&nbsp;minút a&nbsp;použiť sa dá len raz.`,
    ignore: "Kód nepotrebuješ? Tak e-mail pokojne zmaž. Bez kódu sa do účtu nikto nedostane.",
    sentTo: (app) => `Kód sme poslali na {{ .Email }}, pretože táto adresa bola zadaná v&nbsp;aplikácii ${app}.`,
    question: "Máš otázku? Stačí odpovedať na tento e-mail.",
  },
};

// Stávající účet dostane šablonu „magic link“, nový „confirmation“ —
// signInWithOtp mezi nimi rozhoduje sám podle toho, jestli účet existuje.
const TEXTS = {
  magic_link: {
    cs: {
      eyebrow: "Přihlášení",
      heading: "Tvůj přihlašovací kód",
      lead: "Opiš ho do aplikace Miligram.",
      preheader: `Kód platí ${OTP_MINUTES} minut. Opiš ho do aplikace Miligram.`,
    },
    sk: {
      eyebrow: "Prihlásenie",
      heading: "Tvoj prihlasovací kód",
      lead: "Prepíš ho do aplikácie Miligram.",
      preheader: `Kód platí ${OTP_MINUTES} minút. Prepíš ho do aplikácie Miligram.`,
    },
  },
  confirmation: {
    cs: {
      eyebrow: "Nový účet",
      heading: "Vítej v Miligramu",
      lead: "Zbývá opsat kód do aplikace a účet je hotový.",
      preheader: `Kód platí ${OTP_MINUTES} minut. Opiš ho do aplikace a účet je hotový.`,
    },
    sk: {
      eyebrow: "Nový účet",
      heading: "Vitaj v Miligrame",
      lead: "Zostáva prepísať kód do aplikácie a účet je hotový.",
      preheader: `Kód platí ${OTP_MINUTES} minút. Prepíš ho do aplikácie a účet je hotový.`,
    },
  },
};

const render = (kind, lang) => codeEmail({ lang, ...COMMON[lang], ...TEXTS[kind][lang] });

const EMAILS = {
  magic_link: byLocale((lang) => render("magic_link", lang)),
  confirmation: byLocale((lang) => render("confirmation", lang)),
};
const SUBJECT = byLocale((lang) => SUBJECTS[lang]);

async function preview() {
  const dir = path.join(ROOT, "out-emails");
  await mkdir(dir, { recursive: true });
  for (const kind of Object.keys(TEXTS)) {
    for (const lang of LOCALES) {
      const sample = render(kind, lang)
        .replaceAll("{{ .Token }}", "482915")
        .replaceAll("{{ .Email }}", "student@example.cz");
      await writeFile(path.join(dir, `${kind}.${lang}.html`), sample, "utf8");
    }
  }
  console.log(`Náhledy v ${path.relative(ROOT, dir)}/`);
}

async function push() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const password = process.env.SMTP_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !password || !url) {
    throw new Error("Chybí SUPABASE_ACCESS_TOKEN, SMTP_PASSWORD nebo NEXT_PUBLIC_SUPABASE_URL v prostředí.");
  }
  const ref = new URL(url).hostname.split(".")[0];

  const body = {
    smtp_host: "smtp.seznam.cz",
    smtp_port: "465",
    smtp_user: SENDER.email,
    smtp_pass: password,
    smtp_admin_email: SENDER.email,
    smtp_sender_name: SENDER.name,
    // Vestavěné SMTP Supabase pouští dva e-maily za hodinu na celý projekt.
    // S vlastním serverem je strop náš. 30 za hodinu by při spuštění
    // nestačilo, když se v jedné hodině přihlásí pár desítek lidí; 100 ještě
    // brání zneužití.
    rate_limit_email_sent: 100,
    mailer_otp_length: OTP_LENGTH,
    mailer_otp_exp: OTP_MINUTES * 60,
    mailer_subjects_magic_link: SUBJECT,
    mailer_subjects_confirmation: SUBJECT,
    mailer_templates_magic_link_content: EMAILS.magic_link,
    mailer_templates_confirmation_content: EMAILS.confirmation,
  };

  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Supabase odmítl nastavení: ${response.status} ${await response.text()}`);
  console.log("Nahráno: SMTP, šablony magic_link a confirmation, délka a platnost kódu.");
}

const mode = process.argv[2];
if (mode === "--preview") await preview();
else if (mode === "--push") await push();
else console.log("Použití: --preview | --push");
