import { EyeOutlined, SearchOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import type { CrudFilters } from "@refinedev/core";
import {
  Button,
  DatePicker,
  Form,
  Segmented,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { formatFechaApi, formatFechaDia } from "../../constants/cfe";
import { useEmpresa } from "../../contexts/empresa";
import {
  mismoRango,
  rangoPorDefecto,
  rangosRapidos,
  type Rango,
} from "../../utils/rangos";
import { etiquetaEmpresa } from "../documentos/list";
import {
  EstadoSobreDgi,
  EstadoSobreTag,
  LinksComprobantes,
} from "./componentes";
import { ESTADOS_SOBRE_FILTRO, type SobreResumen } from "./tipos";

type Direccion = "EMITIDO" | "RECIBIDO";

interface FiltrosForm {
  direccion: Direccion;
  fecha?: Rango | null;
  estado?: string;
}

const aFiltroFecha = (fecha?: Rango | null) =>
  fecha?.[0] && fecha?.[1]
    ? [fecha[0].startOf("day").toDate(), fecha[1].endOf("day").toDate()]
    : undefined;

/**
 * Filtros y pagina en la URL (para abrir el listado ya filtrado y conservarlos al volver del detalle):
 * /sobres?direccion=EMITIDO&estado=BS&desde=2026-09-01&hasta=2026-09-30&page=2
 */
function filtrosDesdeUrl(params: URLSearchParams): FiltrosForm & {
  page: number;
} {
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  const estado = params.get("estado")?.toUpperCase();
  return {
    direccion: params.get("direccion") === "RECIBIDO" ? "RECIBIDO" : "EMITIDO",
    fecha:
      desde && hasta && dayjs(desde).isValid() && dayjs(hasta).isValid()
        ? [dayjs(desde), dayjs(hasta)]
        : rangoPorDefecto(),
    estado: estado && ["AS", "BS", "SIN"].includes(estado) ? estado : undefined,
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

function filtrosAUrl(valores: FiltrosForm, page: number) {
  const params = new URLSearchParams({ direccion: valores.direccion });
  if (valores.fecha?.[0] && valores.fecha?.[1]) {
    params.set("desde", valores.fecha[0].format("YYYY-MM-DD"));
    params.set("hasta", valores.fecha[1].format("YYYY-MM-DD"));
  }
  if (valores.estado) params.set("estado", valores.estado);
  if (page > 1) params.set("page", String(page));
  return params;
}

const aFiltros = (valores: FiltrosForm): CrudFilters => [
  { field: "direccion", operator: "eq", value: valores.direccion },
  { field: "fecha", operator: "eq", value: aFiltroFecha(valores.fecha) },
  { field: "estado", operator: "eq", value: valores.estado },
];

/** Sobres emitidos o recibidos por la empresa, con links a sus comprobantes (solo lectura) */
export function SobreList() {
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inicial] = useState(() => filtrosDesdeUrl(searchParams));
  const buscados = useRef<FiltrosForm>(inicial);

  const { tableProps, searchFormProps, filters } = useTable<
    SobreResumen,
    never,
    FiltrosForm
  >({
    resource: "sobres",
    syncWithLocation: false,
    meta: { rut: empresa?.rut },
    queryOptions: { enabled: !!empresa },
    pagination: { pageSize: 20, currentPage: inicial.page },
    filters: { initial: aFiltros(inicial) },
    onSearch: (valores) => {
      buscados.current = valores;
      return aFiltros(valores);
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
  const emitidos = direccion === "EMITIDO";

  const form = searchFormProps.form;
  const fecha = Form.useWatch("fecha", form) as Rango | undefined;

  if (!empresa)
    return <Typography.Text>Seleccione una empresa.</Typography.Text>;

  const ver = (sobre: SobreResumen) => navigate(`/sobres/show/${sobre.id}`);

  return (
    <List title={`Sobres - ${empresa.razon ?? empresa.rut}`}>
      <Form<FiltrosForm>
        {...searchFormProps}
        layout="vertical"
        initialValues={inicial}
        style={{ marginBottom: 16 }}
      >
        <Space wrap align="end" size={[16, 0]}>
          <Form.Item name="direccion" label="Sobres">
            <Segmented
              options={[
                { value: "EMITIDO", label: "Emitidos" },
                { value: "RECIBIDO", label: "Recibidos" },
              ]}
              onChange={() => form?.submit()}
            />
          </Form.Item>
          <Form.Item name="fecha" label="Período">
            <DatePicker.RangePicker
              format="DD/MM/YYYY"
              presets={rangosRapidos()}
            />
          </Form.Item>
          <Form.Item name="estado" label="Estado">
            <Select
              allowClear
              placeholder="Todos"
              style={{ width: 180 }}
              options={ESTADOS_SOBRE_FILTRO}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              Buscar
            </Button>
          </Form.Item>
        </Space>
        <Space wrap size={[8, 8]}>
          {rangosRapidos().map(({ label, value }) => (
            <Button
              key={label}
              size="small"
              type={fecha && mismoRango(fecha, value) ? "primary" : "default"}
              onClick={() => {
                form?.setFieldValue("fecha", value as [Dayjs, Dayjs]);
                form?.submit();
              }}
            >
              {label}
            </Button>
          ))}
        </Space>
      </Form>

      <Table
        {...tableProps}
        rowKey="id"
        size="middle"
        onRow={(sobre) => ({ onDoubleClick: () => ver(sobre) })}
      >
        <Table.Column<SobreResumen>
          title="Fecha"
          dataIndex="fecha"
          render={formatFechaDia}
        />
        <Table.Column<SobreResumen>
          title={emitidos ? "Receptor" : "Emisor"}
          render={(_, s) =>
            etiquetaEmpresa(emitidos ? s.empresaReceptora : s.empresaEmisora) ??
            (emitidos ? "DGI" : "-")
          }
        />
        <Table.Column<SobreResumen>
          title="Comprobantes"
          render={(_, s) => (
            <LinksComprobantes
              comprobantes={s.comprobantes}
              direccion={direccion}
            />
          )}
        />
        {emitidos ? (
          <>
            <Table.Column<SobreResumen>
              title="Estado DGI"
              render={(_, s) => (
                <EstadoSobreDgi
                  estado={s.estadoDgi}
                  rut={empresa.rut}
                  idSobre={s.id}
                />
              )}
            />
            <Table.Column<SobreResumen>
              title="Última consulta"
              dataIndex="fechaConsulta"
              render={formatFechaApi}
            />
          </>
        ) : (
          <>
            <Table.Column<SobreResumen>
              title="Nuestra respuesta"
              render={(_, s) => <EstadoSobreTag estado={s.estadoEmpresa} />}
            />
            <Table.Column<SobreResumen>
              title="Recibido"
              dataIndex="timestampRecibido"
              render={formatFechaApi}
            />
          </>
        )}
        <Table.Column<SobreResumen>
          title="Archivo"
          dataIndex="nombreArchivo"
          render={(n?: string | null) => (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {n ?? "-"}
            </Typography.Text>
          )}
        />
        <Table.Column<SobreResumen>
          title=""
          render={(_, s) => (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => ver(s)}
            />
          )}
        />
      </Table>
    </List>
  );
}
