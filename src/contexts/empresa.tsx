import { useList, useOne } from "@refinedev/core";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FirmaDigital } from "../constants/firma";

export interface Empresa {
  id: number;
  rut: string;
  razon?: string;
  nombreComercial?: string;
  emisorElectronico?: boolean;
  /** Datos de emisor electronico segun DGI (yyyy-MM-dd); los guarda la sincronizacion de emisores */
  fechaInicioEmisorDgi?: string | null;
  fechaFinTransicionDgi?: string | null;
  fechaFinEmisorDgi?: string | null;
  urlWebserviceDgi?: string | null;
  mailContactoTecnicoDgi?: string | null;
  mailRecepcion?: string;
  hostRecepcion?: string;
  puertoRecepcion?: string;
  userRecepcion?: string;
  mailNotificaciones?: string;
  fromEnvio?: string;
  paginaWeb?: string;
  resolucion?: string;
  /** Tiene logo cargado (GET /empresa/:rut/logo) */
  tieneLogo?: boolean;
  firmaDigital?: FirmaDigital | null;
  /** Dias de espera de la respuesta a los CFE recibidos (ME_): null = el de la configuracion, -1 = solo a mano */
  diasRespuestaCfe?: number | null;
  /** El que rige (el de la empresa o el de la configuracion) */
  diasRespuestaCfeEfectivo?: number;
  /** false = dada de baja: los procesos automaticos (avisos, emails entrantes, reporte diario) no la procesan */
  activa?: boolean;
  /**
   * Reporte diario: automatico = lo manda el poller de la API; hastaEsperado (yyyy-MM-dd) = ultimo dia que ya deberia
   * estar reportado (los mas nuevos se mandan con atraso a proposito). Sin el campo (API anterior): hasta anteayer.
   */
  reporteDiario?: { automatico: boolean; hastaEsperado: string | null };
}

/** Version reducida que la API incluye dentro de CFE, sobres, CAE y reportes */
export interface EmpresaRef {
  id: number;
  rut?: string;
  razon?: string;
}

interface EmpresaContextValue {
  /** Empresa seleccionada en el encabezado */
  empresa?: Empresa;
  setRut: (rut: string) => void;
  /** Opciones del selector: empresas con firma digital, o el resultado de la busqueda */
  opciones: Empresa[];
  buscar: (texto: string) => void;
  loading: boolean;
}

const EmpresaContext = createContext<EmpresaContextValue | undefined>(undefined);

/** Empresa elegida en el encabezado; se borra al salir (la puede haber elegido otro usuario en el mismo navegador) */
export const RUT_KEY = "efactura-empresa-rut";

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [rut, setRutState] = useState<string | null>(() => localStorage.getItem(RUT_KEY));
  const [busqueda, setBusqueda] = useState("");

  // Sin busqueda: las empresas con firma digital (las que se gestionan con el sistema). Con busqueda: todas.
  const { result: lista, query: listaQuery } = useList<Empresa>({
    resource: "empresas",
    pagination: { currentPage: 1, pageSize: 50 },
    filters: busqueda
      ? [{ field: "q", operator: "eq", value: busqueda }]
      : [{ field: "conFirma", operator: "eq", value: "true" }],
  });

  const { result: seleccionada, query: seleccionadaQuery } = useOne<Empresa>({
    resource: "empresas",
    id: rut ?? "",
    queryOptions: { enabled: !!rut },
  });

  const setRut = (value: string) => {
    localStorage.setItem(RUT_KEY, value);
    setRutState(value);
    setBusqueda("");
  };

  // La empresa guardada ya no es accesible (sin acceso a esa empresa, o no existe): se olvida y se toma la primera de
  // la lista. Si no, cada pantalla la vuelve a pedir y la API la rechaza en un bucle.
  const estadoError = (seleccionadaQuery.error as { statusCode?: number } | null)?.statusCode;
  useEffect(() => {
    if (rut && (estadoError === 401 || estadoError === 403 || estadoError === 404)) {
      localStorage.removeItem(RUT_KEY);
      setRutState(null);
    }
  }, [rut, estadoError]);

  // Si no hay empresa elegida se toma la primera con firma digital
  useEffect(() => {
    if (!rut && !busqueda && lista?.data?.length) setRut(lista.data[0].rut);
  }, [rut, busqueda, lista]);

  const opciones = useMemo(() => {
    const data = lista?.data ?? [];
    // La seleccionada siempre aparece en las opciones, aunque no tenga firma o no coincida con la busqueda
    return seleccionada && !data.some((e) => e.rut === seleccionada.rut) ? [seleccionada, ...data] : data;
  }, [lista, seleccionada]);

  const value: EmpresaContextValue = {
    empresa: seleccionada,
    setRut,
    opciones,
    buscar: setBusqueda,
    loading: listaQuery.isLoading || seleccionadaQuery.isLoading,
  };

  return <EmpresaContext.Provider value={value}>{children}</EmpresaContext.Provider>;
}

export function useEmpresa() {
  const context = useContext(EmpresaContext);
  if (!context) throw new Error("useEmpresa debe usarse dentro de EmpresaProvider");
  return context;
}
