# Panel efactura-admin: build con Node y archivos estaticos servidos por Nginx, que ademas reenvia /api/ a la API.

# --- Build ---
FROM docker.io/library/node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Por defecto la API se accede por el mismo origen (Nginx reenvia /api/), sin CORS
ARG VITE_API_URL=/api/v1
ARG VITE_API_TIMEOUT_MS=30000
ENV VITE_API_URL=$VITE_API_URL \
    VITE_API_TIMEOUT_MS=$VITE_API_TIMEOUT_MS
RUN npm run build

# --- Runtime ---
FROM docker.io/library/nginx:1.27-alpine

# URL de la API de java_efactura_uy, sin barra final ni /api/v1 (se reemplaza en la config al iniciar). Obligatoria y sin
# valor por defecto: se pasa al levantar el contenedor (-e API_UPSTREAM=... o el .env de docker compose)
COPY docker/05-api-upstream.sh /docker-entrypoint.d/05-api-upstream.sh
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
