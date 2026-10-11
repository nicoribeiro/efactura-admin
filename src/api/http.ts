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
  const url = new URL(API_URL + path);
  if (query)
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  return url.toString();
}

async function toHttpError(response: Response): Promise<HttpError> {
  let body: ApiErrorBody | undefined;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // respuesta sin cuerpo JSON
  }
  const message =
    [body?.result_message, body?.result_detail].filter(Boolean).join(": ") ||
    body?.result_name ||
    `Error ${response.status}`;
  return { message, statusCode: response.status, errors: body ? { api: [JSON.stringify(body)] } : undefined };
}

async function request(method: string, path: string, query?: QueryParams, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = tokenStorage.get();
  if (token) headers["AUTH-TOKEN"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) throw await toHttpError(response);
  return response;
}

export async function apiJson<T>(method: string, path: string, query?: QueryParams, body?: unknown): Promise<T> {
  const response = await request(method, path, query, body);
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiBlob(path: string, query?: QueryParams): Promise<Blob> {
  const response = await request("GET", path, query);
  return response.blob();
}
