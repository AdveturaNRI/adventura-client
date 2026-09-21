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

/* In-app toasts: Safari/Chrome paint <button>/Pressable white and kill dark contrast. */
.adventura-toast,
.adventura-toast [role="button"],
.adventura-toast button {
  -webkit-appearance: none !important;
  appearance: none !important;
  background-image: none !important;
  color: inherit !important;
}

html[data-theme="dark"] .adventura-toast {
  background: #1c1c1e !important;
  background-color: #1c1c1e !important;
  border-color: #38383a !important;
  color: #ffffff !important;
}

html[data-theme="dark"] .adventura-toast-title {
  color: #ffffff !important;
}

html[data-theme="dark"] .adventura-toast-message {
  color: #c7c7cc !important;
}

html[data-theme="dark"] .adventura-toast-action {
  background: rgba(21, 122, 254, 0.22) !important;
}

html[data-theme="dark"] .adventura-toast-action-label {
  color: #84b9ff !important;
}

html[data-theme="light"] .adventura-toast {
  background: #ffffff !important;
  background-color: #ffffff !important;
  border-color: #e8e8e8 !important;
  color: #000000 !important;
}

html[data-theme="light"] .adventura-toast-title {
  color: #000000 !important;
}

html[data-theme="light"] .adventura-toast-message {
  color: #4c4c4c !important;
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
