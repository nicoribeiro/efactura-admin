import { EyeOutlined, FilePdfOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import { useNotification, type CrudFilters } from "@refinedev/core";
import { Button, Space, Table, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ESTADOS_CFE,
  formatFechaApi,
  tipoDocByName,
  type Direccion,
} from "../../constants/cfe";
import { useEmpresa, type EmpresaRef } from "../../contexts/empresa";
import { documentoId } from "../../providers/dataProvider";
import { rangoPorDefecto, type Rango } from "../../utils/rangos";
import { FiltrosComprobantes } from "./filtros";
import { abrirPdf } from "./pdf";

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
 * Filtros iniciales desde la URL, para abrir el listado ya filtrado (ej. desde el tablero):
 * /documentos?estado=BE&desde=2026-09-13&hasta=2026-10-12&direccion=EMITIDO
 */
function filtrosDesdeUrl(params: URLSearchParams) {
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  const fecha: Rango =
    desde && hasta && dayjs(desde).isValid() && dayjs(hasta).isValid()
      ? [dayjs(desde), dayjs(hasta)]
      : rangoPorDefecto();
  const estado = params.get("estado")?.toUpperCase();
  return {
    direccion: (params.get("direccion") === "RECIBIDO"
      ? "RECIBIDO"
      : "EMITIDO") as Direccion,
    fecha,
    estado:
      estado && ["AE", "BE", "CE", "SIN"].includes(estado) ? estado : undefined,
  };
}

export const etiquetaEmpresa = (empresa?: EmpresaRef | null) =>
  empresa?.rut ? `${empresa.rut} - ${empresa.razon ?? ""}` : undefined;

export function DocumentoList() {
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const { open } = useNotification();

  // Por defecto emitidos de los ultimos 30 dias; la URL puede traer otros filtros (se fija al montar la pantalla)
  const [searchParams] = useSearchParams();
  const [inicial] = useState(() => filtrosDesdeUrl(searchParams));

  const { tableProps, searchFormProps, filters } = useTable<
    Documento,
    never,
    FiltrosForm
  >({
    resource: "documentos",
    syncWithLocation: false,
    meta: { rut: empresa?.rut },
    queryOptions: { enabled: !!empresa },
    pagination: { pageSize: 20 },
    filters: {
      initial: [
        { field: "direccion", operator: "eq", value: inicial.direccion },
        { field: "fecha", operator: "eq", value: aFiltroFecha(inicial.fecha) },
        { field: "estado", operator: "eq", value: inicial.estado },
      ],
    },
    onSearch: (values): CrudFilters => {
      // Tipo y serie filtran el listado; con los tres (tipo, serie y numero) la API busca un comprobante puntual
      const serie = values.serie?.trim() || undefined;
      const puntual = values.idTipoDoc && serie && values.nro;
      return [
        { field: "direccion", operator: "eq", value: values.direccion },
        { field: "fecha", operator: "eq", value: aFiltroFecha(values.fecha) },
        { field: "estado", operator: "eq", value: values.estado },
        { field: "idTipoDoc", operator: "eq", value: values.idTipoDoc },
        { field: "serie", operator: "eq", value: serie },
        {
          field: "nro",
          operator: "eq",
          value: puntual ? values.nro : undefined,
        },
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
    },
  });

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
    <List title={`Comprobantes - ${empresa.razon ?? empresa.rut}`}>
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
          render={formatFechaApi}
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
          render={(estado?: string | null) =>
            estado ? (
              <Tag color={ESTADOS_CFE[estado]?.color}>
                {ESTADOS_CFE[estado]?.label ?? estado}
              </Tag>
            ) : (
              <Tag>Sin respuesta</Tag>
            )
          }
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
