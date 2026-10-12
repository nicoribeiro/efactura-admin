import { Alert, Table, Tag, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { apiJson } from "../../api/http";
import { formatFechaApi } from "../../constants/cfe";
import type { DocumentoRef } from "./useSobre";

interface EnvioMail {
  id: number;
  fecha: string;
  tipo?: "XML_RECEPTOR" | "PDF" | "ACK_SOBRE" | "ACK_CFE" | "OTRO" | null;
  destinatarios?: string | null;
  archivo?: string | null;
  ok: boolean;
  error?: string | null;
  origen?: string | null;
}

const TIPOS: Record<string, string> = {
  XML_RECEPTOR: "XML al receptor",
  PDF: "PDF",
  ACK_SOBRE: "Respuesta al sobre",
  ACK_CFE: "Respuesta a los CFE",
  OTRO: "Otro",
};

/**
 * Historial de envios por mail (EnvioMail): de un comprobante emitido o, para los recibidos, del sobre (las respuestas
 * al emisor). Los envios se registran desde que la API guarda EnvioMail; los anteriores no aparecen.
 */
export function EnviosMail({
  rut,
  documento,
  sobreId,
  recarga,
}: {
  rut: string;
  /** Comprobante emitido */
  documento?: DocumentoRef;
  /** Sobre (recibidos) */
  sobreId?: number;
  /** Cambiarlo vuelve a cargar la lista */
  recarga?: number;
}) {
  const [envios, setEnvios] = useState<EnvioMail[]>();
  const [error, setError] = useState<string>();

  const idTipoDoc = documento?.idTipoDoc;
  const serie = documento?.serie;
  const nro = documento?.nro;

  useEffect(() => {
    const query =
      idTipoDoc !== undefined && serie !== undefined && nro !== undefined
        ? { idTipoDoc, serie, nro }
        : sobreId !== undefined
          ? { sobre: sobreId }
          : undefined;
    if (!query) return;
    let cancelado = false;
    apiJson<EnvioMail[]>("GET", `/empresa/${rut}/documentos/enviosMail`, query)
      .then((r) => !cancelado && setEnvios(r))
      .catch((e) => !cancelado && setError(e.message));
    return () => {
      cancelado = true;
    };
  }, [rut, idTipoDoc, serie, nro, sobreId, recarga]);

  if (error)
    return (
      <Alert
        type="warning"
        showIcon
        message="No se pudieron obtener los envíos por mail"
        description={error}
      />
    );

  return (
    <Table<EnvioMail>
      dataSource={envios}
      loading={envios === undefined}
      rowKey="id"
      size="small"
      pagination={false}
      locale={{
        emptyText: (
          <Typography.Text type="secondary">
            Sin envíos registrados (se registran desde octubre de 2026)
          </Typography.Text>
        ),
      }}
    >
      <Table.Column<EnvioMail> title="Fecha" dataIndex="fecha" render={formatFechaApi} />
      <Table.Column<EnvioMail>
        title="Qué"
        dataIndex="tipo"
        render={(t?: string | null) => (t ? (TIPOS[t] ?? t) : "-")}
      />
      <Table.Column<EnvioMail> title="A" dataIndex="destinatarios" render={(d) => d ?? "-"} />
      <Table.Column<EnvioMail>
        title="Resultado"
        render={(_, e) =>
          e.ok ? (
            <Tag color="green">Enviado</Tag>
          ) : (
            <Tooltip title={e.error}>
              <Tag color="red">Error</Tag>
            </Tooltip>
          )
        }
      />
      <Table.Column<EnvioMail> title="Origen" dataIndex="origen" render={(o) => o ?? "-"} />
    </Table>
  );
}
