import { createContext, useContext } from "react";

/** Preferencia del usuario: seguir al sistema operativo o fijar claro/oscuro */
export type ModoTema = "sistema" | "claro" | "oscuro";

export interface TemaContextValue {
  modo: ModoTema;
  setModo: (modo: ModoTema) => void;
  /** Tema efectivo (con "sistema", el del sistema operativo) */
  oscuro: boolean;
}

export const TemaContext = createContext<TemaContextValue>({
  modo: "sistema",
  setModo: () => {},
  oscuro: false,
});

export const useTema = () => useContext(TemaContext);
