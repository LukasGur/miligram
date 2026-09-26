"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import { parseInvite } from "@/lib/social";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/**
 * Skener QR kódu kamaráda přímo v aplikaci.
 *
 * Kód z foťáku by na iPhonu otevřel Safari, které přihlášení z plochy
 * nevidí. Kamera uvnitř aplikace tu past obchází: kód se přečte tady
 * a žádost odejde z účtu, který je přihlášený.
 *
 * Kde prohlížeč umí BarcodeDetector (Android), čte se jím; jinde (Safari)
 * knihovnou jsQR, která se stáhne až s otevřením skeneru.
 */
export function QrScanner({ onResult, onClose }: { onResult: (handle: string) => void; onClose: () => void }) {
  const t = useTranslations("social");
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<"denied" | "unavailable" | null>(null);
  const [foreign, setForeign] = useState(false);
  // Kamera se nesmí restartovat jen proto, že rodič poslal novou funkci.
  const report = useRef(onResult);
  useEffect(() => {
    report.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let last = 0;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch (reason) {
        setError(reason instanceof DOMException && reason.name === "NotAllowedError" ? "denied" : "unavailable");
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});

      const Native = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;

      const tick = async (time: number) => {
        if (stopped) return;
        frame = requestAnimationFrame(tick);
        // Pětkrát za vteřinu stačí a telefon se nezahřeje.
        if (time - last < 200 || !video.current || video.current.readyState < 2) return;
        last = time;

        let text: string | null = null;
        if (detector) {
          const found = await detector.detect(video.current).catch(() => []);
          text = found[0]?.rawValue ?? null;
        } else if (jsQR && context) {
          const width = video.current.videoWidth;
          const height = video.current.videoHeight;
          const scale = Math.min(1, 640 / Math.max(width, height));
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          context.drawImage(video.current, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          text = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
        }
        if (!text) return;
        const handle = parseInvite(text);
        if (handle) {
          stopped = true;
          report.current(handle);
        } else {
          setForeign(true);
        }
      };
      frame = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={t("scanTitle")}>
      <div className="flex items-center justify-between px-3" style={{ paddingTop: "calc(var(--sa-t) + 0.5rem)" }}>
        <p className="pl-2 text-heading font-semibold">{t("scanTitle")}</p>
        <button type="button" onClick={onClose} aria-label={t("close")} className="flex size-11 items-center justify-center">
          <CloseIcon className="size-6" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />
        {/* Hledáček: čtverec s rohy, zbytek ztlumený. */}
        <div className="relative size-64 rounded-panel shadow-[0_0_0_100vmax_rgba(0,0,0,0.55)]">
          {["top-0 left-0 border-t-4 border-l-4", "top-0 right-0 border-t-4 border-r-4", "bottom-0 left-0 border-b-4 border-l-4", "right-0 bottom-0 border-r-4 border-b-4"].map(
            (corner) => (
              <span key={corner} className={`absolute size-8 rounded-[4px] border-white ${corner}`} />
            ),
          )}
        </div>
      </div>

      <p className="px-6 pt-4 text-center text-label text-white/80" style={{ paddingBottom: "calc(var(--sa-b) + 1.5rem)" }}>
        {error === "denied" ? t("scanDenied") : error === "unavailable" ? t("scanUnavailable") : foreign ? t("scanForeign") : t("scanHint")}
      </p>
    </div>
  );
}
