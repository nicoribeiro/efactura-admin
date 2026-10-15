import {
  DownloadOutlined,
  PaperClipOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useTable } from "@refinedev/antd";
import type { CrudFilters, HttpError } from "@refinedev/core";
import {
  Alert,
  App,
  Button,
  Collapse,
  DatePicker,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { apiBlob } from "../../api/http";
import { formatFechaApi } from "../../constants/cfe";
import { descargarBlob } from "../../utils/csv";
import { CarpetasImap } from "./carpetas";
import { rolUsuario } from "../../providers/authProvider";
import { OmitirEmail, ReintentarEmail, ReintentarTodos } from "./reintentarEmails";
import { ordenar } from "../../utils/orden";

type EstadoAdjunto =
  "PROCESADO_OK" | "PROCESADO_ERROR" | "PENDIENTE" | "OMITIDO";

interface Adjunto {
  id: number;
  name?: string | null;
  estado?: EstadoAdjunto | null;
  timestamp?: number;
  /** Descripcion del error si el procesamiento fallo */
  error?: string | null;
  /** Stack trace completo del error */
  errorStack?: string | null;
  /** false: binario guardado como texto antes del cambio a base64, el archivo esta danado */
  integro?: boolean;
}

interface EmailRecibido {
  id: number;
  messageId?: string | null;
  from?: string | null;
  subject?: string | null;
  sentDate?: string | null;
  attachments: Adjunto[];
}

type FiltroAdjuntos = "si" | "no" | "todos";

interface FiltrosForm {
  adjuntos?: FiltroAdjuntos;
  estado?: EstadoAdjunto;
  fecha?: [Dayjs | null, Dayjs | null] | null;
  q?: string;
}

const ESTADOS_ADJUNTO: Record<EstadoAdjunto, { label: string; color: string }> =
  {
    PROCESADO_OK: { label: "Procesado", color: "green" },
    PROCESADO_ERROR: { label: "Error", color: "red" },
    PENDIENTE: { label: "Pendiente", color: "gold" },
    OMITIDO: { label: "Omitido", color: "default" },
  };

const tagEstado = (estado?: EstadoAdjunto | null) =>
  estado ? (
    <Tag color={ESTADOS_ADJUNTO[estado]?.color}>
      {ESTADOS_ADJUNTO[estado]?.label ?? estado}
    </Tag>
  ) : (
    <Tag>Sin estado</Tag>
  );

/** Estado del email: el "peor" de sus adjuntos XML (error > pendiente > procesado > omitido) */
function estadoEmail(email: EmailRecibido): EstadoAdjunto | null {
  const estados = email.attachments
    .map((a) => a.estado)
    .filter((e): e is EstadoAdjunto => !!e);
  for (const estado of [
    "PROCESADO_ERROR",
    "PENDIENTE",
    "PROCESADO_OK",
    "OMITIDO",
  ] as EstadoAdjunto[])
    if (estados.includes(estado)) return estado;
  return null;
}

/** Boton para bajar un adjunto con su nombre original */
function DescargarAdjunto({
  rut,
  emailId,
  adjunto,
}: {
  rut: string;
  emailId: number;
  adjunto: Adjunto;
}) {
  const { message } = App.useApp();
  const [bajando, setBajando] = useState(false);

  if (adjunto.integro === false)
    return (
      <Tooltip title="Se guardó antes de que el sistema guardara bien los archivos binarios (PDF, imágenes, planillas): el contenido quedó dañado">
        <Button size="small" icon={<DownloadOutlined />} disabled>
          Dañado
        </Button>
      </Tooltip>
    );

  const bajar = async () => {
    setBajando(true);
    try {
      const blob = await apiBlob(
        `/empresa/${rut}/emails/${emailId}/adjuntos/${adjunto.id}`,
      );
      descargarBlob(adjunto.name ?? `adjunto-${adjunto.id}`, blob);
    } catch (e) {
      message.error(
        `No se pudo bajar el adjunto: ${(e as { message?: string })?.message ?? "error"}`,
      );
    } finally {
      setBajando(false);
    }
  };

  return (
    <Button
      size="small"
      icon={<DownloadOutlined />}
      loading={bajando}
      onClick={bajar}
    >
      Bajar
    </Button>
  );
}

/** Emails recibidos por una empresa; se pueden reintentar los que tienen adjuntos con error o pendientes */
export function EmailsTable({ rut }: { rut: string }) {
  // Omitir adjuntos con error: solo ADMIN
  const [esAdmin, setEsAdmin] = useState(false);
  useEffect(() => {
    rolUsuario().then((r) => setEsAdmin(r === "ADMIN"));
  }, []);
  // Emails abiertos (con sus adjuntos a la vista): con la flecha o haciendo clic en el id
  const [abiertos, setAbiertos] = useState<number[]>([]);
  const alternar = (id: number) =>
    setAbiertos((actuales) => (actuales.includes(id) ? actuales.filter((a) => a !== id) : [...actuales, id]));
  // ?estado=PROCESADO_ERROR (link de "Atención" en el tablero)
  const [params] = useSearchParams();
  const estadoInicial = params.get("estado") as EstadoAdjunto | null;

  const { tableProps, searchFormProps, tableQuery } = useTable<
    EmailRecibido,
    HttpError,
    FiltrosForm
  >({
    resource: "emails",
    syncWithLocation: false,
    meta: { rut },
    pagination: { pageSize: 20 },
    // Por defecto solo los emails con adjuntos
    filters: {
      initial: [
        { field: "adjuntos", operator: "eq", value: "si" },
        ...(estadoInicial
          ? [{ field: "estado", operator: "eq" as const, value: estadoInicial }]
          : []),
      ],
    },
    onSearch: (values): CrudFilters => [
      {
        field: "adjuntos",
        operator: "eq",
        value: values.adjuntos === "todos" ? undefined : values.adjuntos,
      },
      { field: "estado", operator: "eq", value: values.estado },
      {
        field: "fecha",
        operator: "eq",
        value: values.fecha ? values.fecha.map((d) => d?.toDate()) : undefined,
      },
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
      <CarpetasImap rut={rut} />
      <Form
        {...searchFormProps}
        layout="inline"
        style={{ marginBottom: 16, rowGap: 8 }}
        initialValues={{ adjuntos: "si", estado: estadoInicial ?? undefined }}
      >
        <Form.Item name="adjuntos" label="Adjuntos">
          <Select<FiltroAdjuntos>
            style={{ width: 110 }}
            options={[
              { value: "si", label: "Sí" },
              { value: "no", label: "No" },
              { value: "todos", label: "Todos" },
            ]}
          />
        </Form.Item>
        <Form.Item name="estado" label="Estado">
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="Todos"
            options={Object.entries(ESTADOS_ADJUNTO).map(
              ([value, { label }]) => ({ value, label }),
            )}
          />
        </Form.Item>
        <Form.Item name="fecha" label="Fecha">
          <DatePicker.RangePicker format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item name="q" label="Buscar">
          <Input
            allowClear
            placeholder="Asunto o remitente"
            style={{ width: 220 }}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
            Buscar
          </Button>
        </Form.Item>
        <Form.Item>
          <ReintentarTodos rut={rut} onTerminado={() => tableQuery.refetch()} />
        </Form.Item>
      </Form>

      <Table<EmailRecibido>
        {...tableProps}
        rowKey="id"
        size="middle"
        // Ancho fijo por columna: remitente y asunto se recortan con "…" para que estado y acciones queden a la vista;
        // en pantallas angostas la tabla se desplaza horizontalmente
        tableLayout="fixed"
        scroll={{ x: 850 }}
        expandable={{
          expandedRowKeys: abiertos,
          onExpand: (_, email) => alternar(email.id),
          rowExpandable: (email) => email.attachments.length > 0,
          expandedRowRender: (email) => (
            <Table<Adjunto>
              dataSource={email.attachments}
              rowKey="id"
              size="small"
              pagination={false}
              expandable={{
                rowExpandable: (adjunto) => !!adjunto.errorStack,
                expandedRowRender: (adjunto) => (
                  <Collapse
                    size="small"
                    items={[
                      {
                        key: "stack",
                        label: "Stack trace completo",
                        children: (
                          <Typography.Paragraph
                            copyable={{ text: adjunto.errorStack ?? "" }}
                            style={{ marginBottom: 0 }}
                          >
                            <pre
                              style={{
                                maxHeight: 400,
                                overflow: "auto",
                                fontSize: 12,
                                margin: 0,
                                background: "#1e1e1e",
                                color: "#d4d4d4",
                                padding: 12,
                                borderRadius: 6,
                              }}
                            >
                              {adjunto.errorStack}
                            </pre>
                          </Typography.Paragraph>
                        ),
                      },
                    ]}
                  />
                ),
              }}
            >
              <Table.Column<Adjunto>
                title="Adjunto"
                dataIndex="name"
                sorter={ordenar<Adjunto>((a) => a.name)}
                render={(name) => name ?? "(sin nombre)"}
              />
              <Table.Column<Adjunto>
                title="Estado"
                dataIndex="estado"
                sorter={ordenar<Adjunto>((a) => (a.estado ? ESTADOS_ADJUNTO[a.estado]?.label ?? a.estado : null))}
                render={tagEstado}
              />
              <Table.Column<Adjunto>
                title="Error"
                dataIndex="error"
                sorter={ordenar<Adjunto>((a) => a.error)}
                render={(error?: string | null) =>
                  error ? (
                    <Typography.Text type="danger">{error}</Typography.Text>
                  ) : (
                    "-"
                  )
                }
              />
              <Table.Column<Adjunto>
                title=""
                width={110}
                render={(_, adjunto) => (
                  <DescargarAdjunto
                    rut={rut}
                    emailId={email.id}
                    adjunto={adjunto}
                  />
                )}
              />
            </Table>
          ),
        }}
      >
        <Table.Column<EmailRecibido>
          title="Id"
          dataIndex="id"
          width={90}
          sorter
          render={(_, email) =>
            email.attachments.length > 0 ? (
              <Typography.Link onClick={() => alternar(email.id)}>{email.id}</Typography.Link>
            ) : (
              <Typography.Text type="secondary">{email.id}</Typography.Text>
            )
          }
        />
        <Table.Column<EmailRecibido>
          title="Fecha"
          dataIndex="sentDate"
          sorter
          width={170}
          render={formatFechaApi}
        />
        <Table.Column<EmailRecibido>
          title="Remitente"
          dataIndex="from"
          sorter
          ellipsis={{ showTitle: true }}
        />
        <Table.Column<EmailRecibido>
          title="Asunto"
          dataIndex="subject"
          sorter
          ellipsis={{ showTitle: true }}
        />
        <Table.Column<EmailRecibido>
          title="Adjuntos"
          width={95}
          render={(_, email) => (
            <Space size={4}>
              <PaperClipOutlined />
              <Typography.Text>{email.attachments.length}</Typography.Text>
            </Space>
          )}
        />
        <Table.Column<EmailRecibido>
          title="Estado"
          width={115}
          render={(_, email) => {
            // Con error: el mensaje del primer adjunto con error al pasar el mouse
            const error = email.attachments.find((a) => a.error)?.error;
            return error ? (
              <Tooltip title={error}>{tagEstado(estadoEmail(email))}</Tooltip>
            ) : (
              tagEstado(estadoEmail(email))
            );
          }}
        />
        <Table.Column<EmailRecibido>
          title=""
          width={esAdmin ? 96 : 56}
          render={(_, email) =>
            email.attachments.some(
              (a) => a.estado === "PROCESADO_ERROR" || a.estado === "PENDIENTE",
            ) ? (
              <Space size={4}>
                <ReintentarEmail
                  rut={rut}
                  emailId={email.id}
                  conSobre={email.attachments.some(
                    (a) =>
                      /^Sob/i.test(a.name ?? "") &&
                      (a.estado === "PROCESADO_ERROR" || a.estado === "PENDIENTE"),
                  )}
                  soloIcono
                  onTerminado={() => tableQuery.refetch()}
                />
                {esAdmin && (
                  <OmitirEmail rut={rut} emailId={email.id} onTerminado={() => tableQuery.refetch()} />
                )}
              </Space>
            ) : null
          }
        />
      </Table>
    </>
  );
}
