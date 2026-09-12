import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

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

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveRootCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
