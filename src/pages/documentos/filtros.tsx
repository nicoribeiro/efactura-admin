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
import { TIPOS_DOC } from "../../constants/cfe";
import { mismoRango, rangosRapidos, type Rango } from "../../utils/rangos";

const ABIERTO_KEY = "efactura-filtros-comprobantes-abierto";

const leerAbierto = () => {
  try {
    return localStorage.getItem(ABIERTO_KEY) !== "false";
  } catch {
    return true;
  }
};

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

  const rut = valorFiltro(filters, "rutReceptor");
  if (rut) tags.push(`RUT ${rut}`);
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
  }
  return tags;
}

interface Props {
  searchFormProps: FormProps;
  filters: CrudFilters;
  rangoInicial: Rango;
}

/** Filtros del listado de comprobantes, en un panel colapsable */
export function FiltrosComprobantes({
  searchFormProps,
  filters,
  rangoInicial,
}: Props) {
  const [abierto, setAbierto] = useState(leerAbierto);
  const form = searchFormProps.form;
  const fechaSeleccionada = Form.useWatch("fecha", form) as
    (Dayjs | null)[] | undefined;

  const cambiarAbierto = (valor: boolean) => {
    setAbierto(valor);
    try {
      localStorage.setItem(ABIERTO_KEY, String(valor));
    } catch {
      // sin localStorage: solo se pierde recordar el estado
    }
  };

  const aplicarRango = (rango: Rango) => {
    form?.setFieldsValue({ fecha: rango });
    form?.submit();
  };

  const restablecer = () => {
    form?.resetFields();
    form?.setFieldsValue({ direccion: "EMITIDO", fecha: rangoInicial });
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
      initialValues={{ direccion: "EMITIDO", fecha: rangoInicial }}
    >
      <Row gutter={[16, 0]}>
        <Col xs={24} md={8} lg={6}>
          <Form.Item name="direccion" label="Comprobantes">
            <Segmented
              block
              options={[
                { label: "Emitidos", value: "EMITIDO" },
                { label: "Recibidos", value: "RECIBIDO" },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={16} lg={18}>
          <Form.Item label="Período" style={{ marginBottom: 8 }}>
            <Form.Item name="fecha" noStyle>
              <DatePicker.RangePicker
                format="DD/MM/YYYY"
                presets={rangosRapidos()}
                style={{ width: "100%", maxWidth: 320 }}
              />
            </Form.Item>
          </Form.Item>
          <Space wrap size={[6, 6]} style={{ marginBottom: 16 }}>
            {rangosRapidos().map(({ label, value }) => (
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
          <Typography.Text strong>Receptor</Typography.Text>
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
          <Typography.Text strong>Comprobante</Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, marginLeft: 8 }}
          >
            tipo y serie filtran el listado; con número se busca un comprobante
            puntual
          </Typography.Text>
          <Row gutter={8} style={{ marginTop: 8 }}>
            <Col xs={24} sm={12}>
              <Form.Item name="idTipoDoc" label="Tipo">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tipo de comprobante"
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
                tooltip="Requiere tipo y serie"
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
