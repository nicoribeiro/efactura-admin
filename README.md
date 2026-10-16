# efactura-admin

Panel web interno para la API de [java_efactura_uy](https://github.com/nicoribeiro/java_efactura_uy): comprobantes
emitidos y recibidos, sobres, emails recibidos, CAE, reporte diario, empresas, usuarios y procesos automáticos.

Stack: React 19 + TypeScript + Vite, [Refine](https://refine.dev) 5 y Ant Design 5.

## Puesta en marcha

```bash
npm ci
cp .env.example .env.local   # ajustar VITE_API_URL
npm run dev                  # http://localhost:5173
```

| Variable | Uso |
|---|---|
| `VITE_API_URL` | URL base de la API, incluyendo `/api/v1` (ej: `http://<servidor-api>:9000/api/v1`). Puede ser relativa (`/api/v1`) si el panel y la API se sirven desde el mismo origen |
| `VITE_API_TIMEOUT_MS` | Tiempo máximo de espera de la API (por defecto 30000) |

En desarrollo la API debe tener habilitado el filtro CORS (`app/Filters.java`).

Para trabajar contra otra API (ej. la de test) con otro puerto:

```bash
VITE_API_URL=http://<servidor-api-test>:9000/api/v1 npx vite --port 5174 --strictPort
```

Otros comandos: `npm run build` (chequea tipos y compila a `dist/`), `npm run lint`.

## Producción (Docker)

La imagen compila el panel y lo sirve con Nginx, que además reenvía `/api/` a la API. El panel y la API quedan en el
mismo origen, así que no hace falta CORS.

En el servidor (con Docker y el plugin compose), desde el repo clonado, crear un `.env` junto a `docker-compose.yml`
con la URL de la API (no se versiona) y levantar:

```bash
echo 'API_UPSTREAM=http://<servidor-api>:9000' > .env
docker compose up -d --build
```

El panel queda en `http://<servidor>:8080/`. Variables (en el entorno o en el `.env`):

| Variable | Por defecto | Uso |
|---|---|---|
| `API_UPSTREAM` | (obligatoria) | URL de la API, sin `/api/v1`. Sin ella compose no levanta y el contenedor no arranca |
| `PANEL_PORT` | `8080` | Puerto publicado en el servidor |

Actualizar a una versión nueva: `git pull && docker compose up -d --build`. Estado: `docker compose ps` (incluye el
healthcheck `/healthz`); logs de Nginx: `docker compose logs -f`.

Sin compose:

```bash
docker build -t efactura-admin .
docker run -d --name efactura-admin -p 8080:80 \
  -e API_UPSTREAM=http://<servidor-api>:9000 --restart unless-stopped efactura-admin
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
caché de `assets/`), `docker/05-api-upstream.sh` (no arranca sin `API_UPSTREAM`).

`VITE_API_URL` se fija al compilar; en la imagen es `/api/v1` (relativa). Para compilar contra otra URL:
`docker build --build-arg VITE_API_URL=http://... .`

## Pantallas

| Ruta | Contenido |
|---|---|
| `/inicio` | Tablero de la empresa: totales, gráfico, comprobantes rechazados y avisos (emails con error, respuestas pendientes, CAE por vencer) |
| `/documentos` | Comprobantes emitidos y recibidos: filtros, detalle, PDF, sobre, referencias, consulta a DGI, reenvío por mail, respuesta y rechazo comercial de los recibidos, exportación |
| `/sobres` | Sobres emitidos y recibidos con sus comprobantes y respuestas (M y ME) |
| `/reportes` | Reporte diario a DGI: estado por día, detalle y envío |
| `/cotizaciones` | Tipos de cambio y UI |
| `/empresas` | Empresas; en cada una: datos (y activa / dada de baja), sucursales, CAE (carga y pronóstico), emails recibidos (reintentar u omitir), carpetas IMAP sincronizadas, usuarios, logo y firma digital |
| `/usuarios` | Usuarios (solo ADMIN): alta, edición, empresas asignadas, sesiones, credenciales HMAC |
| `/procesos` | Procesos automáticos (pollers) y sus ejecuciones |
| `/login`, `/recuperar` | Ingreso y recuperación de la contraseña con un código por mail |
| `/confirmar-email`, `/cambiar-password` | Pasos obligatorios: los usuarios nuevos confirman el email con un código y cambian la contraseña temporal |

Todas las tablas se pueden ordenar por columna: las paginadas en la API (`?orden=campo&sentido=asc|desc`), el resto en
el navegador (`src/utils/orden.ts`).

## Estructura

- `src/api/http.ts`: cliente HTTP. Agrega el header `AUTH-TOKEN`, convierte los errores de la API (`result_message`,
  `result_detail`) y aplica la lista de escrituras permitidas (ver abajo).
- `src/providers/authProvider.ts`: login contra `POST /signin`; el token de sesión se guarda en `localStorage`. Maneja
  los pasos obligatorios (confirmar email, cambiar contraseña temporal) y vuelve al login cuando la sesión vence (401).
- `src/providers/dataProvider.ts`: recursos de Refine → rutas de la API. Paginados en la API: `empresas`, `documentos`
  (un documento se identifica por `tipo|serie|nro`), `sobres` y `emails`. Listas completas: `usuarios`, `sucursales`, `caes`.
- `src/contexts/empresa.tsx`: empresa seleccionada en el encabezado; las pantallas usan su RUT.
- `src/constants`: tipos de CFE (`cfe.ts`, el `name` es el del enum `TipoDoc` de la API), estados, firma.
- `src/pages`: una carpeta por sección (ver la tabla de pantallas).
- `src/utils`: orden de tablas, rangos rápidos de fechas, CSV, CAE.

## Escrituras permitidas

El panel es de solo lectura salvo una lista explícita (`ESCRITURAS_PERMITIDAS` en `src/api/http.ts`); cualquier otro
`POST`/`PUT`/`DELETE` se bloquea antes de llegar a la API. Lo permitido: login, recuperación de la contraseña,
confirmación del email y cambio de la contraseña propia; administración de usuarios; datos de la empresa y sus
sucursales; carga de CAE; reporte diario; reenvío por mail de un comprobante; reintento u omisión de los emails
recibidos; respuesta a los CFE recibidos y su rechazo comercial.

También se bloquean los `GET` de la API que tienen efectos (`GET_CON_EFECTOS`): consultan DGI y actualizan estados,
envían mails o regeneran credenciales. La consulta a DGI del resultado de un comprobante está permitida a propósito.

Para agregar una acción nueva hay que sumarla a esa lista; si no, el panel responde 405 sin llamar a la API. Las
restricciones por rol (ADMIN) las aplica la API; el panel solo oculta lo que no corresponde.

## Licencia

[MIT](LICENSE)
