import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const YANDEX_METRIKA_ID = process.env.EXPO_PUBLIC_YANDEX_METRIKA_ID?.trim() ?? '';
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ??
  'https://api.adventu.ru/api';

// Keep the app root locked to the layout viewport so RN Web flex layout
// stays aligned when the browser zoom level changes.
const responsiveRootCss = `
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  overflow: hidden;
}

#root {
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
}

.user-card-body-scroll {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.28) transparent;
}

/* Horizontal deck swipe — don't let the browser steal the touch. */
[data-adv-swipe-deck] {
  touch-action: none !important;
}

.user-card-body-scroll::-webkit-scrollbar {
  width: 5px;
}

.user-card-body-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.user-card-body-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.28);
  border-radius: 999px;
}

.user-card-photo,
.user-card-photo img {
  -webkit-user-drag: none !important;
  user-drag: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  pointer-events: none;
}

.questionnaire-column {
  margin-left: auto !important;
  margin-right: auto !important;
}

/*
 * In-app toasts: Safari/Chrome paint Pressable as white <button> and ignore RN colors.
 * Colors come from CSS vars set on .adventura-toast by ToastBanner (theme), not data-theme.
 */
.adventura-toast {
  -webkit-appearance: none !important;
  appearance: none !important;
  background-image: none !important;
  background: var(--adventura-toast-bg, #1c1c1e) !important;
  background-color: var(--adventura-toast-bg, #1c1c1e) !important;
  border-color: var(--adventura-toast-border, #38383a) !important;
  color: var(--adventura-toast-fg, #ffffff) !important;
}

.adventura-toast [role="button"],
.adventura-toast button {
  -webkit-appearance: none !important;
  appearance: none !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  color: inherit !important;
  border: none !important;
  box-shadow: none !important;
}

.adventura-toast-title {
  color: var(--adventura-toast-fg, #ffffff) !important;
}

.adventura-toast-message {
  color: var(--adventura-toast-muted, #c7c7cc) !important;
}

.adventura-toast-action {
  background: var(--adventura-toast-action-bg, rgba(21, 122, 254, 0.22)) !important;
}

.adventura-toast-action-label {
  color: var(--adventura-toast-action-fg, #84b9ff) !important;
}

html[data-theme="light"] .adventura-toast {
  --adventura-toast-bg: #ffffff;
  --adventura-toast-fg: #000000;
  --adventura-toast-muted: #4c4c4c;
  --adventura-toast-border: #e8e8e8;
  --adventura-toast-action-bg: rgba(21, 122, 254, 0.12);
  --adventura-toast-action-fg: #157afe;
}

html[data-theme="dark"] .adventura-toast {
  --adventura-toast-bg: #1c1c1e;
  --adventura-toast-fg: #ffffff;
  --adventura-toast-muted: #c7c7cc;
  --adventura-toast-border: #38383a;
  --adventura-toast-action-bg: rgba(21, 122, 254, 0.22);
  --adventura-toast-action-fg: #84b9ff;
}

/*
 * Notification cards + wanderers list: same Safari Pressable→white <button> bug.
 * Shell View keeps surface; inner buttons stay transparent.
 */
.adventura-notification-card {
  -webkit-appearance: none !important;
  appearance: none !important;
  background-image: none !important;
  background: var(--adventura-notif-bg, #1c1c1e) !important;
  background-color: var(--adventura-notif-bg, #1c1c1e) !important;
  border-color: var(--adventura-notif-border, #2c2c2e) !important;
  color: var(--adventura-notif-fg, #ffffff) !important;
}

.adventura-notification-card [role="button"],
.adventura-notification-card [role="link"],
.adventura-notification-card button {
  -webkit-appearance: none !important;
  appearance: none !important;
  background-image: none !important;
  color: inherit !important;
  box-shadow: none !important;
}

.adventura-notification-card > [role="button"],
.adventura-notification-card > button {
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
}

.adventura-notification-title,
.adventura-notification-message {
  color: var(--adventura-notif-fg, #ffffff) !important;
}

.adventura-notification-actor {
  color: #157afe !important;
}

.adventura-notification-action {
  color: var(--adventura-notif-action, #9a7518) !important;
}

.adventura-notification-add {
  background: rgba(212, 175, 55, 0.14) !important;
  background-color: rgba(212, 175, 55, 0.14) !important;
  border-color: rgba(201, 162, 39, 0.45) !important;
}

.adventura-notification-muted {
  color: var(--adventura-notif-muted, #8e8e93) !important;
}

html[data-theme="light"] .adventura-notification-card {
  --adventura-notif-bg: #ffffff;
  --adventura-notif-fg: #000000;
  --adventura-notif-muted: #727272;
  --adventura-notif-border: #f6f6f6;
}

html[data-theme="dark"] .adventura-notification-card {
  --adventura-notif-bg: #1c1c1e;
  --adventura-notif-fg: #ffffff;
  --adventura-notif-muted: #8e8e93;
  --adventura-notif-border: #2c2c2e;
}

.adventura-wanderer-list-card > [role="button"],
.adventura-wanderer-list-card > button {
  -webkit-appearance: none !important;
  appearance: none !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
}
`;

/** Official snippet when ID is known at build time (helps Metrika HTML checker). */
function yandexMetrikaStaticBootstrap(counterId: string) {
  return `
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=${counterId}", "ym");
ym(${counterId}, "init", {
  defer:true,
  ssr:true,
  clickmap:true,
  trackLinks:true,
  accurateTrackBounce:true,
  webvisor:true,
  triggerEvent:true,
  referrer: document.referrer,
  url: location.href
});
window.__ADVENTURA_YM_ID__="${counterId}";
`.trim();
}

/**
 * Loads counter ID from admin API ASAP (before React).
 * Puts Metrika install path in the HTML source so verification / SPA boot work
 * even when EXPO_PUBLIC_YANDEX_METRIKA_ID was empty at build time.
 */
function yandexMetrikaEarlyApiLoader(apiBase: string) {
  return `
(function(){
  if (window.__ADVENTURA_YM_ID__) return;
  var api = ${JSON.stringify(apiBase)};
  if (!api) return;
  fetch(api + "/config/public", { credentials: "omit", cache: "no-store" })
    .then(function(r){ return r.json(); })
    .then(function(cfg){
      var m = cfg && cfg.yandexMetrika;
      var id = m && m.counterId;
      if (!id || !/^\\d+$/.test(String(id))) return;
      if (window.__ADVENTURA_YM_ID__) return;
      (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src.indexOf("mc.yandex.ru/metrika/tag.js") !== -1) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
      })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=" + id, "ym");
      ym(Number(id), "init", {
        defer: true,
        ssr: true,
        clickmap: m.clickmap !== false,
        trackLinks: m.trackLinks !== false,
        accurateTrackBounce: m.accurateTrackBounce !== false,
        webvisor: m.webvisor !== false,
        triggerEvent: true,
        referrer: document.referrer,
        url: location.href
      });
      window.__ADVENTURA_YM_ID__ = String(id);
    })
    .catch(function(){});
})();
`.trim();
}

export default function Root({ children }: PropsWithChildren) {
  const metrikaId = /^\d+$/.test(YANDEX_METRIKA_ID) ? YANDEX_METRIKA_ID : '';
  const apiBase = API_BASE_URL;

  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#208AEF" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=d20-white" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon.png?v=d20-white" />
        <link rel="shortcut icon" href="/favicon.png?v=d20-white" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveRootCss }} />
        {metrikaId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: yandexMetrikaStaticBootstrap(metrikaId),
            }}
          />
        ) : null}
        {apiBase ? (
          <script
            dangerouslySetInnerHTML={{
              __html: yandexMetrikaEarlyApiLoader(apiBase),
            }}
          />
        ) : null}
      </head>
      <body>
        {children}
        {metrikaId ? (
          <noscript>
            <div>
              <img
                src={`https://mc.yandex.ru/watch/${metrikaId}`}
                style={{ position: 'absolute', left: -9999 }}
                alt=""
              />
            </div>
          </noscript>
        ) : null}
      </body>
    </html>
  );
}
