import React, { useEffect, useRef, useState } from "react";
import type { AdSettings } from "./advertisingTypes";
let scriptPromise: Promise<void> | undefined;
let scriptClient = "";
function loadAdSense(client: string) {
  if (scriptPromise)
    return scriptClient === client
      ? scriptPromise
      : Promise.reject(
          new Error("Recarregue a página para atualizar o editor."),
        );
  scriptClient = client;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Publicidade indisponível"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}
export default function GoogleBanner({ settings }: { settings: AdSettings }) {
  const [allowed, setAllowed] = useState(false);
  const [failed, setFailed] = useState(false);
  const ad = useRef<HTMLModElement>(null);
  const valid =
    /^ca-pub-\d{16}$/.test(settings.adsense_client) &&
    /^\d{10}$/.test(settings.adsense_slot);
  const hostname = window.location.hostname;
  const local =
    hostname === "localhost" ||
    !hostname.includes(".") ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname) ||
    hostname === "[::1]";
  const enabled =
    settings.adsense_enabled &&
    valid &&
    !local &&
    location.protocol === "https:";
  useEffect(() => {
    if (!enabled || !allowed) return;
    let stopped = false;
    loadAdSense(settings.adsense_client)
      .then(() => {
        if (stopped || !ad.current || ad.current.dataset.adsbygoogleStatus)
          return;
        const target = window as unknown as { adsbygoogle: unknown[] };
        target.adsbygoogle = target.adsbygoogle || [];
        target.adsbygoogle.push({});
      })
      .catch(() => {
        if (!stopped) setFailed(true);
      });
    return () => {
      stopped = true;
    };
  }, [enabled, allowed, settings.adsense_client, settings.adsense_slot]);
  if (!enabled || failed) return null;
  return (
    <section
      aria-label="Publicidade Google"
      style={{
        margin: "24px 0",
        padding: "20px 0",
        borderTop: "1px solid #e9e1e4",
        borderBottom: "1px solid #e9e1e4",
        textAlign: "center",
        fontFamily: "DMSans400",
        color: "#706570",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 12 }}>
        PUBLICIDADE
      </div>
      {allowed ? (
        <>
          <ins
            ref={ad}
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client={settings.adsense_client}
            data-ad-slot={settings.adsense_slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
          <button
            onClick={() => setAllowed(false)}
            style={{
              marginTop: 12,
              border: 0,
              background: "none",
              color: "#922C51",
              padding: 12,
              cursor: "pointer",
            }}
          >
            Ocultar anúncios nesta página
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, lineHeight: "22px", margin: 0 }}>
            Você pode permitir o carregamento de anúncios do Google nesta
            página.
          </p>
          <button
            onClick={() => setAllowed(true)}
            style={{
              marginTop: 10,
              background: "#f9eaf0",
              border: "1px solid #e7cbd7",
              borderRadius: 12,
              padding: "12px 18px",
              color: "#922c51",
              cursor: "pointer",
              fontFamily: "DMSans600",
            }}
          >
            Permitir anúncios Google
          </button>
        </>
      )}
    </section>
  );
}
