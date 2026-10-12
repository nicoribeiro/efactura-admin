import { ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TemaContext, type ModoTema } from "./tema";

const STORAGE_KEY = "efactura-tema";
const CONSULTA_OSCURO = "(prefers-color-scheme: dark)";

function modoGuardado(): ModoTema {
  try {
    const valor = localStorage.getItem(STORAGE_KEY);
    return valor === "claro" || valor === "oscuro" ? valor : "sistema";
  } catch {
    return "sistema";
  }
}

/** Tema claro/oscuro del panel: por defecto sigue al sistema operativo; la eleccion se guarda en el navegador */
export function TemaProvider({ children }: { children: ReactNode }) {
  const [modo, setModoState] = useState<ModoTema>(modoGuardado);
  const [sistemaOscuro, setSistemaOscuro] = useState(
    () => window.matchMedia?.(CONSULTA_OSCURO).matches ?? false,
  );

  // Cambios del sistema operativo mientras el panel esta abierto
  useEffect(() => {
    const media = window.matchMedia?.(CONSULTA_OSCURO);
    if (!media) return;
    const alCambiar = (e: MediaQueryListEvent) => setSistemaOscuro(e.matches);
    media.addEventListener("change", alCambiar);
    return () => media.removeEventListener("change", alCambiar);
  }, []);

  const oscuro = modo === "oscuro" || (modo === "sistema" && sistemaOscuro);

  // Barras de scroll, controles nativos y fondo de la pagina acordes al tema
  useEffect(() => {
    document.documentElement.style.colorScheme = oscuro ? "dark" : "light";
  }, [oscuro]);

  const valor = useMemo(
    () => ({
      modo,
      oscuro,
      setModo: (nuevo: ModoTema) => {
        setModoState(nuevo);
        try {
          if (nuevo === "sistema") localStorage.removeItem(STORAGE_KEY);
          else localStorage.setItem(STORAGE_KEY, nuevo);
        } catch {
          // Sin almacenamiento (modo privado): la eleccion dura hasta recargar
        }
      },
    }),
    [modo, oscuro],
  );

  return (
    <TemaContext.Provider value={valor}>
      <ConfigProvider
        locale={esES}
        theme={{
          algorithm: oscuro ? theme.darkAlgorithm : theme.defaultAlgorithm,
        }}
      >
        {children}
      </ConfigProvider>
    </TemaContext.Provider>
  );
}
