import type { AuthProvider } from "@refinedev/core";
import { apiJson, tokenStorage } from "../api/http";

const EMAIL_KEY = "efactura-auth-email";

interface SessionResponse {
  token: string;
  valid: boolean;
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
    tokenStorage.clear();
    localStorage.removeItem(EMAIL_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () =>
    tokenStorage.get() ? { authenticated: true } : { authenticated: false, redirectTo: "/login", logout: true },

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
