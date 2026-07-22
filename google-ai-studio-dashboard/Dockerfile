FROM node:20-slim AS build
WORKDIR /srv
COPY package.json package-lock.json* ./
RUN npm install && npm rebuild esbuild
COPY . .
# Vite bakes env vars into the static bundle at build time, not runtime - this
# must be a build arg, not a container env var. Empty string (the production
# default, set in docker-compose.prod.yml) means "same-origin relative paths",
# proxied by nginx straight to the dashboard service - no CORS needed in prod.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM node:20-slim
WORKDIR /srv
ENV NODE_ENV=production
COPY --from=build /srv/dist ./dist
COPY --from=build /srv/node_modules ./node_modules
COPY --from=build /srv/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/server.cjs"]