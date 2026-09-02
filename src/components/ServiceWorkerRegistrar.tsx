"use client";

import { useEffect } from "react";

/**
 * Service worker se registruje jen z produkčního buildu — v `next dev`
 * by přednačtený shell zakonzervoval starý kód a vývoj by se stal
 * nedohledatelně divným.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    /**
     * Nový worker se aktivuje hned (skipWaiting), takže by běžící stránka
     * načítala chunky z buildu, který už v cache není. Jedno přenačtení
     * při převzetí kontroly je proti tomu nejlevnější pojistka —
     * a při první instalaci se nespustí, protože tam controller chyběl.
     */
    const hadController = navigator.serviceWorker.controller !== null;
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Bez service workeru aplikace pořád funguje, jen ne offline.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
