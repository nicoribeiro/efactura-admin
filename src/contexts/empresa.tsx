import { useList, useOne } from "@refinedev/core";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface Empresa {
  id: number;
  rut: string;
  razon?: string;
  nombreComercial?: string;
  emisorElectronico?: boolean;
  mailRecepcion?: string;
  hostRecepcion?: string;
  puertoRecepcion?: string;
  userRecepcion?: string;
  mailNotificaciones?: string;
  paginaWeb?: string;
  resolucion?: string;
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

const RUT_KEY = "efactura-empresa-rut";

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
