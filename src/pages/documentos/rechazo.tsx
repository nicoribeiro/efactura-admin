import { Alert, Space, Spin, Tag, Tooltip, Typography } from "antd";
import { useState, type ReactNode } from "react";
import { AYUDA_RECIBIDO, ESTADOS_CFE, estadoDgiMostrado } from "../../constants/cfe";
import {
  rechazoDgi,
  type MotivoRechazo,
  type RechazoDgi,
} from "../../utils/dgi";
import {
  obtenerSobreDocumento,
  type DocumentoRef,
  type Sobre,
} from "./useSobre";

/** Codigos de estado de DGI a texto */
const ESTADOS_RECHAZO: Record<string, string> = {
  BS: "sobre rechazado",
  BE: "comprobante rechazado",
  CE: "comprobante observado",
};

function ListaMotivos({
  motivos,
  compacto,
}: {
  motivos: MotivoRechazo[];
  compacto?: boolean;
}) {
  if (motivos.length === 0)
    return (
      <Typography.Text type="secondary">
        DGI no informó el motivo.
      </Typography.Text>
    );
  return (
    <Space
      direction="vertical"
      size={compacto ? 4 : 8}
      style={{ width: "100%" }}
    >
      {motivos.map((m, i) => (
        <div key={i}>
          <Typography.Text
            strong
            style={{ color: compacto ? "inherit" : undefined }}
          >
            {m.codigo}
            {m.glosa ? ` – ${m.glosa}` : ""}
          </Typography.Text>
          {m.detalle && (
            <div
              style={{
                fontSize: compacto ? 12 : 13,
                opacity: compacto ? 0.85 : 1,
                wordBreak: "break-word",
              }}
            >
              {m.detalle}
            </div>
          )}
        </div>
      ))}
    </Space>
  );
}

/** Caja con el motivo del rechazo de DGI, para el detalle del comprobante */
export function RechazoDgiAlert({ rechazo }: { rechazo: RechazoDgi }) {
  const titulo =
    rechazo.nivel === "sobre"
      ? `DGI rechazó el sobre completo (${rechazo.estado})`
      : `DGI rechazó este comprobante (${rechazo.estado})`;
  return (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
      message={titulo}
      description={
        <>
          <ListaMotivos motivos={rechazo.motivos} />
          {rechazo.nivel === "sobre" && (
            <Typography.Paragraph
              type="secondary"
              style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}
            >
              Al rechazarse el sobre, DGI no procesó ninguno de los comprobantes
              que contenía.
            </Typography.Paragraph>
          )}
        </>
      }
    />
  );
}

/**
 * Etiqueta de estado DGI para el listado. En los rechazados/observados, al pasar el mouse busca el sobre (una sola vez)
 * y muestra el motivo.
 */
export function EstadoDgiTag({
  estado,
  estadoSobreDgi,
  rut,
  documento,
  direccion,
  rutExterno,
}: {
  estado?: string | null;
  /** Estado DGI del sobre (emitidos): con AS y sin estado del CFE se muestra Recibido */
  estadoSobreDgi?: string | null;
  rut?: string;
  documento?: DocumentoRef;
  direccion: string;
  rutExterno?: string;
}) {
  const [contenido, setContenido] = useState<ReactNode>(null);
  const [cargado, setCargado] = useState(false);

  if (!estado && direccion === "EMITIDO" && estadoDgiMostrado(estado, estadoSobreDgi) === "RECIBIDO")
    return (
      <Tooltip title={AYUDA_RECIBIDO}>
        <Tag color={ESTADOS_CFE.RECIBIDO.color}>{ESTADOS_CFE.RECIBIDO.label}</Tag>
      </Tooltip>
    );
  if (!estado) return <Tag>Sin respuesta</Tag>;
  const tag = (
    <Tag color={ESTADOS_CFE[estado]?.color}>
      {ESTADOS_CFE[estado]?.label ?? estado}
    </Tag>
  );
  if (estado === "AE" || !rut || !documento) return tag;

  const cargar = (abierto: boolean) => {
    if (!abierto || cargado) return;
    setCargado(true);
    setContenido(<Spin size="small" />);
    obtenerSobreDocumento(rut, documento, direccion, rutExterno)
      .then((r) => {
        const rechazo = rechazoDgi(r.sobre as Sobre | null, documento);
        setContenido(
          rechazo ? (
            <div style={{ maxWidth: 420 }}>
              <div style={{ marginBottom: 4 }}>
                DGI: {ESTADOS_RECHAZO[rechazo.estado] ?? rechazo.estado}
              </div>
              <ListaMotivos motivos={rechazo.motivos} compacto />
            </div>
          ) : (
            "No se encontró el motivo en la respuesta de DGI"
          ),
        );
      })
      .catch((e) => setContenido(`No se pudo obtener el motivo: ${e.message}`));
  };

  return (
    <Tooltip
      title={contenido ?? "Cargando motivo..."}
      onOpenChange={cargar}
      overlayStyle={{ maxWidth: 460 }}
    >
      <span style={{ cursor: "help" }}>{tag}</span>
    </Tooltip>
  );
}
