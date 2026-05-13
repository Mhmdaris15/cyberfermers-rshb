# syntax=docker/dockerfile:1.6
# =====================================================================
#  Web image — Vite production build served by nginx.
#
#  Build args:
#    VITE_API_URL   — public URL of the API. Leave empty for same-origin
#                     deploys (FE uses relative /api → nginx proxies to api:8080).
#    VITE_APP_NAME  — app title.
#
#  Vite injects these at BUILD time, so this image is pinned to one
#  environment per build. For a 3-env shop (dev/staging/prod), build
#  three tags: svoe-web:dev, svoe-web:staging, svoe-web:prod.
# =====================================================================

# ---- builder ---------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_LOGLEVEL=error \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY apps/web/ .

ARG VITE_API_URL=
ARG VITE_APP_NAME="Свое Родное · Calendar"
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}

RUN npm run build

# ---- runtime ---------------------------------------------------------
FROM nginx:1.27-alpine AS run
RUN apk add --no-cache wget && \
    addgroup -g 1000 svoe && adduser -u 1000 -G svoe -D -s /sbin/nologin svoe

# Replace default nginx site with our SPA + /api proxy config.
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Static build output. nginx runs as root by default to bind :80; we drop
# privileges for the worker processes only (nginx does this internally).
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
