"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronRightIcon } from "@/components/icons";
import { LeagueInsignia } from "@/components/ui/LeagueInsignia";
import { Monogram } from "@/components/ui/Monogram";
import { Spinner } from "@/components/ui/Spinner";
import { useAction, withTimeout } from "@/lib/useAction";
import { acceptFriend, declineFriend, requestFriend } from "@/lib/remote";
import { inviteUrl, parseInvite } from "@/lib/social";
import { Field } from "@/components/account/SignIn";
import type { Social } from "./data";
import { QrCode } from "./QrCode";
import { QrScanner } from "./QrScanner";
import { Screen, SectionTitle } from "./Screen";
import { Button } from "@/components/ui/Button";

/**
 * Přátelé: žádosti, seznam a přidání.
 *
 * Tři cesty k novému kamarádovi, podle toho, kde je:
 *  - vedle na semináři — ukázat QR, on ho naskenuje ve svém Miligramu,
 *  - na dálku — poslat odkaz,
 *  - záloha — přezdívka nebo pozvánka vložená ze schránky.
 */
export function FriendsScreen({
  social,
  onBack,
  onFriend,
}: {
  social: Social;
  onBack: () => void;
  onFriend: (userId: string) => void;
}) {
  const t = useTranslations("social");
  const format = useFormatter();
  const friends = social.friends.data ?? [];
  const requests = social.requests.data ?? [];

  const action = useAction();
  /** Žádost a volba, která se právě odesílá — spinner patří na ni. */
  const [pending, setPending] = useState<{ requester: string; accept: boolean } | null>(null);

  function respond(requester: string, accept: boolean) {
    setPending({ requester, accept });
    void action
      .run(async () => {
        // Žádosti, kamarádi i žebříček se obnoví samy (mutated v remote.ts).
        if (accept) await acceptFriend(social.client, social.userId, requester);
        else await declineFriend(social.client, social.userId, requester);
      })
      .finally(() => setPending(null));
  }

  return (
    <Screen title={t("friendsTitle")} onBack={onBack}>
      {requests.length > 0 ? (
        <>
          <p className="panel-label mt-1 mb-1">{t("requestsTitle")}</p>
          <ul>
            {requests.map((request) => (
              <li key={request.requester} className="border-line flex min-h-16 items-center gap-3 border-b py-2">
                <Monogram handle={request.handle} size="sm" />
                <span className="min-w-0 flex-1 truncate text-body font-semibold">{request.handle}</span>
                <Button
                  disabled={action.busy}
                  onClick={() => respond(request.requester, false)}
                  variant="secondary" size="md" tone="muted" className="gap-2"
                >
                  {pending?.requester === request.requester && !pending.accept ? <Spinner className="size-4" /> : null}
                  {t("decline")}
                </Button>
                <Button
                  disabled={action.busy}
                  onClick={() => respond(request.requester, true)}
                  size="md"
                >
                  {pending?.requester === request.requester && pending.accept ? <Spinner className="size-4" /> : null}
                  {t("accept")}
                </Button>
              </li>
            ))}
          </ul>
          {action.failed ? (
            <p className="text-ink-soft mt-2 text-label" role="status">
              {t("errorNetwork")}
            </p>
          ) : null}
        </>
      ) : null}

      {friends.length > 0 ? (
        <>
          <p className={`panel-label mb-1 ${requests.length > 0 ? "mt-7" : "mt-1"}`} data-numeric>
            {t("friendsCount", { count: friends.length })}
          </p>
          <ul>
            {friends.map((friend) => (
              <li key={friend.userId}>
                <button
                  type="button"
                  onClick={() => onFriend(friend.userId)}
                  className="border-line active:bg-surface flex min-h-16 w-full items-center gap-3 border-b py-2 text-left"
                >
                  <Monogram handle={friend.handle} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold">{friend.handle}</span>
                    <span className="text-ink-soft block text-micro" data-numeric>
                      {t("friendWeekLine", { xp: format.number(friend.xpWeek), streak: friend.streak })}
                    </span>
                  </span>
                  <LeagueInsignia tier={friend.tier} />
                  <ChevronRightIcon className="text-ink-soft size-5 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <AddFriend social={social} first={friends.length === 0 && requests.length === 0} />
    </Screen>
  );
}

function AddFriend({ social, first }: { social: Social; first: boolean }) {
  const t = useTranslations("social");
  const tAccount = useTranslations("account");
  const handle = social.profile.data?.handle ?? "";
  const link = handle ? inviteUrl(handle) : "";
  const [scanning, setScanning] = useState(false);
  const [typed, setTyped] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(target: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await withTimeout(requestFriend(social.client, social.userId, target));
      if (result.ok) {
        setTyped("");
        setNotice(t("requestSent", { handle: target }));
      } else {
        setNotice(
          tAccount(result.reason === "notFound" ? "friendNotFound" : result.reason === "self" ? "friendSelf" : "friendDuplicate"),
        );
      }
    } catch {
      setNotice(t("errorNetwork"));
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    // Odkaz patří do textu, ne do `url`: „Kopírovat“ ve sdílení na iPhonu
    // bere jen text a `url` by zahodilo.
    const text = `${t("shareText", { handle })} ${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Miligram", text });
        return;
      }
    } catch (error) {
      // Zavřený výběr sdílení není chyba.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setNotice(t("linkCopied"));
    } catch {
      setNotice(link);
    }
  }

  async function paste() {
    setNotice(null);
    try {
      const found = parseInvite(await navigator.clipboard.readText());
      if (found) await add(found);
      else setNotice(t("pasteEmpty"));
    } catch {
      setNotice(t("pasteDenied"));
    }
  }

  return (
    <>
      <SectionTitle>{first ? t("addFirstFriend") : t("addFriend")}</SectionTitle>
      {handle ? (
        <div className="border-line flex flex-col items-center gap-3 rounded-panel border px-4 py-5">
          <QrCode value={link} label={t("qrLabel", { handle })} className="size-48" />
          <span className="readout text-heading font-semibold">{handle}</span>
          <span className="text-ink-soft max-w-64 text-center text-label">{t("qrHint")}</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        <Button variant="secondary" tone="muted" size="md" className="w-full" onClick={() => setScanning(true)}>
          <ScanIcon className="size-5" />
          {t("scan")}
        </Button>
        {handle ? (
          <Button variant="secondary" tone="muted" size="md" className="w-full" onClick={() => void share()}>
            <ShareIcon className="size-5" />
            {t("sendLink")}
          </Button>
        ) : null}
      </div>

      <p className="text-ink-soft my-5 flex items-center gap-3 text-micro before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        {t("orByHandle")}
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label={tAccount("friendHandle")} value={typed} onChange={setTyped} inputMode="text" />
        </div>
        <Button
          onClick={() => {
            const target = parseInvite(typed);
            if (target) void add(target);
            else setNotice(tAccount("handleInvalid"));
          }}
          disabled={busy || typed.trim().length < 3}
          size="md" className="shrink-0"
        >
          {busy ? <Spinner className="size-4" /> : null}
          {tAccount("friendAdd")}
        </Button>
      </div>
      <Button variant="text" className="mt-1" onClick={() => void paste()}>
        {t("pasteInvite")}
      </Button>
      {notice ? (
        <p className="text-ink-soft mt-1 text-label" role="status">
          {notice}
        </p>
      ) : null}

      {scanning ? (
        <QrScanner
          onClose={() => setScanning(false)}
          onResult={(found) => {
            setScanning(false);
            void add(found);
          }}
        />
      ) : null}
    </>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <path d="M7 12h10" />
      </g>
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v13" />
        <path d="m16 6-4-4-4 4" />
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      </g>
    </svg>
  );
}
