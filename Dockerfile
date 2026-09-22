FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG EXPO_PUBLIC_API_URL=https://api.adventu.ru/api
# Optional bake-in for Metrika HTML checkers. Runtime still reads admin
# /api/config/public; set this on image build so ym(ID) appears in index.html.
ARG EXPO_PUBLIC_YANDEX_METRIKA_ID=112799671
ARG EXPO_PUBLIC_VK_APP_ID=
ARG EXPO_PUBLIC_YANDEX_CLIENT_ID=
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_YANDEX_METRIKA_ID=$EXPO_PUBLIC_YANDEX_METRIKA_ID
ENV EXPO_PUBLIC_VK_APP_ID=$EXPO_PUBLIC_VK_APP_ID
ENV EXPO_PUBLIC_YANDEX_CLIENT_ID=$EXPO_PUBLIC_YANDEX_CLIENT_ID
ENV CI=1

COPY package.json package-lock.json .npmrc ./
COPY patches ./patches
COPY scripts ./scripts
COPY public ./public
RUN npm ci

COPY app.json tsconfig.json ./
COPY assets ./assets
COPY src ./src

# Expo exports public assets but omits standalone HTML files. The 3D dice stage
# loads this page in an iframe, so preserve it explicitly in the published site.
# 404.html is what serve returns with HTTP 404 for unknown paths (see serve.json).
RUN npx expo export -p web \
  && cp public/dice-stage.html dist/dice-stage.html \
  && cp public/serve.json dist/serve.json \
  && cp dist/+not-found.html dist/404.html

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 3000
# serve.json: cleanUrls off (dice iframe .html), rewrites for Expo routes,
# no -s so unknown URLs get 404.html with status 404 instead of index.html/200.
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "serve -c /app/dist/serve.json /app/dist -l tcp://0.0.0.0:${PORT:-3000}"]
