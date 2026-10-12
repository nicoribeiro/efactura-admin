# efactura-admin

Panel web interno para la API de [java_efactura_uy](https://github.com/nicoribeiro/java_efactura_uy).

Stack: React 19 + TypeScript + Vite, [Refine](https://refine.dev) 5 y Ant Design 5.

## Puesta en marcha

```bash
npm ci
cp .env.example .env.local   # ajustar VITE_API_URL
npm run dev                  # http://localhost:5173
```

`VITE_API_URL` es la URL base de la API, incluyendo `/api/v1` (ej: `http://192.168.1.103:9000/api/v1`).
En desarrollo la API debe tener habilitado el filtro CORS (`app/Filters.java`), que hoy permite cualquier origen.
`VITE_API_URL` también puede ser relativa (`/api/v1`) si el panel y la API se sirven desde el mismo origen.

## Producción (Docker)

La imagen compila el panel y lo sirve con Nginx, que además reenvía `/api/` a la API. El panel y la API quedan en el
mismo origen, así que no hace falta CORS.

En el servidor (con Docker y el plugin compose), desde el repo clonado:

```bash
docker compose up -d --build
```

El panel queda en `http://<servidor>:8080/`. Variables opcionales (en el entorno o en un `.env` junto a `docker-compose.yml`):

| Variable | Por defecto | Uso |
|---|---|---|
| `PANEL_PORT` | `8080` | Puerto publicado en el servidor |
| `API_UPSTREAM` | `http://192.168.1.103:9000` | URL de la API, sin `/api/v1` |

Ejemplo con otra API: `API_UPSTREAM=http://192.168.1.102:9000 docker compose up -d --build`.

Actualizar a una versión nueva: `git pull && docker compose up -d --build`. Estado: `docker compose ps` (incluye el
healthcheck `/healthz`); logs de Nginx: `docker compose logs -f`.

Sin compose:

```bash
docker build -t efactura-admin .
docker run -d --name efactura-admin -p 8080:80 \
  -e API_UPSTREAM=http://192.168.1.103:9000 --restart unless-stopped efactura-admin
```

### Servidor con Podman

`docker compose` necesita el socket de Podman (una sola vez, con el usuario que levanta el panel):

```bash
systemctl --user enable --now podman.socket
echo 'export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock' >> ~/.bashrc && source ~/.bashrc
sudo loginctl enable-linger $USER              # que el socket y el contenedor sigan al cerrar sesión
systemctl --user enable podman-restart.service # que el contenedor vuelva a levantar al reiniciar
```

Después, `docker compose up -d --build` como arriba. Podman sin root no puede publicar puertos menores a 1024, por eso
el puerto por defecto es `8080`.

Archivos: `Dockerfile` (build en Node 22, runtime Nginx), `docker/nginx.conf.template` (rutas del panel, proxy de la API,
caché de `assets/`).

`VITE_API_URL` se fija al compilar; en la imagen es `/api/v1` (relativa). Para compilar contra otra URL:
`docker build --build-arg VITE_API_URL=http://... .`

## Estructura

- `src/api/http.ts`: cliente HTTP. Agrega el header `AUTH-TOKEN` y convierte los errores de la API (`result_message`, `result_detail`).
- `src/providers/authProvider.ts`: login contra `POST /signin`; el token de sesión se guarda en `localStorage`.
- `src/providers/dataProvider.ts`: mapea los recursos de Refine a las rutas de la API.
  - `empresas` → `GET /empresa` (paginado en el cliente)
  - `documentos` → `GET /empresa/:rut/documentos` (paginado en la API, máximo 50 por página). Un documento se identifica por `tipo|serie|nro`.
- `src/contexts/empresa.tsx`: empresa seleccionada en el encabezado; las pantallas usan su RUT.
- `src/pages`: pantallas (comprobantes: listado y detalle con PDF; empresas: listado).

## Solo lectura

El panel no modifica datos. `src/api/http.ts` solo permite `GET` (y `POST /signin` para el login) y bloquea
los `GET` de la API que tienen efectos:

- `/empresa/:rut/documentos/resultado` y `/empresa/:rut/resultados/:fecha`: consultan DGI y actualizan estados
- `/empresa/:rut/documentos/enviarCfeEmpresa` y `/empresa/:rut/sobre/enviarSobreEmpresa`: envían mails

## Pendiente

- Emails recibidos (estado de carpetas IMAP), reporte diario.
- Sobres y CAE: requieren endpoints de listado (GET) en la API.
