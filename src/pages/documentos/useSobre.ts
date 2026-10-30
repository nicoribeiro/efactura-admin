import { useEffect, useState } from "react";
import { apiJson } from "../../api/http";

export interface Respuesta {
  id: number;
  nombreArchivo?: string | null;
  payload?: string | null;
}

/** SobreSerializer (version completa) */
export interface Sobre {
  id: number;
  nombreArchivo?: string | null;
  fecha?: string | null;
  idEmisor?: number | null;
  idReceptor?: number | null;
  cantComprobantes?: number | null;
  estadoEmpresa?: string | null;
  motivo?: string | null;
  xmlEmpresa?: string | null;
  respuestaSobre?: Respuesta | null;
  respuestaCfes?: Respuesta | null;
  // Emitido
  estadoDgi?: string | null;
  fechaConsulta?: string | null;
  xmlDgi?: string | null;
  respuesta_dgi?: string | null;
  resultado_dgi?: string | null;
  /** Ultimo error al enviar el sobre a DGI (null si nunca fallo o si DGI ya lo recibio) */
  errorEnvioDgi?: string | null;
  fechaUltimoIntentoDgi?: string | null;
  /** null en los sobres anteriores a este registro */
  intentosDgi?: number | null;
  /** DGI acepto algun CFE del sobre: recien entonces se le manda el sobre a la empresa receptora */
  cfeAceptadoDgi?: boolean;
  // Recibido
  timestampRecibido?: string | null;
  timestampProcesado?: string | null;
  /** La respuesta a sus CFE (ME_) todavia no se envio */
  respuestaCfePendiente?: boolean;
  /** Cuando se envia sola (null: la empresa responde a mano o no esta pendiente) */
  respuestaCfeProgramada?: string | null;
  /** Controles del sobre (S02-S06, S20) que no paso */
  observacionesRecepcion?: string | null;
}

export interface SobreDocumento {
  direccion: "EMITIDO" | "RECIBIDO";
  sobre: Sobre | null;
}

export interface DocumentoRef {
  idTipoDoc: number;
  serie: string;
  nro: number;
}

export interface EstadoSobre {
  data: SobreDocumento | null;
  error: { message?: string; statusCode?: number } | null;
  loading: boolean;
}

/** Sobre (emitido o recibido) en el que viajo un comprobante */
export const obtenerSobreDocumento = (
  rut: string,
  documento: DocumentoRef,
  direccion: string,
  rutExterno?: string,
) =>
  apiJson<SobreDocumento>("GET", `/empresa/${rut}/documentos/sobre`, {
    ...documento,
    direccion,
    rutExterno,
  });

/** Carga el sobre de un comprobante una vez, para compartirlo entre secciones del detalle */
export function useSobreDocumento(
  rut: string | undefined,
  documento: DocumentoRef | undefined,
  direccion: string,
  rutExterno?: string,
  /** Cambiarlo vuelve a cargar el sobre */
  recarga = 0,
): EstadoSobre {
  const [estado, setEstado] = useState<EstadoSobre>({
    data: null,
    error: null,
    loading: true,
  });
  const idTipoDoc = documento?.idTipoDoc;
  const serie = documento?.serie;
  const nro = documento?.nro;

  useEffect(() => {
    if (
      !rut ||
      idTipoDoc === undefined ||
      serie === undefined ||
      nro === undefined
    )
      return;
    let cancelado = false;
    setEstado({ data: null, error: null, loading: true });
    obtenerSobreDocumento(rut, { idTipoDoc, serie, nro }, direccion, rutExterno)
      .then(
        (data) =>
          !cancelado && setEstado({ data, error: null, loading: false }),
      )
      .catch(
        (error) =>
          !cancelado && setEstado({ data: null, error, loading: false }),
      );
    return () => {
      cancelado = true;
    };
  }, [rut, idTipoDoc, serie, nro, direccion, rutExterno, recarga]);

  return estado;
}
