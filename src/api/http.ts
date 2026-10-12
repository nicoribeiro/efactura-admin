import type { HttpError } from "@refinedev/core";

export const API_URL: string = (import.meta.env.VITE_API_URL ?? "http://localhost:9000/api/v1").replace(/\/$/, "");

const TOKEN_KEY = "efactura-auth-token";

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Formato de error de la API: ver APIException.toJson en java_efactura_uy */
interface ApiErrorBody {
  result_code?: number;
  result_name?: string;
  result_message?: string;
  result_detail?: string;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: QueryParams): string {
  // API_URL puede ser relativa ("/api/v1") cuando el panel y la API se sirven desde el mismo origen
  const url = new URL(API_URL + path, window.location.origin);
  if (query)
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  return url.toString();
}

async function toHttpError(response: Response): Promise<HttpError> {
  let body: ApiErrorBody | undefined;
  let texto = "";
  try {
    texto = await response.text();
    body = JSON.parse(texto) as ApiErrorBody;
  } catch {
    // respuesta sin cuerpo JSON: ej. el 401 de Secured es texto plano ("La sesion vencio, vuelva a ingresar")
  }
  const textoPlano = !body && texto && texto.length < 300 && !texto.trimStart().startsWith("<") ? texto.trim() : "";
  const message =
    [body?.result_message, body?.result_detail].filter(Boolean).join(": ") ||
    body?.result_name ||
    textoPlano ||
    `Error ${response.status}`;
  return { message, statusCode: response.status, errors: body ? { api: [JSON.stringify(body)] } : undefined };
}

/**
 * El panel es de solo lectura salvo una lista explicita de escrituras: el login, la administracion de usuarios (solo
 * ADMIN en la API) y el cambio de la contrasena propia. Cualquier otro POST/PUT/DELETE se bloquea aca, antes de llegar
 * a la API. Ademas se bloquean los GET de la API que tienen efectos (consultan DGI y actualizan estados, o envian mails).
 */
const ESCRITURAS_PERMITIDAS: { method: string; path: RegExp }[] = [
  { method: "POST", path: /^\/signin$/ },
  // Administracion de usuarios
  { method: "POST", path: /^\/usuarios$/ },
  { method: "PUT", path: /^\/usuarios\/\d+$/ },
  { method: "POST", path: /^\/usuarios\/\d+\/password$/ },
  { method: "PUT", path: /^\/usuarios\/\d+\/activo$/ },
  { method: "POST", path: /^\/usuarios\/\d+\/sesiones\/cerrar$/ },
  { method: "POST", path: /^\/usuarios\/\d+\/credenciales$/ },
  { method: "PUT", path: /^\/users\/\d+\/empresas\/\d+$/ },
  { method: "DELETE", path: /^\/users\/\d+\/empresas\/\d+$/ },
  // Carga de CAE (XML de DGI)
  { method: "POST", path: /^\/empresa\/\d+\/cae$/ },
  // Reporte diario a DGI (de a un dia)
  { method: "POST", path: /^\/empresa\/\d+\/reporteDiario\/\d{8}$/ },
  // Contrasena propia
  { method: "PUT", path: /^\/cuenta\/password$/ },
];
const GET_CON_EFECTOS = [
  /\/documentos\/resultado$/, // consulta DGI y actualiza el estado del CFE
  /\/resultados\/[^/]+$/, // idem para todos los CFE de una fecha
  /\/documentos\/enviarCfeEmpresa$/, // envia el CFE por mail al receptor
  /\/sobre\/enviarSobreEmpresa$/, // envia el sobre por mail
  /\/credentials\/regenerate$/, // regenera credenciales (GET con efecto)
];

function verificarSoloLectura(method: string, path: string) {
  const permitido =
    method === "GET"
      ? !GET_CON_EFECTOS.some((re) => re.test(path))
      : ESCRITURAS_PERMITIDAS.some(
          (e) => e.method === method && e.path.test(path),
        );
  if (!permitido)
    throw {
      message: `El panel no permite ${method} ${path}`,
      statusCode: 405,
    } as HttpError;
}

/** Tiempo maximo de espera de la API (incluye la descarga de la respuesta). Configurable con VITE_API_TIMEOUT_MS. */
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 30_000;

/** Codigos usados para errores sin respuesta HTTP */
export const STATUS_TIMEOUT = 408;
export const STATUS_SIN_CONEXION = 0;

/**
 * Hace el pedido y lee la respuesta con un tiempo maximo. Si la API no responde (servidor caido, sin memoria, red)
 * se cancela y se devuelve un error claro en lugar de quedar esperando indefinidamente.
 */
async function request<T>(
  method: string,
  path: string,
  query: QueryParams | undefined,
  body: unknown,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  verificarSoloLectura(method, path);

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = tokenStorage.get();
  if (token) headers["AUTH-TOKEN"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) throw await toHttpError(response);
    return await read(response);
  } catch (error) {
    if (controller.signal.aborted)
      throw {
        message: `La API no respondió en ${API_TIMEOUT_MS / 1000} segundos (${API_URL}). Puede estar caída o sobrecargada.`,
        statusCode: STATUS_TIMEOUT,
      } as HttpError;
    // fetch rechaza con TypeError cuando no hay respuesta: servidor caido, red o CORS
    if (error instanceof TypeError)
      throw {
        message: `No se pudo conectar con la API (${API_URL}). Verifique que el servidor esté levantado y accesible.`,
        statusCode: STATUS_SIN_CONEXION,
      } as HttpError;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiJson<T>(method: string, path: string, query?: QueryParams, body?: unknown): Promise<T> {
  return request(method, path, query, body, async (response) => {
    const text = await response.text();
    const data = text ? JSON.parse(text) : undefined;
    // La API devuelve la mayoria de sus errores (APIException) con HTTP 200 y {result_code, result_message, ...}.
    // result_code 0 es OK.
    if (data && typeof data === "object" && !Array.isArray(data) && typeof data.result_code === "number" && data.result_code !== 0) {
      const body = data as ApiErrorBody;
      throw {
        message: [body.result_message, body.result_detail].filter(Boolean).join(": ") || body.result_name || "Error de la API",
        statusCode: response.status,
        errors: { api: [text] },
      } as HttpError;
    }
    return data as T;
  });
}

export async function apiBlob(path: string, query?: QueryParams): Promise<Blob> {
  return request("GET", path, query, undefined, (response) => response.blob());
}
