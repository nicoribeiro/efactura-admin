import {
  FilterOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type { CrudFilters } from "@refinedev/core";
import {
  Button,
  Col,
  Collapse,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  type FormProps,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { ESTADOS_FILTRO, TIPOS_DOC } from "../../constants/cfe";
import {
  mismoRango,
  rangoPorDefecto,
  rangosRapidos,
  type Rango,
} from "../../utils/rangos";

const ABIERTO_KEY = "efactura-filtros-comprobantes-abierto";

const leerAbierto = () => {
  try {
    return localStorage.getItem(ABIERTO_KEY) !== "false";
  } catch {
    return true;
  }
};

/** Estado del CFE en la respuesta del receptor (ME_), solo emitidos */
const ESTADOS_RECEPTOR = [
  { value: "AE", label: "Aceptado" },
  { value: "BE", label: "Rechazado" },
  { value: "SIN", label: "Sin respuesta" },
];

/** Valor de un filtro aplicado (los que ya se usaron en la consulta, no lo que se esta editando) */
const valorFiltro = (filters: CrudFilters, campo: string) =>
  filters.find((f) => "field" in f && f.field === campo)?.value as unknown;

/** Resumen de los filtros aplicados, para ver que esta filtrado con el panel cerrado */
function resumen(filters: CrudFilters) {
  const tags: string[] = [];
  tags.push(
    valorFiltro(filters, "direccion") === "RECIBIDO" ? "Recibidos" : "Emitidos",
  );

  const fecha = valorFiltro(filters, "fecha") as Date[] | undefined;
  if (fecha?.[0] && fecha?.[1])
    tags.push(
      `${dayjs(fecha[0]).format("DD/MM/YYYY")} – ${dayjs(fecha[1]).format("DD/MM/YYYY")}`,
    );
  else tags.push("Todas las fechas");

  const estado = valorFiltro(filters, "estado");
  if (estado)
    tags.push(
      `DGI: ${ESTADOS_FILTRO.find((e) => e.value === estado)?.label ?? estado}`,
    );

  const estadoReceptor = valorFiltro(filters, "estadoReceptor");
  if (estadoReceptor)
    tags.push(
      `Receptor: ${ESTADOS_RECEPTOR.find((e) => e.value === estadoReceptor)?.label ?? estadoReceptor}`,
    );

  const contraparte =
    valorFiltro(filters, "direccion") === "RECIBIDO" ? "emisor" : "receptor";
  const rut = valorFiltro(filters, "rutReceptor");
  if (rut) tags.push(`RUT ${contraparte} ${rut}`);
  const razon = valorFiltro(filters, "razonReceptor");
  if (razon) tags.push(`Razón "${razon}"`);

  const tipo = valorFiltro(filters, "idTipoDoc") as number | undefined;
  const serie = valorFiltro(filters, "serie");
  const nro = valorFiltro(filters, "nro");
  const etiquetaTipo = tipo
    ? (TIPOS_DOC.find((x) => x.id === tipo)?.label ?? String(tipo))
    : undefined;
  if (tipo && serie && nro) tags.push(`${etiquetaTipo} ${serie}-${nro}`);
  else {
    if (etiquetaTipo) tags.push(etiquetaTipo);
    if (serie) tags.push(`Serie ${serie}`);
    if (nro) tags.push(`Nro ${nro}`);
  }
  return tags;
}

interface Props {
  searchFormProps: FormProps;
  filters: CrudFilters;
  /** Valores con los que abre el formulario (por defecto o desde la URL) */
  valoresIniciales: {
    direccion: string;
    fecha: Rango;
    estado?: string;
    estadoReceptor?: string;
    idTipoDoc?: number;
    serie?: string;
    nro?: number;
    rutReceptor?: string;
    razonReceptor?: string;
  };
}

/** Primer dia del historial para el boton "Desde el principio" */
const INICIO_HISTORIAL = "2016-01-01";

/** Filtros del listado de comprobantes, en un panel colapsable */
export function FiltrosComprobantes({
  searchFormProps,
  filters,
  valoresIniciales,
}: Props) {
  const [abierto, setAbierto] = useState(leerAbierto);
  const form = searchFormProps.form;
  const fechaSeleccionada = Form.useWatch("fecha", form) as
    (Dayjs | null)[] | undefined;
  // La contraparte es el receptor en los emitidos y el emisor en los recibidos (la API filtra segun la direccion)
  const recibidos = Form.useWatch("direccion", form) === "RECIBIDO";

  const cambiarAbierto = (valor: boolean) => {
    setAbierto(valor);
    try {
      localStorage.setItem(ABIERTO_KEY, String(valor));
    } catch {
      // sin localStorage: solo se pierde recordar el estado
    }
  };

  // Ademas de los rangos comunes, "desde el principio": todo el historial (el sistema arranca en 2016)
  const rangos = [
    ...rangosRapidos(),
    {
      label: "Desde el principio",
      value: [dayjs(INICIO_HISTORIAL), dayjs().startOf("day")] as Rango,
    },
  ];

  const aplicarRango = (rango: Rango) => {
    form?.setFieldsValue({ fecha: rango });
    form?.submit();
  };

  const restablecer = () => {
    form?.resetFields();
    // Restablecer vuelve a los valores por defecto (no a los de la URL)
    form?.setFieldsValue({
      direccion: "EMITIDO",
      fecha: rangoPorDefecto(),
      estado: undefined,
      estadoReceptor: undefined,
    });
    form?.submit();
  };

  const encabezado = (
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
  );

  const contenido = (
    <Form
      {...searchFormProps}
      layout="vertical"
      initialValues={valoresIniciales}
    >
      <Row gutter={[16, 0]}>
        <Col xs={24} md={8} lg={6}>
          <Form.Item name="direccion" label="CFE">
            <Segmented
              block
              options={[
                { label: "Emitidos", value: "EMITIDO" },
                { label: "Recibidos", value: "RECIBIDO" },
              ]}
              // Cambiar entre emitidos y recibidos busca enseguida (despues de que el form toma el valor)
              onChange={() => setTimeout(() => form?.submit())}
            />
          </Form.Item>
          <Form.Item name="estado" label="Estado DGI">
            <Select
              allowClear
              placeholder="Todos"
              options={[{ value: "", label: "Todos" }, ...ESTADOS_FILTRO]}
              // Elegir o borrar el estado busca enseguida, como emitidos/recibidos
              onChange={() => setTimeout(() => form?.submit())}
            />
          </Form.Item>
          {!recibidos && (
            <Form.Item
              name="estadoReceptor"
              label="Estado Receptor"
              tooltip="Estado del CFE en la respuesta de la empresa receptora. Los emitidos a quien no es emisor electrónico no entran en ninguno"
            >
              <Select
                allowClear
                placeholder="Todos"
                options={[{ value: "", label: "Todos" }, ...ESTADOS_RECEPTOR]}
                onChange={() => setTimeout(() => form?.submit())}
              />
            </Form.Item>
          )}
        </Col>
        <Col xs={24} md={16} lg={18}>
          <Form.Item label="Período" style={{ marginBottom: 8 }}>
            <Form.Item name="fecha" noStyle>
              <DatePicker.RangePicker
                format="DD/MM/YYYY"
                presets={rangos}
                style={{ width: "100%", maxWidth: 320 }}
              />
            </Form.Item>
          </Form.Item>
          <Space wrap size={[6, 6]} style={{ marginBottom: 16 }}>
            {rangos.map(({ label, value }) => (
              <Button
                key={label}
                size="small"
                type={
                  mismoRango(fechaSeleccionada, value) ? "primary" : "default"
                }
                onClick={() => aplicarRango(value)}
              >
                {label}
              </Button>
            ))}
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 0]}>
        <Col xs={24} lg={10}>
          <Typography.Text strong>{recibidos ? "Emisor" : "Receptor"}</Typography.Text>
          <Row gutter={8} style={{ marginTop: 8 }}>
            <Col xs={24} sm={10}>
              <Form.Item name="rutReceptor" label="RUT">
                <Input allowClear placeholder="RUT" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={14}>
              <Form.Item name="razonReceptor" label="Razón social">
                <Input allowClear placeholder="Contiene..." />
              </Form.Item>
            </Col>
          </Row>
        </Col>
        <Col xs={24} lg={14}>
          <Typography.Text strong>CFE</Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, marginLeft: 8 }}
          >
            tipo y serie filtran el listado; con número se busca un CFE
            puntual
          </Typography.Text>
          <Row gutter={8} style={{ marginTop: 8 }}>
            <Col xs={24} sm={12}>
              <Form.Item name="idTipoDoc" label="Tipo">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tipo de CFE"
                  options={TIPOS_DOC.map((t) => ({
                    value: t.id,
                    label: `${t.id} - ${t.label}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={8} sm={4}>
              <Form.Item name="serie" label="Serie">
                <Input allowClear placeholder="A" />
              </Form.Item>
            </Col>
            <Col xs={16} sm={8}>
              <Form.Item
                name="nro"
                label="Número"
                tooltip="Solo o junto con tipo y serie. Se busca dentro del período elegido"
              >
                <InputNumber style={{ width: "100%" }} placeholder="Número" />
              </Form.Item>
            </Col>
          </Row>
        </Col>
      </Row>

      <Row justify="end">
        <Space>
          <Button icon={<UndoOutlined />} onClick={restablecer}>
            Restablecer
          </Button>
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
            Buscar
          </Button>
        </Space>
      </Row>
    </Form>
  );

  return (
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
          label: encabezado,
          children: contenido,
          forceRender: true,
        },
      ]}
    />
  );
}
