import { tipoDocByName } from "../../constants/cfe";
import type { EmpresaRef } from "../../contexts/empresa";
import type { Sobre } from "../documentos/useSobre";

/** Comprobante resumido dentro de un sobre (SobresController.resumenCfe) */
export interface ComprobanteResumen {
  id: number;
  tipo: string;
  idTipoDoc: number;
  serie: string;
  nro: number;
  fechaEmision?: string | null;
  moneda?: string | null;
  totMntTotal?: number | null;
  estado?: string | null;
  empresaEmisora?: EmpresaRef | null;
  empresaReceptora?: EmpresaRef | null;
  titular?: string | null;
}

/** Fila del listado de sobres (SobresController.resumenSobre) */
export interface SobreResumen {
  id: number;
  direccion: "EMITIDO" | "RECIBIDO";
  fecha?: string | null;
  nombreArchivo?: string | null;
  cantComprobantes?: number | null;
  estadoDgi?: string | null;
  estadoEmpresa?: string | null;
  fechaConsulta?: string | null;
  timestampRecibido?: string | null;
  timestampProcesado?: string | null;
  /** Emitidos: false si el sobre nunca se le envio al receptor (no es emisor electronico), no va a responder */
  enviadoAEmpresa?: boolean;
  empresaEmisora?: EmpresaRef | null;
  empresaReceptora?: EmpresaRef | null;
  comprobantes: ComprobanteResumen[];
}

/** Detalle de un sobre (GET /empresa/:rut/sobre?idSobre=) */
export type SobreDetalle = Sobre & {
  direccion: "EMITIDO" | "RECIBIDO";
  empresaEmisora?: EmpresaRef | null;
  empresaReceptora?: EmpresaRef | null;
  comprobantes: ComprobanteResumen[];
};

/** Estados de un sobre (EstadoACKSobreType) */
export const ESTADOS_SOBRE: Record<string, { label: string; color: string }> = {
  AS: { label: "Recibido", color: "green" },
  BS: { label: "Rechazado", color: "red" },
  BA: { label: "BA", color: "orange" },
};

/** Filtro de estado del listado de sobres (SIN = sin estado) */
export const ESTADOS_SOBRE_FILTRO = [
  { value: "AS", label: "Recibido" },
  { value: "BS", label: "Rechazado" },
  { value: "SIN", label: "Sin respuesta" },
];

/** "eFactura A-2311" */
export const etiquetaComprobante = (
  c: Pick<ComprobanteResumen, "tipo" | "serie" | "nro">,
) => `${tipoDocByName(c.tipo)?.label ?? c.tipo} ${c.serie}-${c.nro}`;
