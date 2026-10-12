import { Tag } from "antd";

/** Estados de la respuesta de DGI a un reporte diario (EstadoACKRepType) */
const ESTADOS_REPORTE: Record<string, { label: string; color: string }> = {
  AR: { label: "Aceptado", color: "green" },
  BR: { label: "Rechazado", color: "red" },
  BA: { label: "BA", color: "orange" },
};

export const tagEstadoReporte = (estado?: string | null) => {
  if (!estado) return <Tag color="gold">Sin respuesta</Tag>;
  const e = ESTADOS_REPORTE[estado];
  return <Tag color={e?.color}>{e ? `${e.label} (${estado})` : estado}</Tag>;
};
