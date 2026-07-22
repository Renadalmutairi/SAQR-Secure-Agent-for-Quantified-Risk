FROM node:20-slim AS build
WORKDIR /srv
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /srv/dist /usr/share/nginx/html/benchmark
