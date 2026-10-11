import { EyeOutlined, FilePdfOutlined, SearchOutlined } from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import { useNotification, type CrudFilters } from "@refinedev/core";
import { Button, Card, DatePicker, Form, Input, InputNumber, Segmented, Select, Space, Table, Tag, Typography } from "antd";
import type { Dayjs } from "dayjs";
import { useNavigate } from "react-router";
import { ESTADOS_CFE, TIPOS_DOC, formatFechaApi, tipoDocByName, type Direccion } from "../../constants/cfe";
import { useEmpresa, type Empresa } from "../../contexts/empresa";
import { documentoId } from "../../providers/dataProvider";
import { abrirPdf } from "./pdf";

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
  empresaEmisora?: { id: number } | null;
  empresaReceptora?: { id: number } | null;
}

interface FiltrosForm {
  direccion: Direccion;
  fecha?: [Dayjs | null, Dayjs | null] | null;
  idTipoDoc?: number;
  serie?: string;
  nro?: number;
  rutReceptor?: string;
  razonReceptor?: string;
}

const etiquetaEmpresa = (empresa?: Empresa) => (empresa ? `${empresa.rut} - ${empresa.razon ?? ""}` : undefined);

export function DocumentoList() {
  const { empresa, empresaById } = useEmpresa();
  const navigate = useNavigate();
  const { open } = useNotification();

  const { tableProps, searchFormProps, filters } = useTable<Documento, never, FiltrosForm>({
    resource: "documentos",
    syncWithLocation: false,
    meta: { rut: empresa?.rut },
    queryOptions: { enabled: !!empresa },
    pagination: { pageSize: 20 },
    filters: { initial: [{ field: "direccion", operator: "eq", value: "EMITIDO" }] },
    onSearch: (values): CrudFilters => {
      // Buscar un documento puntual requiere tipo + serie + numero juntos (asi lo resuelve la API)
      const puntual = values.idTipoDoc && values.serie && values.nro;
      return [
        { field: "direccion", operator: "eq", value: values.direccion },
        { field: "fecha", operator: "eq", value: values.fecha ? values.fecha.map((d) => d?.toDate()) : undefined },
        { field: "idTipoDoc", operator: "eq", value: puntual ? values.idTipoDoc : undefined },
        { field: "serie", operator: "eq", value: puntual ? values.serie : undefined },
        { field: "nro", operator: "eq", value: puntual ? values.nro : undefined },
        { field: "rutReceptor", operator: "eq", value: values.rutReceptor },
        // La API falla si se filtra por rutReceptor y razonReceptor a la vez (alias duplicado en CFE.find)
        { field: "razonReceptor", operator: "eq", value: values.rutReceptor ? undefined : values.razonReceptor },
      ];
    },
  });

  const direccion = (filters.find((f) => "field" in f && f.field === "direccion")?.value ?? "EMITIDO") as Direccion;

  const verDocumento = (doc: Documento) => {
    const tipo = tipoDocByName(doc.tipo);
    if (!tipo) return;
    const params = new URLSearchParams({ direccion });
    const emisor = empresaById(doc.empresaEmisora?.id);
    if (direccion === "RECIBIDO" && emisor) params.set("rutExterno", emisor.rut);
    navigate(`/documentos/show/${encodeURIComponent(documentoId(tipo.id, doc.serie, doc.nro))}?${params}`);
  };

  const pdf = async (doc: Documento) => {
    const tipo = tipoDocByName(doc.tipo);
    if (!tipo || !empresa) return;
    const emisor = direccion === "RECIBIDO" ? empresaById(doc.empresaEmisora?.id)?.rut : undefined;
    try {
      await abrirPdf(empresa.rut, { idTipoDoc: tipo.id, serie: doc.serie, nro: doc.nro }, emisor);
    } catch (error) {
      open?.({ type: "error", message: "No se pudo obtener el PDF", description: (error as Error).message });
    }
  };

  if (!empresa) return <Typography.Text>Seleccione una empresa.</Typography.Text>;

  return (
    <List title={`Comprobantes - ${empresa.razon ?? empresa.rut}`}>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Form {...searchFormProps} layout="inline" initialValues={{ direccion: "EMITIDO" }}>
          <Form.Item name="direccion">
            <Segmented
              options={[
                { label: "Emitidos", value: "EMITIDO" },
                { label: "Recibidos", value: "RECIBIDO" },
              ]}
            />
          </Form.Item>
          <Form.Item name="fecha" label="Fecha">
            <DatePicker.RangePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="rutReceptor" label="RUT receptor">
            <Input allowClear style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="razonReceptor" label="Razón receptor">
            <Input allowClear style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="idTipoDoc" label="Tipo">
            <Select
              allowClear
              style={{ width: 200 }}
              options={TIPOS_DOC.map((t) => ({ value: t.id, label: `${t.id} - ${t.label}` }))}
            />
          </Form.Item>
          <Form.Item name="serie" label="Serie">
            <Input allowClear style={{ width: 70 }} />
          </Form.Item>
          <Form.Item name="nro" label="Nro">
            <InputNumber style={{ width: 110 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              Buscar
            </Button>
          </Form.Item>
        </Form>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Para buscar un comprobante puntual completar tipo, serie y número.
        </Typography.Text>
      </Card>

      <Table {...tableProps} rowKey="id" size="middle" onRow={(doc) => ({ onDoubleClick: () => verDocumento(doc) })}>
        <Table.Column<Documento>
          title="Tipo"
          dataIndex="tipo"
          render={(tipo: string) => tipoDocByName(tipo)?.label ?? tipo}
        />
        <Table.Column<Documento> title="Serie / Nro" render={(_, doc) => `${doc.serie}-${doc.nro}`} />
        <Table.Column<Documento> title="Fecha" dataIndex="fechaEmision" render={formatFechaApi} />
        <Table.Column<Documento>
          title={direccion === "EMITIDO" ? "Receptor" : "Emisor"}
          render={(_, doc) =>
            direccion === "EMITIDO"
              ? etiquetaEmpresa(empresaById(doc.empresaReceptora?.id)) ?? doc.titular?.documento ?? "-"
              : etiquetaEmpresa(empresaById(doc.empresaEmisora?.id)) ?? "-"
          }
        />
        <Table.Column<Documento> title="Moneda" dataIndex="moneda" />
        <Table.Column<Documento>
          title="Total"
          dataIndex="totMntTotal"
          align="right"
          render={(value?: number) =>
            value != null ? value.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
          }
        />
        <Table.Column<Documento>
          title="Estado DGI"
          dataIndex="estado"
          render={(estado?: string | null) =>
            estado ? (
              <Tag color={ESTADOS_CFE[estado]?.color}>{ESTADOS_CFE[estado]?.label ?? estado}</Tag>
            ) : (
              <Tag>Sin respuesta</Tag>
            )
          }
        />
        <Table.Column<Documento>
          title=""
          render={(_, doc) => (
            <Space>
              <Button size="small" icon={<EyeOutlined />} onClick={() => verDocumento(doc)} />
              <Button size="small" icon={<FilePdfOutlined />} onClick={() => pdf(doc)} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
}
