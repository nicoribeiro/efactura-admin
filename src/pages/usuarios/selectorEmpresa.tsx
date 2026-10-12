import { Select, type SelectProps } from "antd";
import { useEffect, useState } from "react";
import { apiJson } from "../../api/http";

interface EmpresaOpcion {
  rut: string;
  razon?: string | null;
}

/**
 * Selector de empresas por RUT o razon social. Sin texto ofrece las que tienen firma digital (las que emiten con el
 * sistema); con texto busca en la API.
 */
export function SelectorEmpresa(
  props: Omit<
    SelectProps<string | string[]>,
    "options" | "onSearch" | "showSearch"
  >,
) {
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<EmpresaOpcion[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const timer = setTimeout(() => {
      setCargando(true);
      const query = texto.trim()
        ? { q: texto.trim(), page: 1, pageSize: 20 }
        : { conFirma: true, page: 1, pageSize: 50 };
      apiJson<{ results: EmpresaOpcion[] }>("GET", "/empresa", query)
        .then((r) => !cancelado && setOpciones(r.results))
        .catch(() => !cancelado && setOpciones([]))
        .finally(() => !cancelado && setCargando(false));
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [texto]);

  return (
    <Select
      {...props}
      showSearch
      filterOption={false}
      onSearch={setTexto}
      loading={cargando}
      placeholder={props.placeholder ?? "Buscar por RUT o razón social"}
      notFoundContent={cargando ? "Buscando..." : "Sin resultados"}
      options={opciones.map((e) => ({
        value: e.rut,
        label: `${e.rut} - ${e.razon ?? ""}`,
      }))}
    />
  );
}
