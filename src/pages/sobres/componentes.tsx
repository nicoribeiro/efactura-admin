import { Space, Spin, Tag, Tooltip, Typography } from "antd";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { apiJson } from "../../api/http";
import { ESTADOS_CFE } from "../../constants/cfe";
import { urlDocumento } from "../../utils/busqueda";
import { rechazoDelSobre } from "../../utils/dgi";
import {
  ESTADOS_SOBRE,
  etiquetaComprobante,
  type ComprobanteResumen,
  type SobreDetalle,
} from "./tipos";

/** Estado de un sobre (AS, BS, BA) o "Sin respuesta" */
export function EstadoSobreTag({
  estado,
  sinValor = "Sin respuesta",
}: {
  estado?: string | null;
  sinValor?: string;
}) {
  return estado ? (
    <Tag color={ESTADOS_SOBRE[estado]?.color}>
      {ESTADOS_SOBRE[estado]?.label ?? estado} ({estado})
    </Tag>
  ) : (
    <Tag>{sinValor}</Tag>
  );
}

/**
 * Estado de DGI de un sobre emitido. Si DGI lo rechazo (BS), al pasar el mouse busca el sobre (una sola vez) y
 * muestra el motivo.
 */
export function EstadoSobreDgi({
  estado,
  rut,
  idSobre,
}: {
  estado?: string | null;
  rut: string;
  idSobre: number;
}) {
  const [contenido, setContenido] = useState<ReactNode>(null);
  const [cargado, setCargado] = useState(false);

  const tag = <EstadoSobreTag estado={estado} />;
  if (estado !== "BS") return tag;

  const cargar = (abierto: boolean) => {
    if (!abierto || cargado) return;
    setCargado(true);
    setContenido(<Spin size="small" />);
    apiJson<SobreDetalle>("GET", `/empresa/${rut}/sobre`, { idSobre })
      .then((sobre) => {
        const rechazo = rechazoDelSobre(sobre);
        setContenido(
          rechazo && rechazo.motivos.length > 0 ? (
            <Space direction="vertical" size={4} style={{ maxWidth: 420 }}>
              {rechazo.motivos.map((m, i) => (
                <div key={i}>
                  <strong>
                    {m.codigo}
                    {m.glosa ? ` – ${m.glosa}` : ""}
                  </strong>
                  {m.detalle && (
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.85,
                        wordBreak: "break-word",
                      }}
                    >
                      {m.detalle}
                    </div>
                  )}
                </div>
              ))}
            </Space>
          ) : (
            "DGI no informó el motivo"
          ),
        );
      })
      .catch((e: Error) =>
        setContenido(`No se pudo obtener el motivo: ${e.message}`),
      );
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

/** Comprobantes de un sobre con link a cada detalle; muestra los primeros `maximo` y "+N" */
export function LinksComprobantes({
  comprobantes,
  direccion,
  maximo = 3,
}: {
  comprobantes: ComprobanteResumen[];
  direccion: "EMITIDO" | "RECIBIDO";
  maximo?: number;
}) {
  if (comprobantes.length === 0)
    return <Typography.Text type="secondary">-</Typography.Text>;
  const visibles = comprobantes.slice(0, maximo);
  return (
    <Space size={[8, 2]} wrap onClick={(e) => e.stopPropagation()}>
      {visibles.map((c) => {
        const url = urlDocumento(c, direccion);
        const texto = etiquetaComprobante(c);
        const estado = c.estado ? ESTADOS_CFE[c.estado] : undefined;
        return (
          <span key={c.id} style={{ whiteSpace: "nowrap" }}>
            {url ? <Link to={url}>{texto}</Link> : texto}
            {estado && c.estado !== "AE" && (
              <Tag color={estado.color} style={{ marginLeft: 4 }}>
                {estado.label}
              </Tag>
            )}
          </span>
        );
      })}
      {comprobantes.length > maximo && (
        <Typography.Text type="secondary">
          +{comprobantes.length - maximo}
        </Typography.Text>
      )}
    </Space>
  );
}
