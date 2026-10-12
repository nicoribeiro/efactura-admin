import { Input, List, Modal, Space, Tag, Tooltip, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";
import { apiJson } from "../api/http";
import {
  ESTADOS_CFE,
  formatFechaApi,
  tipoDocByName,
  type Direccion,
} from "../constants/cfe";
import { useEmpresa } from "../contexts/empresa";
import type { Documento } from "../pages/documentos/list";
import { parseBusqueda, urlDocumento } from "../utils/busqueda";

interface Resultado {
  doc: Documento;
  direccion: Direccion;
  url: string;
}

const MAXIMO = 20;

/**
 * Busca un comprobante por numero (con serie y tipo opcionales) en emitidos y recibidos de la empresa seleccionada.
 * Un resultado: abre el detalle. Varios: lista para elegir.
 */
export function BuscarComprobante() {
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string>();
  const [resultados, setResultados] = useState<Resultado[] | null>(null);

  const buscar = async (valor: string) => {
    setError(undefined);
    if (!valor.trim()) return;
    const busqueda = parseBusqueda(valor);
    if (!busqueda) {
      setError("Formato: 2311, A-2311 o 111 A-2311");
      return;
    }
    if (!empresa) return;

    setBuscando(true);
    try {
      // Tipo, serie y numero juntos son la consulta de un unico emitido en la API: el tipo se filtra aca
      const consultar = (direccion: Direccion) =>
        apiJson<{ results: Documento[] }>(
          "GET",
          `/empresa/${empresa.rut}/documentos`,
          {
            direccion,
            nro: busqueda.nro,
            serie: busqueda.serie,
            page: 1,
            pageSize: MAXIMO,
          },
        ).then((r) =>
          r.results
            // Tambien filtra en el cliente: una API sin el filtro nro devuelve el listado completo
            .filter(
              (doc) =>
                doc.nro === busqueda.nro &&
                (!busqueda.serie || doc.serie === busqueda.serie) &&
                (!busqueda.idTipoDoc ||
                  tipoDocByName(doc.tipo)?.id === busqueda.idTipoDoc),
            )
            .map((doc) => ({
              doc,
              direccion,
              url: urlDocumento(doc, direccion),
            }))
            .filter((r): r is Resultado => !!r.url),
        );

      const [emitidos, recibidos] = await Promise.allSettled([
        consultar("EMITIDO"),
        consultar("RECIBIDO"),
      ]);
      const encontrados = [emitidos, recibidos].flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      );
      if (encontrados.length === 1) {
        navigate(encontrados[0].url);
        setTexto("");
      } else if (encontrados.length > 1) setResultados(encontrados);
      else if (
        emitidos.status === "rejected" &&
        recibidos.status === "rejected"
      )
        setError((emitidos.reason as Error)?.message ?? "Error al buscar");
      else setError(`No se encontró ${valor.trim().toUpperCase()}`);
    } finally {
      setBuscando(false);
    }
  };

  const etiqueta = (doc: Documento) =>
    `${tipoDocByName(doc.tipo)?.label ?? doc.tipo} ${doc.serie}-${doc.nro}`;

  return (
    <>
      <Tooltip open={!!error} title={error} placement="bottom">
        <Input.Search
          allowClear
          placeholder="Comprobante (ej. A-2311)"
          // Como bloque lo centra el flex del encabezado; en linea se alinea al texto (line-height 64px) y queda arriba
          style={{ width: 250, display: "block" }}
          value={texto}
          status={error ? "warning" : undefined}
          loading={buscando}
          disabled={!empresa}
          onChange={(e) => {
            setTexto(e.target.value);
            setError(undefined);
          }}
          onSearch={(valor) => buscar(valor)}
          onBlur={() => setError(undefined)}
        />
      </Tooltip>

      <Modal
        open={!!resultados}
        title={`${resultados?.length ?? 0} comprobantes con ese número`}
        footer={null}
        onCancel={() => setResultados(null)}
      >
        <List
          dataSource={resultados ?? []}
          renderItem={(r) => (
            <List.Item
              style={{ cursor: "pointer" }}
              onClick={() => {
                setResultados(null);
                setTexto("");
                navigate(r.url);
              }}
            >
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Typography.Link>{etiqueta(r.doc)}</Typography.Link>
                    <Tag>
                      {r.direccion === "EMITIDO" ? "Emitido" : "Recibido"}
                    </Tag>
                    {r.doc.estado && (
                      <Tag color={ESTADOS_CFE[r.doc.estado]?.color}>
                        {ESTADOS_CFE[r.doc.estado]?.label ?? r.doc.estado}
                      </Tag>
                    )}
                  </Space>
                }
                description={[
                  formatFechaApi(r.doc.fechaEmision).slice(0, 10),
                  r.direccion === "EMITIDO"
                    ? (r.doc.empresaReceptora?.razon ??
                      r.doc.titular?.documento)
                    : r.doc.empresaEmisora?.razon,
                  r.doc.totMntTotal != null
                    ? `${r.doc.moneda ?? ""} ${r.doc.totMntTotal.toLocaleString("es-UY", { minimumFractionDigits: 2 })}`
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
