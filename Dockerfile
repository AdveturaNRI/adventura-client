FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG EXPO_PUBLIC_API_URL=https://api.adventu.ru/api
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV CI=1

COPY package.json package-lock.json ./
COPY patches ./patches
COPY scripts ./scripts
COPY public ./public
RUN npm ci

COPY app.json tsconfig.json ./
COPY assets ./assets
COPY src ./src

# Expo exports public assets but omits standalone HTML files. The 3D dice stage
# loads this page in an iframe, so preserve it explicitly in the published site.
RUN npx expo export -p web \
  && mkdir -p dist/dice-box \
  && cp public/dice-box/dice-roller.html dist/dice-box/dice-roller.html

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 3000
# -s handles Expo Router deep links; this config keeps .html URLs (the dice iframe)
# from being converted to clean URLs.
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "serve -s -c /app/dist/serve.json /app/dist -l tcp://0.0.0.0:${PORT:-3000}"]
