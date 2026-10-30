import {
  EyeOutlined,
  FilterOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import type { CrudFilters } from "@refinedev/core";
import {
  Button,
  Collapse,
  DatePicker,
  Form,
  Input,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
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
  /** Emitidos: estado de DGI (AS, BS, SIN) */
  estadoDgi?: string;
  /** Respuesta al sobre entre empresas, M (AS, BS, SIN; emitidos: NO_CORRESPONDE) */
  respuestaM?: string;
  /** Recibidos: respuesta a los comprobantes, ME (PENDIENTE, ENVIADA, SIN) */
  respuestaME?: string;
  rutContraparte?: string;
  razonContraparte?: string;
}

/** Primer dia del historial para "Desde el principio" (el sistema arranca en 2016) */
const INICIO_HISTORIAL = "2016-01-01";

const TODOS = { value: "", label: "Todos" };
const OPCIONES_DGI = [TODOS, ...ESTADOS_SOBRE_FILTRO];
const opcionesM = (emitidos: boolean) => [
  TODOS,
  { value: "AS", label: "Recibido" },
  { value: "BS", label: "Rechazado" },
  { value: "SIN", label: "Sin respuesta" },
  ...(emitidos
    ? [
        {
          value: "NO_CORRESPONDE",
          label: "No corresponde (receptor no electrónico)",
        },
      ]
    : []),
];
const OPCIONES_ME = [
  TODOS,
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "ENVIADA", label: "Enviada" },
  { value: "SIN", label: "Sin respuesta" },
];

const aFiltroFecha = (fecha?: Rango | null) =>
  fecha?.[0] && fecha?.[1]
    ? [fecha[0].startOf("day").toDate(), fecha[1].endOf("day").toDate()]
    : undefined;

const permitido = (valor: string | null | undefined, valores: string[]) => {
  const v = valor?.toUpperCase();
  return v && valores.includes(v) ? v : undefined;
};

/**
 * Filtros y pagina en la URL (para abrir el listado ya filtrado y conservarlos al volver del detalle):
 * /sobres?direccion=RECIBIDO&respuestaME=PENDIENTE&desde=2026-09-01&hasta=2026-09-30&page=2. "estado" (links
 * viejos) es el de DGI en emitidos y M en recibidos.
 */
function filtrosDesdeUrl(params: URLSearchParams): FiltrosForm & {
  page: number;
} {
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  const direccion: Direccion =
    params.get("direccion") === "RECIBIDO" ? "RECIBIDO" : "EMITIDO";
  const viejo = permitido(params.get("estado"), ["AS", "BS", "SIN"]);
  return {
    direccion,
    fecha:
      desde && hasta && dayjs(desde).isValid() && dayjs(hasta).isValid()
        ? [dayjs(desde), dayjs(hasta)]
        : rangoPorDefecto(),
    estadoDgi:
      direccion === "EMITIDO"
        ? (permitido(params.get("estadoDgi"), ["AS", "BS", "SIN"]) ?? viejo)
        : undefined,
    respuestaM:
      permitido(params.get("respuestaM"), [
        "AS",
        "BS",
        "SIN",
        "NO_CORRESPONDE",
      ]) ?? (direccion === "RECIBIDO" ? viejo : undefined),
    respuestaME:
      direccion === "RECIBIDO"
        ? permitido(params.get("respuestaME"), ["PENDIENTE", "ENVIADA", "SIN"])
        : undefined,
    rutContraparte: params.get("rutContraparte")?.trim() || undefined,
    razonContraparte: params.get("razonContraparte")?.trim() || undefined,
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

function filtrosAUrl(valores: FiltrosForm, page: number) {
  const params = new URLSearchParams({ direccion: valores.direccion });
  if (valores.fecha?.[0] && valores.fecha?.[1]) {
    params.set("desde", valores.fecha[0].format("YYYY-MM-DD"));
    params.set("hasta", valores.fecha[1].format("YYYY-MM-DD"));
  }
  for (const [clave, valor] of Object.entries(aConsulta(valores)))
    if (valor) params.set(clave, valor);
  if (page > 1) params.set("page", String(page));
  return params;
}

/** Los filtros opcionales que aplican a la direccion (los de la otra direccion se ignoran) */
function aConsulta(valores: FiltrosForm): Record<string, string | undefined> {
  const emitidos = valores.direccion === "EMITIDO";
  return {
    estadoDgi: emitidos ? valores.estadoDgi || undefined : undefined,
    respuestaM:
      valores.respuestaM === "NO_CORRESPONDE" && !emitidos
        ? undefined
        : valores.respuestaM || undefined,
    respuestaME: !emitidos ? valores.respuestaME || undefined : undefined,
    rutContraparte: valores.rutContraparte?.trim() || undefined,
    razonContraparte: valores.razonContraparte?.trim() || undefined,
  };
}

const aFiltros = (valores: FiltrosForm): CrudFilters => [
  { field: "direccion", operator: "eq", value: valores.direccion },
  { field: "fecha", operator: "eq", value: aFiltroFecha(valores.fecha) },
  ...Object.entries(aConsulta(valores)).map(([field, value]) => ({
    field,
    operator: "eq" as const,
    value,
  })),
];

const ABIERTO_KEY = "efactura-filtros-sobres-abierto";

const leerAbierto = () => {
  try {
    return localStorage.getItem(ABIERTO_KEY) !== "false";
  } catch {
    return true;
  }
};

/** Valor de un filtro aplicado (el usado en la consulta, no lo que se esta editando) */
const valorFiltro = (filters: CrudFilters, campo: string) =>
  filters.find((f) => "field" in f && f.field === campo)?.value as unknown;

const etiqueta = (
  opciones: { value: string; label: string }[],
  valor: unknown,
) => opciones.find((o) => o.value === valor)?.label ?? String(valor);

/** Resumen de los filtros aplicados, para ver que esta filtrado con el panel cerrado */
function resumen(filters: CrudFilters) {
  const emitidos = valorFiltro(filters, "direccion") !== "RECIBIDO";
  const tags = [emitidos ? "Emitidos" : "Recibidos"];
  const fecha = valorFiltro(filters, "fecha") as Date[] | undefined;
  tags.push(
    fecha?.[0] && fecha?.[1]
      ? `${dayjs(fecha[0]).format("DD/MM/YYYY")} – ${dayjs(fecha[1]).format("DD/MM/YYYY")}`
      : "Todas las fechas",
  );
  const dgi = valorFiltro(filters, "estadoDgi");
  if (dgi) tags.push(`DGI: ${etiqueta(OPCIONES_DGI, dgi)}`);
  const m = valorFiltro(filters, "respuestaM");
  if (m) tags.push(`M: ${etiqueta(opcionesM(true), m)}`);
  const me = valorFiltro(filters, "respuestaME");
  if (me) tags.push(`ME: ${etiqueta(OPCIONES_ME, me)}`);
  const contraparte = emitidos ? "receptor" : "emisor";
  const rut = valorFiltro(filters, "rutContraparte");
  if (rut) tags.push(`RUT ${contraparte} ${rut}`);
  const razon = valorFiltro(filters, "razonContraparte");
  if (razon) tags.push(`Razón "${razon}"`);
  return tags;
}

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
    // replace: cada busqueda manda todos los filtros (con merge un filtro borrado seguia aplicando)
    filters: { initial: aFiltros(inicial), defaultBehavior: "replace" },
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

  // Panel de filtros abierto o cerrado (se recuerda en el navegador)
  const [abierto, setAbierto] = useState(leerAbierto);
  const cambiarAbierto = (valor: boolean) => {
    setAbierto(valor);
    try {
      localStorage.setItem(ABIERTO_KEY, String(valor));
    } catch {
      // sin localStorage: solo se pierde recordar el estado
    }
  };
  // La direccion que se esta editando (decide que filtros se muestran); la buscada esta en filters
  const direccionForm =
    (Form.useWatch("direccion", form) as Direccion | undefined) ?? direccion;

  // Cambiar direccion o un estado busca enseguida (despues de que el form toma el valor)
  const buscarYa = () => setTimeout(() => form?.submit());

  const rangos = [
    ...rangosRapidos(),
    {
      label: "Desde el principio",
      value: [dayjs(INICIO_HISTORIAL), dayjs().startOf("day")] as Rango,
    },
  ];

  const restablecer = () => {
    form?.resetFields();
    form?.setFieldsValue({
      direccion: "EMITIDO",
      fecha: rangoPorDefecto(),
      estadoDgi: undefined,
      respuestaM: undefined,
      respuestaME: undefined,
      rutContraparte: undefined,
      razonContraparte: undefined,
    });
    form?.submit();
  };

  if (!empresa)
    return <Typography.Text>Seleccione una empresa.</Typography.Text>;

  const ver = (sobre: SobreResumen) => navigate(`/sobres/show/${sobre.id}`);

  return (
    <List title={`Sobres - ${empresa.razon ?? empresa.rut}`}>
      <Collapse
        style={{ marginBottom: 16 }}
        activeKey={abierto ? ["filtros"] : []}
        onChange={(keys) =>
          cambiarAbierto(
            (Array.isArray(keys) ? keys : [keys]).includes("filtros"),
          )
        }
        items={[
          {
            key: "filtros",
            forceRender: true,
            label: (
              <Space wrap size={[6, 6]}>
                <span>
                  <FilterOutlined /> Filtros
                </span>
                {resumen(filters).map((t) => (
                  <Tag key={t} color="blue" style={{ marginInlineEnd: 0 }}>
                    {t}
                  </Tag>
                ))}
              </Space>
            ),
            children: (
              <Form<FiltrosForm>
                {...searchFormProps}
                layout="vertical"
                initialValues={inicial}
              >
                <Space wrap align="end" size={[16, 0]}>
                  <Form.Item name="direccion" label="Sobres">
                    <Segmented
                      options={[
                        { value: "EMITIDO", label: "Emitidos" },
                        { value: "RECIBIDO", label: "Recibidos" },
                      ]}
                      onChange={buscarYa}
                    />
                  </Form.Item>
                  <Form.Item name="fecha" label="Período">
                    <DatePicker.RangePicker
                      format="DD/MM/YYYY"
                      presets={rangos}
                    />
                  </Form.Item>
                  {direccionForm === "EMITIDO" && (
                    <Form.Item name="estadoDgi" label="Estado DGI">
                      <Select
                        style={{ width: 160 }}
                        placeholder="Todos"
                        options={OPCIONES_DGI}
                        onChange={buscarYa}
                      />
                    </Form.Item>
                  )}
                  <Form.Item
                    name="respuestaM"
                    label={
                      <Tooltip
                        title={
                          direccionForm === "EMITIDO"
                            ? "Respuesta de la empresa receptora al sobre (M_)"
                            : "Nuestra respuesta al sobre (M_)"
                        }
                      >
                        M
                      </Tooltip>
                    }
                  >
                    <Select
                      style={{ width: direccionForm === "EMITIDO" ? 260 : 160 }}
                      placeholder="Todos"
                      options={opcionesM(direccionForm === "EMITIDO")}
                      onChange={buscarYa}
                    />
                  </Form.Item>
                  {direccionForm === "RECIBIDO" && (
                    <Form.Item
                      name="respuestaME"
                      label={
                        <Tooltip title="Nuestra respuesta a los CFE del sobre (ME_)">
                          ME
                        </Tooltip>
                      }
                    >
                      <Select
                        style={{ width: 160 }}
                        placeholder="Todos"
                        options={OPCIONES_ME}
                        onChange={buscarYa}
                      />
                    </Form.Item>
                  )}
                  <Form.Item
                    name="rutContraparte"
                    label={`RUT ${direccionForm === "EMITIDO" ? "receptor" : "emisor"}`}
                  >
                    <Input
                      allowClear
                      style={{ width: 150 }}
                      placeholder="Empieza con…"
                    />
                  </Form.Item>
                  <Form.Item
                    name="razonContraparte"
                    label={`Razón social ${direccionForm === "EMITIDO" ? "receptor" : "emisor"}`}
                  >
                    <Input
                      allowClear
                      style={{ width: 200 }}
                      placeholder="Contiene…"
                    />
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SearchOutlined />}
                      >
                        Buscar
                      </Button>
                      <Button icon={<UndoOutlined />} onClick={restablecer}>
                        Restablecer
                      </Button>
                    </Space>
                  </Form.Item>
                </Space>
                <Space wrap size={[8, 8]}>
                  {rangos.map(({ label, value }) => (
                    <Button
                      key={label}
                      size="small"
                      type={
                        fecha && mismoRango(fecha, value)
                          ? "primary"
                          : "default"
                      }
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
            ),
          },
        ]}
      />

      <Table
        {...tableProps}
        rowKey="id"
        size="middle"
        onRow={(sobre) => ({ onDoubleClick: () => ver(sobre) })}
      >
        <Table.Column<SobreResumen>
          title="Id"
          dataIndex="id"
          sorter
          render={(_, s) => (
            <Typography.Link onClick={() => ver(s)}>{s.id}</Typography.Link>
          )}
        />
        <Table.Column<SobreResumen>
          title="Fecha"
          dataIndex="fecha"
          sorter
          render={formatFechaDia}
        />
        <Table.Column<SobreResumen>
          title={emitidos ? "Receptor" : "Emisor"}
          // Orden en la API por razon social de la contraparte; dataIndex solo da el nombre del orden
          dataIndex="contraparte"
          sorter
          render={(_, s) =>
            etiquetaEmpresa(emitidos ? s.empresaReceptora : s.empresaEmisora) ??
            (emitidos ? "DGI" : "-")
          }
        />
        <Table.Column<SobreResumen>
          title="CFE"
          // Orden en la API por el texto del primer comprobante (tipo, serie y numero)
          dataIndex="comprobantes"
          sorter
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
              dataIndex="estadoDgi"
              sorter
              render={(_, s) => (
                <EstadoSobreDgi
                  estado={s.estadoDgi}
                  rut={empresa.rut}
                  idSobre={s.id}
                  error={s.errorEnvioDgi}
                  ultimoIntento={s.fechaUltimoIntentoDgi}
                  intentos={s.intentosDgi}
                />
              )}
            />
            <Table.Column<SobreResumen>
              title="Respuesta desde"
              dataIndex="fechaConsulta"
              sorter
              render={formatFechaApi}
            />
            <Table.Column<SobreResumen>
              title={
                <Tooltip title="Respuesta de la empresa receptora al sobre (M_)">
                  M
                </Tooltip>
              }
              dataIndex="estadoEmpresa"
              sorter
              render={(_, s) =>
                s.enviadoAEmpresa === false ? (
                  <Tooltip title="El receptor no es emisor electrónico: no responde">
                    <Typography.Text type="secondary">-</Typography.Text>
                  </Tooltip>
                ) : !s.estadoEmpresa && !s.comprobantes.some((c) => c.estado === "AE") ? (
                  // El sobre se le manda al receptor recien cuando DGI acepta un CFE
                  <Tooltip title="Todavía no se le envió: se le envía cuando DGI acepta el CFE">
                    <Tag>No enviado</Tag>
                  </Tooltip>
                ) : (
                  <EstadoSobreTag estado={s.estadoEmpresa} />
                )
              }
            />
          </>
        ) : (
          <>
            <Table.Column<SobreResumen>
              title={
                <Tooltip title="Nuestra respuesta al sobre (M_)">M</Tooltip>
              }
              dataIndex="estadoEmpresa"
              sorter
              render={(_, s) => <EstadoSobreTag estado={s.estadoEmpresa} />}
            />
            <Table.Column<SobreResumen>
              title="Recibido"
              dataIndex="timestampRecibido"
              sorter
              render={formatFechaApi}
            />
          </>
        )}
        <Table.Column<SobreResumen>
          title="Archivo"
          dataIndex="nombreArchivo"
          sorter
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
