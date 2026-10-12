import type { AuthProvider } from "@refinedev/core";
import { apiJson, tokenStorage } from "../api/http";

const EMAIL_KEY = "efactura-auth-email";

interface SessionResponse {
  token: string;
  valid: boolean;
}

export type Rol = "ADMIN" | "USER";

/**
 * Rol del usuario logueado, pedido una vez por sesion (GET /users/:email, su propio perfil). De la respuesta solo se
 * guarda el rol: el perfil trae tambien las credenciales HMAC, que el panel no usa.
 */
let rolCache: { token: string; rol: Promise<Rol | null> } | null = null;

export function rolUsuario(): Promise<Rol | null> {
  const token = tokenStorage.get();
  const email = localStorage.getItem(EMAIL_KEY);
  if (!token || !email) return Promise.resolve(null);
  if (rolCache?.token !== token)
    rolCache = {
      token,
      rol: apiJson<{ role?: Rol }>("GET", `/users/${encodeURIComponent(email)}`)
        .then((u) => u.role ?? null)
        .catch(() => null),
    };
  return rolCache.rol;
}

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const session = await apiJson<SessionResponse>("POST", "/signin", undefined, {
        emailAddress: email,
        password,
      });
      tokenStorage.set(session.token);
      localStorage.setItem(EMAIL_KEY, email);
      return { success: true, redirectTo: "/" };
    } catch (error) {
      return {
        success: false,
        error: { name: "Login", message: (error as Error).message || "Usuario o contraseña incorrectos" },
      };
    }
  },

  logout: async () => {
    rolCache = null;
    tokenStorage.clear();
    localStorage.removeItem(EMAIL_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () =>
    tokenStorage.get() ? { authenticated: true } : { authenticated: false, redirectTo: "/login", logout: true },

  getPermissions: async () => rolUsuario(),

  getIdentity: async () => {
    const email = localStorage.getItem(EMAIL_KEY);
    return email ? { id: email, name: email } : null;
  },

  onError: async (error) => {
    // Token vencido o invalido: la API responde 401
    if (error?.statusCode === 401) return { logout: true, redirectTo: "/login", error };
    return { error };
  },
};
