import dayjs, { type Dayjs } from "dayjs";

/** CAE tal como lo devuelve GET /empresa/:rut/cae */
export interface CAE {
  id: number;
  tipo?: string;
  idTipoDoc?: number;
  nro: number;
  serie: string;
  inicial: number;
  fin: number;
  siguiente: number;
  fechaVencimiento?: string | null;
  fechaAnulado?: string | null;
  total: number;
  usados: number;
  disponibles: number;
  porcentajeUso: number;
}

export type EstadoCAE = "Vigente" | "Vencido" | "Agotado" | "Anulado";

/** Dias de uso que se miran para estimar el ritmo de emision */
export const DIAS_RITMO = 90;
/** Con menos de estos dias hasta necesitar un CAE nuevo se avisa (y con menos de CRITICO, como error) */
export const DIAS_AVISO = 30;
export const DIAS_CRITICO = 7;

/** Fechas de la API: "yyyy-MM-dd HH:mm:ss z"; el CAE vale hasta el final de ese dia */
export const vencimientoCAE = (cae: Pick<CAE, "fechaVencimiento">) =>
  cae.fechaVencimiento ? dayjs(cae.fechaVencimiento.slice(0, 10)) : undefined;

export function estadoCAE(cae: CAE): { label: EstadoCAE; color: string } {
  if (cae.fechaAnulado) return { label: "Anulado", color: "default" };
  const vence = vencimientoCAE(cae);
  if (vence && vence.isBefore(dayjs(), "day"))
    return { label: "Vencido", color: "red" };
  if (cae.disponibles <= 0) return { label: "Agotado", color: "red" };
  return { label: "Vigente", color: "green" };
}

export type GravedadCAE = "error" | "warning" | "info" | "ok";

export interface PronosticoCAE {
  idTipoDoc: number;
  tipo?: string;
  /** CAE vigentes del tipo (no anulados, no vencidos, con numeros) */
  vigentes: number;
  disponibles: number;
  /** Comprobantes emitidos del tipo en los ultimos DIAS_RITMO dias */
  emitidos: number;
  /** Fecha estimada en que se agotan los numeros al ritmo actual (sin uso: undefined) */
  agotamiento?: Dayjs;
  /** Vencimiento mas lejano de los CAE vigentes */
  vence?: Dayjs;
  /** Lo que ocurra primero: agotamiento o vencimiento */
  limite?: Dayjs;
  motivo?: "agota" | "vence";
  diasRestantes?: number;
  gravedad: GravedadCAE;
}

/**
 * Pronostico por tipo de documento: con los CAE vigentes y el ritmo de emision de los ultimos DIAS_RITMO dias, la
 * fecha en que hace falta un CAE nuevo (se agotan los numeros o vence el ultimo CAE). Aproximado: suma los numeros
 * de todos los CAE vigentes del tipo y toma el vencimiento mas lejano.
 */
export function pronosticoCAE(
  caes: CAE[],
  emitidosPorTipo: Map<number, number>,
): PronosticoCAE[] {
  const hoy = dayjs().startOf("day");
  const tipos = new Set(
    caes.map((c) => c.idTipoDoc).filter((t): t is number => t != null),
  );

  return [...tipos]
    .sort((a, b) => a - b)
    .map((idTipoDoc) => {
      const delTipo = caes.filter((c) => c.idTipoDoc === idTipoDoc);
      const vigentes = delTipo.filter((c) => estadoCAE(c).label === "Vigente");
      const emitidos = emitidosPorTipo.get(idTipoDoc) ?? 0;
      const base = {
        idTipoDoc,
        tipo: delTipo[0]?.tipo,
        vigentes: vigentes.length,
        emitidos,
      };

      if (vigentes.length === 0)
        return {
          ...base,
          disponibles: 0,
          diasRestantes: 0,
          // Sin CAE y emitiendo: no se puede facturar. Sin emisiones recientes: solo se informa
          gravedad: emitidos > 0 ? "error" : "info",
        };

      const disponibles = vigentes.reduce((a, c) => a + c.disponibles, 0);
      const vence = vigentes
        .map(vencimientoCAE)
        .filter((d): d is Dayjs => !!d)
        .sort((a, b) => b.valueOf() - a.valueOf())[0];
      const porDia = emitidos / DIAS_RITMO;
      const agotamiento =
        porDia > 0
          ? hoy.add(Math.floor(disponibles / porDia), "day")
          : undefined;

      const motivo: "agota" | "vence" | undefined =
        agotamiento && (!vence || agotamiento.isBefore(vence))
          ? "agota"
          : vence
            ? "vence"
            : undefined;
      const limite = motivo === "agota" ? agotamiento : vence;
      const diasRestantes = limite ? limite.diff(hoy, "day") : undefined;
      const gravedad: GravedadCAE =
        diasRestantes === undefined
          ? "ok"
          : diasRestantes <= DIAS_CRITICO
            ? "error"
            : diasRestantes <= DIAS_AVISO
              ? "warning"
              : "ok";

      return {
        ...base,
        disponibles,
        agotamiento,
        vence,
        limite,
        motivo,
        diasRestantes,
        gravedad,
      };
    });
}

/** Texto corto del estado del pronostico, para tags y avisos */
export function textoPronostico(p: PronosticoCAE) {
  if (p.vigentes === 0) return "Sin CAE vigente";
  if (p.diasRestantes === undefined || p.gravedad === "ok") return "OK";
  const cuando =
    p.diasRestantes <= 0
      ? "hoy"
      : `en ${p.diasRestantes} día${p.diasRestantes === 1 ? "" : "s"}`;
  return p.motivo === "agota" ? `Se agota ${cuando}` : `Vence ${cuando}`;
}

/** Cantidad emitida por tipo a partir de las filas de GET /empresa/:rut/documentos/resumen */
export const emitidosPorTipo = (
  filas: { idTipoDoc: number; cantidad: number }[],
) =>
  filas.reduce(
    (m, f) => m.set(f.idTipoDoc, (m.get(f.idTipoDoc) ?? 0) + f.cantidad),
    new Map<number, number>(),
  );

/** Rango de fechas (epoch en segundos) para medir el ritmo de emision */
export const rangoRitmo = () => {
  const hasta = dayjs().endOf("day");
  const desde = hasta.subtract(DIAS_RITMO - 1, "day").startOf("day");
  return {
    fromDate: Math.floor(desde.valueOf() / 1000),
    toDate: Math.floor(hasta.valueOf() / 1000),
  };
};
