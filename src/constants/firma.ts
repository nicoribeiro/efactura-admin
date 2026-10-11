/** Fechas de validez de la firma digital de una empresa (la API no expone certificado ni clave) */
export interface FirmaDigital {
  validaDesde?: string | null;
  validaHasta?: string | null;
}

/** Igual al default de notificaciones.firma.vencimiento de la API */
export const DIAS_AVISO_FIRMA = 30;

export interface EstadoFirma {
  label: string;
  color: "green" | "orange" | "red" | "default";
  /** Dias hasta el vencimiento (negativo si ya vencio) */
  dias?: number;
  /** Requiere atencion: vencida o vence dentro de DIAS_AVISO_FIRMA */
  alerta: boolean;
}

const MS_DIA = 24 * 60 * 60 * 1000;

/** Fechas de la API: "yyyy-MM-dd HH:mm:ss z" */
const parseFecha = (value?: string | null) => (value ? new Date(value.slice(0, 10) + "T23:59:59") : undefined);

export const formatFechaCorta = (value?: string | null) => {
  const fecha = parseFecha(value);
  return fecha ? fecha.toLocaleDateString("es-UY") : "-";
};

export function estadoFirma(firma?: FirmaDigital | null): EstadoFirma {
  if (!firma) return { label: "Sin firma", color: "default", alerta: false };
  const vence = parseFecha(firma.validaHasta);
  if (!vence) return { label: "Sin fecha de vencimiento", color: "default", alerta: false };

  // Dias calendario entre hoy y el vencimiento (sin importar la hora actual)
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venceDia = new Date(vence);
  venceDia.setHours(0, 0, 0, 0);
  const dias = Math.round((venceDia.getTime() - hoy.getTime()) / MS_DIA);
  const plural = (n: number) => (n === 1 ? "1 día" : `${n} días`);

  if (dias < 0) return { label: `Vencida hace ${plural(-dias)}`, color: "red", dias, alerta: true };
  if (dias === 0) return { label: "Vence hoy", color: "red", dias, alerta: true };
  if (dias <= DIAS_AVISO_FIRMA) return { label: `Vence en ${plural(dias)}`, color: "orange", dias, alerta: true };
  return { label: `Vigente hasta ${vence.toLocaleDateString("es-UY")}`, color: "green", dias, alerta: false };
}
