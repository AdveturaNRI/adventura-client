FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG EXPO_PUBLIC_API_URL=https://adventura-api-production.up.railway.app/api
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

RUN npx expo export -p web

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 3000
# -s: SPA fallback for client routes; serve.json disables cleanUrls so
# /dice-stage.html is served as a real file (not redirected into Expo).
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
