import { PaperClipOutlined, SearchOutlined } from "@ant-design/icons";
import { useTable } from "@refinedev/antd";
import type { CrudFilters, HttpError } from "@refinedev/core";
import { Alert, Button, DatePicker, Form, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { Dayjs } from "dayjs";
import { formatFechaApi } from "../../constants/cfe";

type EstadoAdjunto = "PROCESADO_OK" | "PROCESADO_ERROR" | "PENDIENTE" | "OMITIDO";

interface Adjunto {
  id: number;
  name?: string | null;
  estado?: EstadoAdjunto | null;
  timestamp?: number;
}

interface EmailRecibido {
  id: number;
  messageId?: string | null;
  from?: string | null;
  subject?: string | null;
  sentDate?: string | null;
  attachments: Adjunto[];
}

interface FiltrosForm {
  estado?: EstadoAdjunto;
  fecha?: [Dayjs | null, Dayjs | null] | null;
  q?: string;
}

const ESTADOS_ADJUNTO: Record<EstadoAdjunto, { label: string; color: string }> = {
  PROCESADO_OK: { label: "Procesado", color: "green" },
  PROCESADO_ERROR: { label: "Error", color: "red" },
  PENDIENTE: { label: "Pendiente", color: "gold" },
  OMITIDO: { label: "Omitido", color: "default" },
};

const tagEstado = (estado?: EstadoAdjunto | null) =>
  estado ? (
    <Tag color={ESTADOS_ADJUNTO[estado]?.color}>{ESTADOS_ADJUNTO[estado]?.label ?? estado}</Tag>
  ) : (
    <Tag>Sin estado</Tag>
  );

/** Estado del email: el "peor" de sus adjuntos XML (error > pendiente > procesado > omitido) */
function estadoEmail(email: EmailRecibido): EstadoAdjunto | null {
  const estados = email.attachments.map((a) => a.estado).filter((e): e is EstadoAdjunto => !!e);
  for (const estado of ["PROCESADO_ERROR", "PENDIENTE", "PROCESADO_OK", "OMITIDO"] as EstadoAdjunto[])
    if (estados.includes(estado)) return estado;
  return null;
}

/** Emails recibidos por una empresa (solo lectura) */
export function EmailsTable({ rut }: { rut: string }) {
  const { tableProps, searchFormProps, tableQuery } = useTable<EmailRecibido, HttpError, FiltrosForm>({
    resource: "emails",
    syncWithLocation: false,
    meta: { rut },
    pagination: { pageSize: 20 },
    onSearch: (values): CrudFilters => [
      { field: "estado", operator: "eq", value: values.estado },
      { field: "fecha", operator: "eq", value: values.fecha ? values.fecha.map((d) => d?.toDate()) : undefined },
      { field: "q", operator: "eq", value: values.q?.trim() || undefined },
    ],
  });

  if (tableQuery.isError)
    return (
      <Alert
        type="error"
        showIcon
        message="No se pudieron obtener los emails"
        description={
          tableQuery.error?.statusCode === 404
            ? "La API no tiene el endpoint GET /empresa/:rut/emails (requiere una versión más nueva de java_efactura_uy)."
            : tableQuery.error?.message
        }
      />
    );

  return (
    <>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="estado" label="Estado">
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="Todos"
            options={Object.entries(ESTADOS_ADJUNTO).map(([value, { label }]) => ({ value, label }))}
          />
        </Form.Item>
        <Form.Item name="fecha" label="Fecha">
          <DatePicker.RangePicker format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item name="q" label="Buscar">
          <Input allowClear placeholder="Asunto o remitente" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
            Buscar
          </Button>
        </Form.Item>
      </Form>

      <Table<EmailRecibido>
        {...tableProps}
        rowKey="id"
        size="middle"
        expandable={{
          rowExpandable: (email) => email.attachments.length > 0,
          expandedRowRender: (email) => (
            <Table<Adjunto> dataSource={email.attachments} rowKey="id" size="small" pagination={false}>
              <Table.Column<Adjunto> title="Adjunto" dataIndex="name" render={(name) => name ?? "(sin nombre)"} />
              <Table.Column<Adjunto> title="Estado" dataIndex="estado" render={tagEstado} />
            </Table>
          ),
        }}
      >
        <Table.Column<EmailRecibido> title="Fecha" dataIndex="sentDate" render={formatFechaApi} />
        <Table.Column<EmailRecibido> title="Remitente" dataIndex="from" ellipsis />
        <Table.Column<EmailRecibido> title="Asunto" dataIndex="subject" ellipsis />
        <Table.Column<EmailRecibido>
          title="Adjuntos"
          render={(_, email) => (
            <Space size={4}>
              <PaperClipOutlined />
              <Typography.Text>{email.attachments.length}</Typography.Text>
            </Space>
          )}
        />
        <Table.Column<EmailRecibido> title="Estado" render={(_, email) => tagEstado(estadoEmail(email))} />
      </Table>
    </>
  );
}
