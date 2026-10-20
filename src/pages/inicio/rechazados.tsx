import { Alert, Card, Space, Table, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiJson } from "../../api/http";
import { tipoDocByName } from "../../constants/cfe";
import { documentoId } from "../../providers/dataProvider";
import { rechazoDgi, type RechazoDgi } from "../../utils/dgi";
import type { Documento } from "../documentos/list";
import { obtenerSobreDocumento } from "../documentos/useSobre";

/** Cuantos rechazados se muestran con su motivo (cada uno consulta su sobre) */
const MAXIMO = 10;

interface Fila {
  documento: Documento;
  idTipoDoc?: number;
  rechazo?: RechazoDgi | null;
  errorMotivo?: string;
}

const monto = (n?: number) =>
  n?.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) ?? "-";

/**
 * Comprobantes emitidos rechazados por DGI en el periodo, con el motivo (sale del sobre de cada uno).
 * No se muestra si no hay rechazados.
 */
export function RechazadosCard({
  rut,
  desde,
  hasta,
  urlListado,
}: {
  rut: string;
  desde: Dayjs;
  hasta: Dayjs;
  urlListado: string;
}) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(undefined);

    apiJson<{ results: Documento[]; count: number }>(
      "GET",
      `/empresa/${rut}/documentos`,
      {
        direccion: "EMITIDO",
        estado: "BE",
        fromDate: Math.floor(desde.startOf("day").valueOf() / 1000),
        toDate: Math.floor(hasta.endOf("day").valueOf() / 1000),
        page: 1,
        pageSize: MAXIMO,
      },
    )
      .then(async (lista) => {
        const base: Fila[] = lista.results.map((documento) => ({
          documento,
          idTipoDoc: tipoDocByName(documento.tipo)?.id,
        }));
        if (cancelado) return;
        setTotal(lista.count);
        setFilas(base);
        setLoading(false);

        // Motivo de cada uno, en paralelo; si falla uno el resto se muestra igual
        const motivos = await Promise.allSettled(
          base.map((f) =>
            f.idTipoDoc
              ? obtenerSobreDocumento(
                  rut,
                  {
                    idTipoDoc: f.idTipoDoc,
                    serie: f.documento.serie,
                    nro: f.documento.nro,
                  },
                  "EMITIDO",
                ).then((r) =>
                  rechazoDgi(r.sobre, {
                    idTipoDoc: f.idTipoDoc!,
                    serie: f.documento.serie,
                    nro: f.documento.nro,
                  }),
                )
              : Promise.resolve(null),
          ),
        );
        if (cancelado) return;
        setFilas(
          base.map((f, i) => {
            const r = motivos[i];
            return r.status === "fulfilled"
              ? { ...f, rechazo: r.value }
              : { ...f, errorMotivo: (r.reason as Error)?.message ?? "Error" };
          }),
        );
      })
      .catch((e: Error) => {
        if (cancelado) return;
        setError(e.message);
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [rut, desde, hasta]);

  if (!loading && !error && total === 0) return null;

  return (
    <Card
      size="small"
      title={`Rechazados por DGI en el período${total ? ` (${total})` : ""}`}
      extra={
        total > MAXIMO ? (
          <Link to={urlListado}>Ver los {total} rechazados</Link>
        ) : (
          <Link to={urlListado}>Ver en CFE</Link>
        )
      }
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          message="No se pudieron obtener los rechazados"
          description={error}
        />
      ) : (
        <Table<Fila>
          dataSource={filas}
          rowKey={(f) => f.documento.id}
          size="small"
          pagination={false}
          loading={loading}
          scroll={{ x: true }}
        >
          <Table.Column<Fila>
            title="CFE"
            render={(_, f) => {
              const t = tipoDocByName(f.documento.tipo);
              const texto = `${t?.label ?? f.documento.tipo} ${f.documento.serie}-${f.documento.nro}`;
              return f.idTipoDoc ? (
                <Link
                  to={`/documentos/show/${encodeURIComponent(documentoId(f.idTipoDoc, f.documento.serie, f.documento.nro))}?direccion=EMITIDO`}
                >
                  {texto}
                </Link>
              ) : (
                texto
              );
            }}
          />
          <Table.Column<Fila>
            title="Fecha"
            render={(_, f) => (
              <span style={{ whiteSpace: "nowrap" }}>
                {f.documento.fechaEmision
                  ? dayjs(f.documento.fechaEmision.slice(0, 10)).format(
                      "DD/MM/YYYY",
                    )
                  : "-"}
              </span>
            )}
          />
          <Table.Column<Fila>
            title="Receptor"
            render={(_, f) =>
              f.documento.empresaReceptora?.razon ??
              f.documento.empresaReceptora?.rut ??
              f.documento.titular?.documento ??
              "-"
            }
          />
          <Table.Column<Fila>
            title="Total"
            align="right"
            render={(_, f) =>
              `${f.documento.moneda ?? ""} ${monto(f.documento.totMntTotal)}`
            }
          />
          <Table.Column<Fila>
            title="Motivo"
            width="45%"
            render={(_, f) => {
              if (f.errorMotivo)
                return (
                  <Typography.Text type="secondary">
                    No se pudo obtener: {f.errorMotivo}
                  </Typography.Text>
                );
              if (f.rechazo === undefined)
                return (
                  <Typography.Text type="secondary">Cargando…</Typography.Text>
                );
              if (!f.rechazo || f.rechazo.motivos.length === 0)
                return (
                  <Typography.Text type="secondary">
                    DGI no informó el motivo
                  </Typography.Text>
                );
              return (
                <Space
                  direction="vertical"
                  size={2}
                  style={{ width: "100%", minWidth: 320 }}
                >
                  {f.rechazo.motivos.map((m, i) => (
                    <div key={i}>
                      {f.rechazo!.nivel === "sobre" && i === 0 && (
                        <Tag color="red">Sobre rechazado</Tag>
                      )}
                      <Typography.Text strong>
                        {m.codigo}
                        {m.glosa ? ` – ${m.glosa}` : ""}
                      </Typography.Text>
                      {m.detalle && (
                        <Typography.Paragraph
                          type="secondary"
                          style={{ fontSize: 12, marginBottom: 0 }}
                          ellipsis={{
                            rows: 2,
                            expandable: true,
                            symbol: "más",
                          }}
                        >
                          {m.detalle}
                        </Typography.Paragraph>
                      )}
                    </div>
                  ))}
                </Space>
              );
            }}
          />
        </Table>
      )}
    </Card>
  );
}
