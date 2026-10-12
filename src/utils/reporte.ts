/**
 * Lectura del XML del reporte diario (Reporte) y de la respuesta de DGI (ACKRepDiario) para mostrarlos estructurados.
 * Solo lectura: no se modifica el XML original.
 */

export interface Rango {
  serie: string;
  desde: number;
  hasta: number;
}

/** Montos de un item (Mnts_FyT_Item, etc.): nombre del elemento -> valor */
export type ItemMontos = Record<string, string>;

export interface ResumenTipo {
  /** Nombre del elemento (Rsmn_Fac, Rsmn_Tck, ...) */
  seccion: string;
  tipoComp?: number;
  cantEmitidos?: number;
  cantUtilizados?: number;
  cantAnulados?: number;
  rangosUtilizados: Rango[];
  rangosAnulados: Rango[];
  montos: ItemMontos[];
}

export interface ReporteParseado {
  caratula: Record<string, string>;
  resumenes: ResumenTipo[];
}

export interface RespuestaParseada {
  caratula: Record<string, string>;
  estado?: string;
  /** Otros datos del detalle (ej: motivos de rechazo) */
  detalle: { nombre: string; valor: string }[];
}

const parse = (xml?: string | null): Document | null => {
  if (!xml) return null;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return doc.getElementsByTagName("parsererror").length > 0 ? null : doc;
};

/** Hijos directos con ese nombre local (sin importar el namespace) */
const hijos = (el: Element, nombre: string) =>
  Array.from(el.children).filter((c) => c.localName === nombre);
const hijo = (el: Element | undefined, nombre: string) =>
  el ? hijos(el, nombre)[0] : undefined;
const texto = (el: Element | undefined, nombre: string) =>
  hijo(el, nombre)?.textContent?.trim();
const numero = (valor?: string) =>
  valor !== undefined && valor !== "" && !isNaN(Number(valor))
    ? Number(valor)
    : undefined;

/** Elementos hoja de un nodo como pares nombre -> valor */
const hojas = (el: Element | undefined): Record<string, string> => {
  const resultado: Record<string, string> = {};
  if (el)
    for (const c of Array.from(el.children))
      if (c.children.length === 0)
        resultado[c.localName] = c.textContent?.trim() ?? "";
  return resultado;
};

const rangos = (el: Element | undefined): Rango[] =>
  el
    ? Array.from(el.children).map((item) => ({
        serie: texto(item, "Serie") ?? "",
        desde: numero(texto(item, "NroDesde")) ?? 0,
        hasta: numero(texto(item, "NroHasta")) ?? 0,
      }))
    : [];

/** Items de montos: los elementos de Montos (a cualquier profundidad) cuyos hijos son todos hojas */
const itemsMontos = (montos: Element | undefined): ItemMontos[] => {
  const items: ItemMontos[] = [];
  const recorrer = (el: Element) => {
    for (const c of Array.from(el.children)) {
      if (c.children.length === 0) continue;
      if (Array.from(c.children).every((h) => h.children.length === 0))
        items.push(hojas(c));
      else recorrer(c);
    }
  };
  if (montos) recorrer(montos);
  return items;
};

export function parsearReporte(xml?: string | null): ReporteParseado | null {
  const doc = parse(xml);
  const raiz = doc?.documentElement;
  if (!raiz) return null;

  const resumenes = Array.from(raiz.children)
    .filter((c) => c.localName.startsWith("Rsmn"))
    .map((seccion): ResumenTipo => {
      const data = hijo(seccion, "RsmnData");
      return {
        seccion: seccion.localName,
        tipoComp: numero(texto(seccion, "TipoComp")),
        cantEmitidos: numero(texto(data, "CantDocsEmi")),
        cantUtilizados: numero(texto(data, "CantDocsUtil")),
        cantAnulados: numero(texto(data, "CantDocsAnulados")),
        rangosUtilizados: rangos(hijo(data, "RngDocsUtil")),
        rangosAnulados: rangos(hijo(data, "RngDocsAnulados")),
        montos: itemsMontos(hijo(data, "Montos")),
      };
    });

  return { caratula: hojas(hijo(raiz, "Caratula")), resumenes };
}

export function parsearRespuesta(
  xml?: string | null,
): RespuestaParseada | null {
  const doc = parse(xml);
  const raiz = doc?.documentElement;
  if (!raiz) return null;

  const detalle = hijo(raiz, "Detalle");
  const otros: { nombre: string; valor: string }[] = [];
  const recorrer = (el: Element, camino: string) => {
    for (const c of Array.from(el.children)) {
      const nombre = camino ? `${camino} / ${c.localName}` : c.localName;
      if (c.children.length === 0) {
        if (c.localName !== "Estado")
          otros.push({ nombre, valor: c.textContent?.trim() ?? "" });
      } else recorrer(c, nombre);
    }
  };
  if (detalle) recorrer(detalle, "");

  return {
    caratula: hojas(hijo(raiz, "Caratula")),
    estado: texto(detalle, "Estado"),
    detalle: otros,
  };
}

/** Etiquetas de los montos del reporte */
export const ETIQUETAS_MONTOS: Record<string, string> = {
  Fecha: "Fecha",
  CodSuc: "Sucursal",
  TotMntNoGrv: "Neto no gravado",
  TotMntExpyAsim: "Exportación y asimiladas",
  TotMntImpPerc: "Impuesto percibido",
  TotMntIVAenSusp: "IVA en suspenso",
  TotMntIVATasaMin: "Neto tasa mínima",
  TotMntIVATasaBas: "Neto tasa básica",
  TotMntIVAOtra: "Neto otra tasa",
  MntIVATasaMin: "IVA tasa mínima",
  MntIVATasaBas: "IVA tasa básica",
  MntIVAOtra: "IVA otra tasa",
  IVATasaMin: "% tasa mínima",
  IVATasaBas: "% tasa básica",
  TotMntTotal: "Total",
  TotMntRetenido: "Retenido",
  TotValRetPerc: "Retenido / percibido",
};
