import { useList } from "@refinedev/core";
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

interface EmpresaContextValue {
  empresas: Empresa[];
  empresa?: Empresa;
  setRut: (rut: string) => void;
  loading: boolean;
  /** La API serializa empresaEmisora/empresaReceptora de un CFE solo con su id */
  empresaById: (id?: number) => Empresa | undefined;
}

const EmpresaContext = createContext<EmpresaContextValue | undefined>(undefined);

const RUT_KEY = "efactura-empresa-rut";

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { result, query } = useList<Empresa>({ resource: "empresas", pagination: { mode: "off" } });
  const empresas = useMemo(() => result?.data ?? [], [result]);
  const [rut, setRutState] = useState<string | null>(() => localStorage.getItem(RUT_KEY));

  const setRut = (value: string) => {
    localStorage.setItem(RUT_KEY, value);
    setRutState(value);
  };

  // Si no hay empresa elegida (o ya no existe), se toma la primera emisora electronica
  useEffect(() => {
    if (empresas.length === 0) return;
    if (!rut || !empresas.some((e) => e.rut === rut)) {
      const inicial = empresas.find((e) => e.emisorElectronico) ?? empresas[0];
      setRut(inicial.rut);
    }
  }, [empresas, rut]);

  const value = useMemo<EmpresaContextValue>(
    () => ({
      empresas,
      empresa: empresas.find((e) => e.rut === rut),
      setRut,
      loading: query.isLoading,
      empresaById: (id?: number) => empresas.find((e) => e.id === id),
    }),
    [empresas, rut, query.isLoading],
  );

  return <EmpresaContext.Provider value={value}>{children}</EmpresaContext.Provider>;
}

export function useEmpresa() {
  const context = useContext(EmpresaContext);
  if (!context) throw new Error("useEmpresa debe usarse dentro de EmpresaProvider");
  return context;
}
