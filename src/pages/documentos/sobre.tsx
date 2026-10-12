import { Alert, Collapse, Descriptions, Empty, Skeleton, Tag } from "antd";
import { formatFechaApi } from "../../constants/cfe";
import { XmlCode } from "../../components/XmlCode";
import type { EstadoSobre } from "./useSobre";

/** Estados de un sobre (EstadoACKSobreType) */
const ESTADOS_SOBRE: Record<string, { label: string; color: string }> = {
  AS: { label: "Recibido", color: "green" },
  BS: { label: "Rechazado", color: "red" },
  BA: { label: "BA", color: "orange" },
};

const tagEstado = (estado?: string | null, sinValor = "Sin respuesta") =>
  estado ? (
    <Tag color={ESTADOS_SOBRE[estado]?.color}>
      {ESTADOS_SOBRE[estado]?.label ?? estado} ({estado})
    </Tag>
  ) : (
    <Tag>{sinValor}</Tag>
  );

/** Indentado y coloreado; "copiar" copia el XML original (esta firmado: cambiar espacios invalida la firma) */
const xml = (contenido?: string | null) => <XmlCode xml={contenido ?? ""} />;

/** Sobre en el que viajo el comprobante (solo lectura); los datos los carga el detalle con useSobreDocumento */
export function SobreDocumentoInfo({ estado }: { estado: EstadoSobre }) {
  const { data, error, loading } = estado;

  if (loading) return <Skeleton active paragraph={{ rows: 3 }} />;

  if (error)
    return (
      <Alert
        type="error"
        showIcon
        message="No se pudo obtener el sobre"
        description={
          error.statusCode === 404
            ? "La API no tiene el endpoint GET /empresa/:rut/documentos/sobre (requiere una versión más nueva de java_efactura_uy)."
            : error.message
        }
      />
    );

  const sobre = data?.sobre;
  if (!sobre)
    return <Empty description="El comprobante no tiene sobre asociado" />;

  const emitido = data?.direccion === "EMITIDO";

  const xmls = [
    { key: "xmlDgi", label: "Sobre enviado a DGI", contenido: sobre.xmlDgi },
    {
      key: "respuesta_dgi",
      label: "Respuesta de DGI (recepción)",
      contenido: sobre.respuesta_dgi,
    },
    {
      key: "resultado_dgi",
      label: "Resultado de DGI (consulta)",
      contenido: sobre.resultado_dgi,
    },
    {
      key: "xmlEmpresa",
      label: emitido
        ? "Sobre enviado a la empresa receptora"
        : "Sobre recibido",
      contenido: sobre.xmlEmpresa,
    },
    {
      key: "respuestaSobre",
      label: `Respuesta del sobre${sobre.respuestaSobre?.nombreArchivo ? ` (${sobre.respuestaSobre.nombreArchivo})` : ""}`,
      contenido: sobre.respuestaSobre?.payload,
    },
    {
      key: "respuestaCfes",
      label: `Respuesta de los CFE${sobre.respuestaCfes?.nombreArchivo ? ` (${sobre.respuestaCfes.nombreArchivo})` : ""}`,
      contenido: sobre.respuestaCfes?.payload,
    },
  ].filter((x) => x.contenido);

  return (
    <>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="Archivo" span={2}>
          {sobre.nombreArchivo ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Fecha">
          {formatFechaApi(sobre.fecha) || "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Comprobantes en el sobre">
          {sobre.cantComprobantes ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Id emisor">
          {sobre.idEmisor ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Id receptor">
          {sobre.idReceptor ?? "-"}
        </Descriptions.Item>
        {emitido && (
          <>
            <Descriptions.Item label="Estado DGI">
              {tagEstado(sobre.estadoDgi)}
            </Descriptions.Item>
            <Descriptions.Item label="Última consulta a DGI">
              {formatFechaApi(sobre.fechaConsulta) || "-"}
            </Descriptions.Item>
          </>
        )}
        {!emitido && (
          <>
            <Descriptions.Item label="Recibido">
              {formatFechaApi(sobre.timestampRecibido) || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Procesado">
              {formatFechaApi(sobre.timestampProcesado) || "-"}
            </Descriptions.Item>
          </>
        )}
        <Descriptions.Item
          label={
            emitido
              ? "Estado en la empresa receptora"
              : "Estado de nuestra respuesta"
          }
        >
          {tagEstado(sobre.estadoEmpresa)}
        </Descriptions.Item>
        <Descriptions.Item label="Motivo">
          {sobre.motivo || "-"}
        </Descriptions.Item>
      </Descriptions>

      {xmls.length > 0 && (
        <Collapse
          size="small"
          style={{ marginTop: 16 }}
          items={xmls.map((x) => ({
            key: x.key,
            label: x.label,
            children: xml(x.contenido),
          }))}
        />
      )}
    </>
  );
}
