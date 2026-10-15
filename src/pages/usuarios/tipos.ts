/** Usuario tal como lo devuelve GET /api/v1/usuarios */
export interface UltimaSesion {
  creada?: string | null;
  ultimoAcceso?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  vigente: boolean;
}

export interface Usuario {
  id: number;
  emailAddress: string;
  firstName?: string | null;
  lastName?: string | null;
  role: "ADMIN" | "USER";
  creado?: string | null;
  /** Ausentes en APIs anteriores a la administracion de usuarios */
  activo?: boolean;
  debeCambiarPassword?: boolean;
  /** Ausente en APIs anteriores a la confirmacion de email */
  emailConfirmado?: boolean;
  accesoTotal: boolean;
  empresas: { rut: string; razon?: string | null }[];
  sesiones: {
    total: number;
    vigentes: number;
    vencidas: number;
    ultima: UltimaSesion | null;
  };
}

/** Respuesta de las acciones que generan una contrasena temporal (se muestra una sola vez) */
export interface ConPasswordTemporal {
  passwordTemporal: string;
}
