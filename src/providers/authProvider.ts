import type { AuthProvider } from "@refinedev/core";
import { apiJson, tokenStorage } from "../api/http";

const EMAIL_KEY = "efactura-auth-email";
/** Marca de contrasena temporal: hasta cambiarla, el panel solo muestra la pantalla de cambio */
const DEBE_CAMBIAR_KEY = "efactura-debe-cambiar-password";

interface SessionResponse {
  token: string;
  valid: boolean;
  debeCambiarPassword?: boolean;
}

export type Rol = "ADMIN" | "USER";

/** Usuario logueado (GET /api/v1/cuenta: sin tokens ni credenciales) */
export interface Cuenta {
  id: number;
  emailAddress: string;
  firstName?: string | null;
  lastName?: string | null;
  role: Rol;
  debeCambiarPassword: boolean;
}

/** Cuenta del usuario logueado, pedida una vez por sesion */
let cuentaCache: { token: string; cuenta: Promise<Cuenta | null> } | null =
  null;

export function cuentaActual(): Promise<Cuenta | null> {
  const token = tokenStorage.get();
  const email = localStorage.getItem(EMAIL_KEY);
  if (!token || !email) return Promise.resolve(null);
  if (cuentaCache?.token !== token)
    cuentaCache = {
      token,
      cuenta: apiJson<Cuenta>("GET", "/cuenta").catch(
        (e: { statusCode?: number }) =>
          // API sin /cuenta (version anterior): del perfil propio solo se toman id y rol (trae tambien credenciales)
          e?.statusCode === 404
            ? apiJson<Cuenta>("GET", `/users/${encodeURIComponent(email)}`)
                .then((u) => ({
                  id: u.id,
                  emailAddress: email,
                  role: u.role,
                  debeCambiarPassword: false,
                }))
                .catch(() => null)
            : null,
      ),
    };
  return cuentaCache.cuenta;
}

export const rolUsuario = (): Promise<Rol | null> =>
  cuentaActual().then((c) => c?.role ?? null);

export const debeCambiarPassword = () => {
  try {
    return localStorage.getItem(DEBE_CAMBIAR_KEY) === "1";
  } catch {
    return false;
  }
};

export function marcarPasswordCambiada() {
  localStorage.removeItem(DEBE_CAMBIAR_KEY);
  cuentaCache = null;
}

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const session = await apiJson<SessionResponse>(
        "POST",
        "/signin",
        undefined,
        {
          emailAddress: email,
          password,
        },
      );
      tokenStorage.set(session.token);
      localStorage.setItem(EMAIL_KEY, email);
      cuentaCache = null;
      if (session.debeCambiarPassword) {
        localStorage.setItem(DEBE_CAMBIAR_KEY, "1");
        return { success: true, redirectTo: "/cambiar-password" };
      }
      localStorage.removeItem(DEBE_CAMBIAR_KEY);
      return { success: true, redirectTo: "/" };
    } catch (error) {
      return {
        success: false,
        error: {
          name: "Login",
          message:
            (error as Error).message || "Usuario o contraseña incorrectos",
        },
      };
    }
  },

  logout: async () => {
    cuentaCache = null;
    tokenStorage.clear();
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(DEBE_CAMBIAR_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () =>
    tokenStorage.get()
      ? { authenticated: true }
      : { authenticated: false, redirectTo: "/login", logout: true },

  getPermissions: async () => rolUsuario(),

  getIdentity: async () => {
    const email = localStorage.getItem(EMAIL_KEY);
    return email ? { id: email, name: email } : null;
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      // Contrasena temporal: la API solo permite /cuenta hasta cambiarla
      if (String(error?.message ?? "").includes("password_change_required")) {
        localStorage.setItem(DEBE_CAMBIAR_KEY, "1");
        return { redirectTo: "/cambiar-password" };
      }
      // Token vencido o invalido, o usuario desactivado
      return { logout: true, redirectTo: "/login", error };
    }
    return { error };
  },
};
