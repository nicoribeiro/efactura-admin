import { apiJson } from "../../api/http";
import type { ConPasswordTemporal } from "./tipos";

/** Escrituras de la administracion de usuarios (solo ADMIN en la API; permitidas en http.ts) */
export const usuariosApi = {
  crear: (datos: {
    emailAddress: string;
    firstName: string;
    lastName?: string;
    role: "ADMIN" | "USER";
    empresas: string[];
  }) => apiJson<ConPasswordTemporal>("POST", "/usuarios", undefined, datos),

  editar: (
    uid: number,
    datos: {
      emailAddress?: string;
      firstName?: string;
      lastName?: string | null;
      role?: "ADMIN" | "USER";
    },
  ) => apiJson("PUT", `/usuarios/${uid}`, undefined, datos),

  resetearPassword: (uid: number) =>
    apiJson<ConPasswordTemporal>("POST", `/usuarios/${uid}/password`),

  cambiarActivo: (uid: number, activo: boolean) =>
    apiJson("PUT", `/usuarios/${uid}/activo`, undefined, { activo }),

  cerrarSesiones: (uid: number) =>
    apiJson<{ cerradas: number }>("POST", `/usuarios/${uid}/sesiones/cerrar`),

  verCredenciales: (uid: number) =>
    apiJson<{ key: string | null; valida: boolean }>(
      "GET",
      `/usuarios/${uid}/credenciales`,
    ),

  regenerarCredenciales: (uid: number) =>
    apiJson<{ key: string; secret: string }>(
      "POST",
      `/usuarios/${uid}/credenciales`,
    ),

  agregarEmpresa: (uid: number, rut: string) =>
    apiJson("PUT", `/users/${uid}/empresas/${rut}`),

  quitarEmpresa: (uid: number, rut: string) =>
    apiJson("DELETE", `/users/${uid}/empresas/${rut}`),
};
