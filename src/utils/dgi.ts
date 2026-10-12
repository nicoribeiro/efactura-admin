/**
 * Motivos de rechazo de DGI a partir de las respuestas guardadas en el sobre (solo lectura).
 *
 * - Si DGI rechazo el sobre completo (ACKSobre, estado BS) el motivo esta en la respuesta de recepcion
 *   (respuesta_dgi): Detalle/MotivosRechazo.
 * - Si el sobre se acepto pero el comprobante no (ACKCFE, estado BE) el motivo esta en el resultado de la consulta
 *   (resultado_dgi), en el ACKCFE_Det de ese comprobante: MotivosRechazoCF.
 */

export interface MotivoRechazo {
  codigo: string;
  glosa: string;
  detalle?: string;
}

export interface RechazoDgi {
  nivel: "sobre" | "comprobante";
  estado: string;
  motivos: MotivoRechazo[];
}

interface SobreConRespuestas {
  estadoDgi?: string | null;
  respuesta_dgi?: string | null;
  resultado_dgi?: string | null;
}

/**
 * Corrige texto UTF-8 que se decodifico como Latin-1 ("InformaciÃ³n" -> "Información"), como llega en algunas
 * respuestas de DGI. Si no es el caso, devuelve el texto sin cambios.
 */
export function arreglarTexto(texto: string): string {
  if (!/[ÃÂ][\u0080-ÿ]/.test(texto)) return texto;
  try {
    const bytes = Uint8Array.from(texto, (c) => c.charCodeAt(0) & 0xff);
    const decodificado = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes,
    );
    return decodificado;
  } catch {
    return texto;
  }
}

const parse = (xml?: string | null) => {
  if (!xml) return null;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return doc.getElementsByTagName("parsererror").length > 0 ? null : doc;
};

const hijos = (el: Element, nombre: string) =>
  Array.from(el.children).filter((c) => c.localName === nombre);
const texto = (el: Element, nombre: string) =>
  arreglarTexto(hijos(el, nombre)[0]?.textContent?.trim() ?? "");

const motivosDe = (contenedores: Element[]): MotivoRechazo[] =>
  contenedores.map((m) => ({
    codigo: texto(m, "Motivo"),
    glosa: texto(m, "Glosa"),
    detalle: texto(m, "Detalle") || undefined,
  }));

/** Rechazo del sobre completo (ACKSobre de la recepcion con estado distinto de AS), o null */
export function rechazoDelSobre(
  sobre: SobreConRespuestas | null | undefined,
): RechazoDgi | null {
  const recepcion = parse(sobre?.respuesta_dgi);
  if (recepcion?.documentElement.localName !== "ACKSobre") return null;
  const detalle = hijos(recepcion.documentElement, "Detalle")[0];
  const estado = detalle ? texto(detalle, "Estado") : "";
  if (!estado || estado === "AS") return null;
  return {
    nivel: "sobre",
    estado,
    motivos: motivosDe(detalle ? hijos(detalle, "MotivosRechazo") : []),
  };
}

export interface EstadoCfeEnSobre {
  idTipoDoc: number;
  serie: string;
  nro: number;
  estado: string;
  motivos: MotivoRechazo[];
}

/** Estado que DGI dio a cada comprobante del sobre (ACKCFE_Det del resultado de la consulta) */
export function estadosCfeEnSobre(
  sobre: SobreConRespuestas | null | undefined,
): EstadoCfeEnSobre[] {
  const resultado = parse(sobre?.resultado_dgi);
  if (!resultado) return [];
  return Array.from(resultado.getElementsByTagNameNS("*", "ACKCFE_Det")).map(
    (d) => ({
      idTipoDoc: Number(texto(d, "TipoCFE")),
      serie: texto(d, "Serie"),
      nro: Number(texto(d, "NroCFE")),
      estado: texto(d, "Estado"),
      motivos: motivosDe(hijos(d, "MotivosRechazoCF")),
    }),
  );
}

/**
 * Motivo del rechazo de un comprobante, o null si DGI no lo rechazo (o no hay respuesta guardada).
 */
export function rechazoDgi(
  sobre: SobreConRespuestas | null | undefined,
  comprobante: { idTipoDoc: number; serie: string; nro: number },
): RechazoDgi | null {
  if (!sobre) return null;

  // 1. Sobre rechazado completo
  const delSobre = rechazoDelSobre(sobre);
  if (delSobre) return delSobre;

  // 2. Comprobante rechazado dentro de un sobre aceptado: el ACKCFE_Det de este comprobante
  const propio = estadosCfeEnSobre(sobre).find(
    (d) =>
      d.idTipoDoc === comprobante.idTipoDoc &&
      d.serie === comprobante.serie &&
      d.nro === comprobante.nro,
  );
  if (propio && propio.estado && propio.estado !== "AE")
    return {
      nivel: "comprobante",
      estado: propio.estado,
      motivos: propio.motivos,
    };

  return null;
}
