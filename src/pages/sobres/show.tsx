import { Show } from "@refinedev/antd";
import { useOne } from "@refinedev/core";
import { Alert, Descriptions, Space, Table, Tag, Typography } from "antd";
import { Link, useParams } from "react-router";
import { ESTADOS_CFE, estadoDgiMostrado, formatFechaDia } from "../../constants/cfe";
import { useEmpresa } from "../../contexts/empresa";
import { urlDocumento } from "../../utils/busqueda";
import { estadosCfeEnSobre, rechazoDelSobre } from "../../utils/dgi";
import { ordenar } from "../../utils/orden";
import { etiquetaEmpresa } from "../documentos/list";
import { RechazoDgiAlert } from "../documentos/rechazo";
import { SobreDocumentoInfo } from "../documentos/sobre";
import { EstadoSobreTag } from "./componentes";
import { RespuestaCfeEstado } from "../documentos/respuestaCfe";
import { EmpresaConRutDgi } from "../../components/RutDgi";
import {
  etiquetaComprobante,
  type ComprobanteResumen,
  type SobreDetalle,
} from "./tipos";

const monto = (n?: number | null) =>
  n == null
    ? "-"
    : n.toLocaleString("es-UY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/** Detalle de un sobre: estado, rechazo de DGI, sus comprobantes (con links) y los XML */
export function SobreShow() {
  const { id = "" } = useParams();
  const { empresa } = useEmpresa();
  const { result: sobre, query } = useOne<SobreDetalle>({
    resource: "sobres",
    id,
    meta: { rut: empresa?.rut },
    queryOptions: { enabled: !!empresa },
  });

  if (query.isError)
    return (
      <Show title={`Sobre ${id}`}>
        <Alert
          type="error"
          showIcon
          message="No se pudo obtener el sobre"
          description={`${query.error?.message ?? ""} Puede ser de otra empresa: verifique la empresa seleccionada.`}
        />
      </Show>
    );

  const emitido = sobre?.direccion === "EMITIDO";
  const rechazo = rechazoDelSobre(sobre);
  // Estado que DGI dio a cada comprobante en este sobre (si el sobre se acepto y ya se consulto el resultado)
  const estadosDgi = estadosCfeEnSobre(sobre);
  const estadoEnSobre = (c: ComprobanteResumen) =>
    estadosDgi.find(
      (d) =>
        d.idTipoDoc === c.idTipoDoc && d.serie === c.serie && d.nro === c.nro,
    );
  // Sobre rechazado: DGI no proceso ninguno de sus comprobantes
  const estadoCfe = (c: ComprobanteResumen) =>
    rechazo
      ? "BE"
      : estadoDgiMostrado(estadoEnSobre(c)?.estado ?? c.estado, sobre?.estadoDgi);
  const textoEstado = (c: ComprobanteResumen) => {
    const estado = estadoCfe(c);
    return estado ? (ESTADOS_CFE[estado]?.label ?? estado) : "Sin respuesta";
  };
  const contraparte = (c: ComprobanteResumen) =>
    emitido
      ? (etiquetaEmpresa(c.empresaReceptora) ?? c.titular)
      : etiquetaEmpresa(c.empresaEmisora);
  const textoMotivos = (c: ComprobanteResumen) =>
    rechazo
      ? "Sobre rechazado"
      : (estadoEnSobre(c)?.motivos ?? [])
          .map((m) => `${m.codigo}${m.glosa ? ` ${m.glosa}` : ""}`)
          .join(" ") || null;

  return (
    <Show
      isLoading={query.isLoading}
      title={`Sobre ${id}`}
      headerButtons={() => null}
    >
      {sobre && (
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          {rechazo && <RechazoDgiAlert rechazo={rechazo} />}
          {!emitido && sobre.observacionesRecepcion && (
            <Alert
              type="warning"
              showIcon
              message="Controles del sobre no superados"
              description={
                <Space direction="vertical" size={2}>
                  {sobre.observacionesRecepcion.split("; ").map((o, i) => (
                    <span key={i}>{o}</span>
                  ))}
                </Space>
              }
            />
          )}

          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Dirección">
              {emitido ? "Emitido" : "Recibido"}
            </Descriptions.Item>
            <Descriptions.Item label="Fecha">
              {formatFechaDia(sobre.fecha) || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Emisor">
              <EmpresaConRutDgi
                etiqueta={etiquetaEmpresa(sobre.empresaEmisora) ?? "-"}
                rut={sobre.empresaEmisora?.rut}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Receptor">
              <EmpresaConRutDgi
                etiqueta={
                  etiquetaEmpresa(sobre.empresaReceptora) ??
                  (emitido ? "DGI" : "-")
                }
                rut={sobre.empresaReceptora?.rut}
              />
            </Descriptions.Item>
            {emitido ? (
              <Descriptions.Item label="Estado DGI">
                <EstadoSobreTag estado={sobre.estadoDgi} />
              </Descriptions.Item>
            ) : (
              <Descriptions.Item label="Nuestra respuesta">
                <EstadoSobreTag estado={sobre.estadoEmpresa} />
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Comprobantes">
              {sobre.comprobantes.length}
            </Descriptions.Item>
            {!emitido && empresa && (
              <Descriptions.Item label="Respuesta a los comprobantes" span={2}>
                <RespuestaCfeEstado rut={empresa.rut} sobre={sobre} onEnviada={() => query.refetch()} />
              </Descriptions.Item>
            )}
          </Descriptions>

          <div>
            <Typography.Title level={5}>
              Comprobantes del sobre ({sobre.comprobantes.length})
            </Typography.Title>
            <Table<ComprobanteResumen>
              dataSource={sobre.comprobantes}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: true }}
            >
              <Table.Column<ComprobanteResumen>
                title="Comprobante"
                sorter={ordenar<ComprobanteResumen>(etiquetaComprobante)}
                render={(_, c) => {
                  const url = urlDocumento(c, sobre.direccion);
                  return url ? (
                    <Link to={url}>{etiquetaComprobante(c)}</Link>
                  ) : (
                    etiquetaComprobante(c)
                  );
                }}
              />
              <Table.Column<ComprobanteResumen>
                title="Fecha"
                sorter={ordenar<ComprobanteResumen>((c) => c.fechaEmision)}
                render={(_, c) => formatFechaDia(c.fechaEmision)}
              />
              <Table.Column<ComprobanteResumen>
                title={emitido ? "Receptor" : "Emisor"}
                sorter={ordenar<ComprobanteResumen>(contraparte)}
                render={(_, c) => contraparte(c) ?? "-"}
              />
              <Table.Column<ComprobanteResumen>
                title="Total"
                align="right"
                sorter={ordenar<ComprobanteResumen>((c) => c.totMntTotal)}
                render={(_, c) => `${c.moneda ?? ""} ${monto(c.totMntTotal)}`}
              />
              <Table.Column<ComprobanteResumen>
                title="Estado DGI"
                sorter={ordenar<ComprobanteResumen>(textoEstado)}
                render={(_, c) => {
                  const estado = estadoCfe(c);
                  if (!estado) return <Tag>Sin respuesta</Tag>;
                  return (
                    <Tag color={ESTADOS_CFE[estado]?.color}>
                      {ESTADOS_CFE[estado]?.label ?? estado}
                    </Tag>
                  );
                }}
              />
              <Table.Column<ComprobanteResumen>
                title="Motivo"
                sorter={ordenar<ComprobanteResumen>(textoMotivos)}
                render={(_, c) => {
                  if (rechazo)
                    return (
                      <Typography.Text type="secondary">
                        Sobre rechazado
                      </Typography.Text>
                    );
                  const motivos = estadoEnSobre(c)?.motivos ?? [];
                  return motivos.length === 0
                    ? "-"
                    : motivos.map((m, i) => (
                        <div key={i}>
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
                      ));
                }}
              />
            </Table>
          </div>

          <div>
            <Typography.Title level={5}>Sobre</Typography.Title>
            <SobreDocumentoInfo
              estado={{
                data: { direccion: sobre.direccion, sobre },
                error: null,
                loading: false,
              }}
              enlazar={false}
            />
          </div>
        </Space>
      )}
    </Show>
  );
}
