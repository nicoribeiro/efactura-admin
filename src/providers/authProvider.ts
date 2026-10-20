import type { AuthProvider } from "@refinedev/core";
import { apiJson, tokenStorage } from "../api/http";
import { RUT_KEY } from "../contexts/empresa";

const EMAIL_KEY = "efactura-auth-email";
/** Marca de contrasena temporal: hasta cambiarla, el panel solo muestra la pantalla de cambio */
const DEBE_CAMBIAR_KEY = "efactura-debe-cambiar-password";
/** Marca de usuario nuevo sin el email confirmado: hasta confirmarlo, el panel solo muestra la pantalla de confirmacion */
const DEBE_CONFIRMAR_KEY = "efactura-debe-confirmar-email";

interface SessionResponse {
  token: string;
  valid: boolean;
  debeCambiarPassword?: boolean;
  /** Solo para usuarios nuevos que todavia no confirmaron su email */
  debeConfirmarEmail?: boolean;
  emailConfirmado?: boolean;
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
  /** Ausentes en APIs anteriores a la confirmacion de email */
  emailConfirmado?: boolean;
  debeConfirmarEmail?: boolean;
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

export const debeConfirmarEmail = () => {
  try {
    return localStorage.getItem(DEBE_CONFIRMAR_KEY) === "1";
  } catch {
    return false;
  }
};

/** Email confirmado: la cuenta actualizada (respuesta de /cuenta/email/confirmar) reemplaza la de la cache */
export function marcarEmailConfirmado(cuenta?: Cuenta) {
  localStorage.removeItem(DEBE_CONFIRMAR_KEY);
  // La contrasena temporal se cambia despues de confirmar el email
  if (cuenta?.debeCambiarPassword) localStorage.setItem(DEBE_CAMBIAR_KEY, "1");
  const token = tokenStorage.get();
  cuentaCache =
    cuenta && token ? { token, cuenta: Promise.resolve(cuenta) } : null;
}

/** Pantalla a la que tiene que ir el usuario antes de usar el panel (primero el email, despues la contrasena) */
export const pasoObligatorio = (): string | null =>
  debeConfirmarEmail()
    ? "/confirmar-email"
    : debeCambiarPassword()
      ? "/cambiar-password"
      : null;

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
      // Otro usuario en el mismo navegador: la empresa elegida antes puede no ser accesible para este
      if (localStorage.getItem(EMAIL_KEY) !== email) localStorage.removeItem(RUT_KEY);
      localStorage.setItem(EMAIL_KEY, email);
      cuentaCache = null;
      // Usuario nuevo: primero confirma el email y despues cambia la contrasena temporal
      if (session.debeConfirmarEmail)
        localStorage.setItem(DEBE_CONFIRMAR_KEY, "1");
      else localStorage.removeItem(DEBE_CONFIRMAR_KEY);
      if (session.debeCambiarPassword)
        localStorage.setItem(DEBE_CAMBIAR_KEY, "1");
      else localStorage.removeItem(DEBE_CAMBIAR_KEY);
      return { success: true, redirectTo: pasoObligatorio() ?? "/" };
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
    localStorage.removeItem(DEBE_CONFIRMAR_KEY);
    localStorage.removeItem(RUT_KEY);
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
      // Usuario nuevo sin el email confirmado: la API solo permite /cuenta hasta confirmarlo
      if (
        String(error?.message ?? "").includes("email_confirmation_required")
      ) {
        localStorage.setItem(DEBE_CONFIRMAR_KEY, "1");
        return { redirectTo: "/confirmar-email" };
      }
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
