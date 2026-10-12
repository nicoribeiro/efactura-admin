import type { AccessControlProvider } from "@refinedev/core";
import { rolUsuario } from "./authProvider";

/** Secciones que solo ve un ADMIN (la API igual las rechaza para un USER) */
const SOLO_ADMIN = new Set(["usuarios", "procesos"]);

/** Oculta del menu (y de los botones que usan CanAccess) lo que el usuario no puede ver */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource }) => {
    if (!resource || !SOLO_ADMIN.has(resource)) return { can: true };
    const rol = await rolUsuario();
    return rol === "ADMIN"
      ? { can: true }
      : { can: false, reason: "Solo administradores" };
  },
  options: {
    buttons: { enableAccessControl: true, hideIfUnauthorized: true },
  },
};
