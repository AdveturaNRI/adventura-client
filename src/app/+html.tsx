import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const YANDEX_METRIKA_ID = process.env.EXPO_PUBLIC_YANDEX_METRIKA_ID?.trim() ?? '';

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
  flex: 1 1 0%;
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
`;

function yandexMetrikaBootstrap(counterId: string) {
  return `
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
ym(${counterId}, "init", {
  clickmap:true,
  trackLinks:true,
  accurateTrackBounce:true,
  webvisor:true
});
`.trim();
}

export default function Root({ children }: PropsWithChildren) {
  const metrikaId = /^\d+$/.test(YANDEX_METRIKA_ID) ? YANDEX_METRIKA_ID : '';

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
            dangerouslySetInnerHTML={{ __html: yandexMetrikaBootstrap(metrikaId) }}
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
