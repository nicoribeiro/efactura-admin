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
La API debe tener habilitado el filtro CORS (`app/Filters.java`), que hoy permite cualquier origen.

## Build

```bash
npm run build   # genera dist/, archivos estáticos para Apache/Nginx
```

Al publicar en un subdirectorio, configurar `base` en `vite.config.ts` y un fallback a `index.html` en el servidor.

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
