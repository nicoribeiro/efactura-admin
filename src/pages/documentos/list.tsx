import { EyeOutlined, FilePdfOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import { useNotification, type CrudFilters } from "@refinedev/core";
import { Button, Space, Table, Tag, Tooltip, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  formatFechaDia,
  tipoDocByName,
  type Direccion,
} from "../../constants/cfe";
import { useEmpresa, type EmpresaRef } from "../../contexts/empresa";
import { documentoId } from "../../providers/dataProvider";
import { rangoPorDefecto, type Rango } from "../../utils/rangos";
import { FiltrosComprobantes } from "./filtros";
import { abrirPdf } from "./pdf";
import { ExportarCsv } from "./exportar";
import { EstadoDgiTag } from "./rechazo";

/** Rango del formulario -> filtro: desde el inicio del primer dia hasta el final del ultimo */
const aFiltroFecha = (fecha?: [Dayjs | null, Dayjs | null] | null) =>
  fecha?.[0] && fecha?.[1]
    ? [fecha[0].startOf("day").toDate(), fecha[1].endOf("day").toDate()]
    : undefined;

export interface Documento {
  id: number;
  tipo: string;
  serie: string;
  nro: number;
  fechaEmision?: string;
  moneda?: string;
  totMntTotal?: number;
  estado?: string | null;
  titular?: { documento?: string; tipoDocumento?: string } | null;
  empresaEmisora?: EmpresaRef | null;
  empresaReceptora?: EmpresaRef | null;
  /** Respuesta al CFE (ME_): AE aceptado, BE rechazado, PENDIENTE (recibidos), RECIBIDA (sin estado legible) */
  respuestaME?: string | null;
}

/** Estados de la respuesta al CFE entre empresas (ME_) */
const RESPUESTAS: Record<string, { label: string; color: string; ayuda: string }> = {
  AE: { label: "AE", color: "green", ayuda: "Comprobante aceptado" },
  BE: { label: "BE", color: "red", ayuda: "Comprobante rechazado" },
  PENDIENTE: { label: "Pendiente", color: "gold", ayuda: "Todavía no se le envió al emisor" },
  ENVIADA: { label: "Enviada", color: "green", ayuda: "Respuesta enviada" },
  RECIBIDA: { label: "Recibida", color: "blue", ayuda: "Respuesta recibida (no se pudo leer el estado)" },
};

function RespuestaTag({ estado, quien }: { estado?: string | null; quien: string }) {
  if (!estado)
    return (
      <Tooltip title={`Sin respuesta ${quien}`}>
        <Typography.Text type="secondary">-</Typography.Text>
      </Tooltip>
    );
  const r = RESPUESTAS[estado];
  return (
    <Tooltip title={`${r?.ayuda ?? estado} (${quien})`}>
      <Tag color={r?.color} style={{ marginInlineEnd: 0 }}>
        {r?.label ?? estado}
      </Tag>
    </Tooltip>
  );
}

interface FiltrosForm {
  direccion: Direccion;
  fecha?: [Dayjs | null, Dayjs | null] | null;
  idTipoDoc?: number;
  serie?: string;
  nro?: number;
  rutReceptor?: string;
  razonReceptor?: string;
  estado?: string;
}

/**
 * Filtros y pagina en la URL: el listado se puede abrir ya filtrado (ej. desde el tablero) y al volver del detalle
 * conserva lo que se estaba viendo. Ej: /documentos?direccion=EMITIDO&estado=BE&desde=2026-09-13&hasta=2026-10-12
 */
function filtrosDesdeUrl(params: URLSearchParams): FiltrosForm & {
  fecha: Rango;
  page: number;
} {
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  const fecha: Rango =
    desde && hasta && dayjs(desde).isValid() && dayjs(hasta).isValid()
      ? [dayjs(desde), dayjs(hasta)]
      : rangoPorDefecto();
  const estado = params.get("estado")?.toUpperCase();
  const numero = (clave: string) => {
    const n = Number(params.get(clave));
    return params.get(clave) && Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const texto = (clave: string) => params.get(clave)?.trim() || undefined;
  return {
    direccion: (params.get("direccion") === "RECIBIDO"
      ? "RECIBIDO"
      : "EMITIDO") as Direccion,
    fecha,
    estado:
      estado && ["AE", "BE", "CE", "SIN"].includes(estado) ? estado : undefined,
    idTipoDoc: numero("idTipoDoc"),
    serie: texto("serie"),
    nro: numero("nro"),
    rutReceptor: texto("rutReceptor"),
    razonReceptor: texto("razonReceptor"),
    page: numero("page") ?? 1,
  };
}

function filtrosAUrl(valores: FiltrosForm, page: number) {
  const params = new URLSearchParams({ direccion: valores.direccion });
  if (valores.fecha?.[0] && valores.fecha?.[1]) {
    params.set("desde", valores.fecha[0].format("YYYY-MM-DD"));
    params.set("hasta", valores.fecha[1].format("YYYY-MM-DD"));
  }
  const opcionales = {
    estado: valores.estado || undefined,
    idTipoDoc: valores.idTipoDoc,
    serie: valores.serie?.trim(),
    nro: valores.nro,
    rutReceptor: valores.rutReceptor?.trim(),
    razonReceptor: valores.razonReceptor?.trim(),
  };
  for (const [clave, valor] of Object.entries(opcionales))
    if (valor !== undefined && valor !== null && valor !== "")
      params.set(clave, String(valor));
  if (page > 1) params.set("page", String(page));
  return params;
}

/** Valores del formulario -> filtros de la API */
function aFiltros(values: FiltrosForm): CrudFilters {
  // Tipo, serie y numero filtran el listado (cualquiera, solo o combinados). Con los tres juntos la API busca un
  // unico comprobante: en emitidos sirve, pero en recibidos exige el RUT del emisor, asi que ahi se omite la serie
  // y el listado filtra por tipo y numero (de todos los emisores)
  const serie = values.serie?.trim() || undefined;
  const recibidoPuntual =
    values.direccion === "RECIBIDO" && values.idTipoDoc && serie && values.nro;
  return [
    { field: "direccion", operator: "eq", value: values.direccion },
    { field: "fecha", operator: "eq", value: aFiltroFecha(values.fecha) },
    { field: "estado", operator: "eq", value: values.estado || undefined },
    { field: "idTipoDoc", operator: "eq", value: values.idTipoDoc },
    {
      field: "serie",
      operator: "eq",
      value: recibidoPuntual ? undefined : serie,
    },
    { field: "nro", operator: "eq", value: values.nro ?? undefined },
    {
      field: "rutReceptor",
      operator: "eq",
      value: values.rutReceptor?.trim() || undefined,
    },
    {
      field: "razonReceptor",
      operator: "eq",
      value: values.razonReceptor?.trim() || undefined,
    },
  ];
}

export const etiquetaEmpresa = (empresa?: EmpresaRef | null) =>
  empresa?.rut ? `${empresa.rut} - ${empresa.razon ?? ""}` : undefined;

export function DocumentoList() {
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const { open } = useNotification();

  // Por defecto emitidos de los ultimos 30 dias; la URL puede traer filtros y pagina (se leen al montar la pantalla)
  const [searchParams, setSearchParams] = useSearchParams();
  const [inicial] = useState(() => filtrosDesdeUrl(searchParams));
  // Ultimos valores buscados (los del formulario, no los filtros: en recibidos la serie puede no ir a la API)
  const buscados = useRef<FiltrosForm>(inicial);

  const { tableProps, searchFormProps, filters } = useTable<
    Documento,
    never,
    FiltrosForm
  >({
    resource: "documentos",
    syncWithLocation: false,
    meta: { rut: empresa?.rut },
    queryOptions: { enabled: !!empresa },
    pagination: { pageSize: 20, currentPage: inicial.page },
    // replace: cada busqueda manda todos los filtros; con merge (por defecto) un filtro borrado (ej. Estado DGI en
    // "Todos") no se sacaba y seguia aplicando el anterior
    filters: { initial: aFiltros(inicial), defaultBehavior: "replace" },
    onSearch: (values) => {
      buscados.current = values;
      return aFiltros(values);
    },
  });

  // Filtros y pagina a la URL (sin agregar entradas al historial), para que "volver" desde el detalle los recupere
  const pagina = tableProps.pagination
    ? (tableProps.pagination.current ?? 1)
    : 1;
  useEffect(() => {
    setSearchParams(filtrosAUrl(buscados.current, pagina), { replace: true });
  }, [filters, pagina, setSearchParams]);

  const direccion = (filters.find(
    (f) => "field" in f && f.field === "direccion",
  )?.value ?? "EMITIDO") as Direccion;

  const verDocumento = (doc: Documento) => {
    const tipo = tipoDocByName(doc.tipo);
    if (!tipo) return;
    const params = new URLSearchParams({ direccion });
    const rutEmisor = doc.empresaEmisora?.rut;
    if (direccion === "RECIBIDO" && rutEmisor)
      params.set("rutExterno", rutEmisor);
    navigate(
      `/documentos/show/${encodeURIComponent(documentoId(tipo.id, doc.serie, doc.nro))}?${params}`,
    );
  };

  const pdf = async (doc: Documento) => {
    const tipo = tipoDocByName(doc.tipo);
    if (!tipo || !empresa) return;
    const emisor =
      direccion === "RECIBIDO" ? doc.empresaEmisora?.rut : undefined;
    try {
      await abrirPdf(
        empresa.rut,
        { idTipoDoc: tipo.id, serie: doc.serie, nro: doc.nro },
        emisor,
      );
    } catch (error) {
      open?.({
        type: "error",
        message: "No se pudo obtener el PDF",
        description: (error as Error).message,
      });
    }
  };

  if (!empresa)
    return <Typography.Text>Seleccione una empresa.</Typography.Text>;

  return (
    <List
      title={`Comprobantes - ${empresa.razon ?? empresa.rut}`}
      headerButtons={
        <ExportarCsv
          rut={empresa.rut}
          filters={filters}
          total={tableProps.pagination ? (tableProps.pagination.total ?? 0) : 0}
        />
      }
    >
      <FiltrosComprobantes
        searchFormProps={searchFormProps}
        filters={filters}
        valoresIniciales={inicial}
      />

      <Table
        {...tableProps}
        rowKey="id"
        size="middle"
        onRow={(doc) => ({ onDoubleClick: () => verDocumento(doc) })}
      >
        <Table.Column<Documento>
          title="Tipo"
          dataIndex="tipo"
          render={(tipo: string) => tipoDocByName(tipo)?.label ?? tipo}
        />
        <Table.Column<Documento>
          title="Serie / Nro"
          render={(_, doc) => `${doc.serie}-${doc.nro}`}
        />
        <Table.Column<Documento>
          title="Fecha"
          dataIndex="fechaEmision"
          render={formatFechaDia}
        />
        <Table.Column<Documento>
          title={direccion === "EMITIDO" ? "Receptor" : "Emisor"}
          render={(_, doc) =>
            direccion === "EMITIDO"
              ? (etiquetaEmpresa(doc.empresaReceptora) ??
                doc.titular?.documento ??
                "-")
              : (etiquetaEmpresa(doc.empresaEmisora) ?? "-")
          }
        />
        <Table.Column<Documento> title="Moneda" dataIndex="moneda" />
        <Table.Column<Documento>
          title="Total"
          dataIndex="totMntTotal"
          align="right"
          render={(value?: number) =>
            value != null
              ? value.toLocaleString("es-UY", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : ""
          }
        />
        <Table.Column<Documento>
          title="Estado DGI"
          dataIndex="estado"
          render={(estado: string | null | undefined, doc) => {
            // En rechazados/observados, el motivo de DGI al pasar el mouse
            const tipo = tipoDocByName(doc.tipo);
            return (
              <EstadoDgiTag
                estado={estado}
                rut={empresa?.rut}
                documento={
                  tipo
                    ? { idTipoDoc: tipo.id, serie: doc.serie, nro: doc.nro }
                    : undefined
                }
                direccion={direccion}
                rutExterno={
                  direccion === "RECIBIDO" ? doc.empresaEmisora?.rut : undefined
                }
              />
            );
          }}
        />
        <Table.Column<Documento>
          title={
            <Tooltip title={direccion === "EMITIDO" ? "Respuesta del receptor al comprobante (ME_)" : "Nuestra respuesta al comprobante (ME_)"}>
              ME
            </Tooltip>
          }
          dataIndex="respuestaME"
          align="center"
          render={(estado?: string | null) => (
            <RespuestaTag estado={estado} quien={direccion === "EMITIDO" ? "del receptor" : "nuestra"} />
          )}
        />
        <Table.Column<Documento>
          title=""
          render={(_, doc) => (
            <Space>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => verDocumento(doc)}
              />
              <Button
                size="small"
                icon={<FilePdfOutlined />}
                onClick={() => pdf(doc)}
              />
            </Space>
          )}
        />
      </Table>
    </List>
  );
}
