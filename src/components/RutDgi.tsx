import { CloudOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Input,
  List,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { apiJson } from "../api/http";
import { estadoFirma } from "../constants/firma";
import { useEmpresa } from "../contexts/empresa";

/** Respuesta de GET /rut/:rut (DatosRutDgi en la API) */
interface DatosRut {
  rut: string | null;
  denominacion: string | null;
  nombreFantasia: string | null;
  tipoEntidad: { codigo: string | null; descripcion: string | null };
  estadoActividad: { codigo: string | null; descripcion: string | null };
  fechaInicioActividad: string | null;
  domicilioFiscal: {
    calle: string | null;
    numero: string | null;
    bis: string | null;
    apartamento: string | null;
    localidad: string | null;
    departamento: string | null;
    codigoPostal: string | null;
    comentario: string | null;
    complementos: { tipo: string | null; valor: string | null }[];
  } | null;
  contactos: { tipo: string | null; valor: string | null }[];
  actividades: {
    codigo: string | null;
    nombre: string | null;
    desde: string | null;
  }[];
}

/** Color del estado de actividad empresarial (AA activo, AF a futuro, CC/CH cancelado, NT nunca tuvo) */
const COLOR_ESTADO: Record<string, string> = {
  AA: "green",
  AF: "gold",
  CC: "red",
  CH: "red",
  NT: "red",
};

/** RUT valido para consultar: numerico de hasta 12 digitos */
const esRut = (v?: string | null) => !!v && /^\d{1,12}$/.test(v.trim());

const fecha = (v?: string | null) =>
  v ? v.split("-").reverse().join("/") : "-";

/**
 * Datos de un RUT en DGI, consultados al mostrarse (nada se guarda: ni en la API ni en el navegador). La consulta se
 * firma con la firma digital de la empresa seleccionada si esta vigente; si no, la API elige una a la que el usuario
 * tiene acceso.
 */
export function DatosRutDgi({ rut }: { rut: string }) {
  const { empresa } = useEmpresa();
  const [datos, setDatos] = useState<DatosRut>();
  const [error, setError] = useState<string>();
  const firmaVigente =
    !!empresa?.firmaDigital &&
    (estadoFirma(empresa.firmaDigital).dias ?? -1) >= 0;
  const firmante = firmaVigente ? empresa?.rut : undefined;

  useEffect(() => {
    let cancelado = false;
    setDatos(undefined);
    setError(undefined);
    apiJson<DatosRut>(
      "GET",
      `/rut/${rut.trim()}`,
      firmante ? { empresa: firmante } : undefined,
    )
      .then((r) => !cancelado && setDatos(r))
      .catch(
        (e: { message?: string }) =>
          !cancelado && setError(e?.message ?? "Error"),
      );
    return () => {
      cancelado = true;
    };
  }, [rut, firmante]);

  if (error)
    return (
      <Alert
        type="warning"
        showIcon
        message="DGI no devolvió los datos"
        description={error}
      />
    );
  if (!datos) return <Skeleton active paragraph={{ rows: 6 }} />;

  const d = datos.domicilioFiscal;
  const direccion = d
    ? [
        [d.calle, d.numero, d.bis].filter(Boolean).join(" "),
        d.apartamento ? `apto. ${d.apartamento}` : null,
        d.localidad,
        d.departamento && d.departamento !== d.localidad
          ? d.departamento
          : null,
        d.codigoPostal ? `CP ${d.codigoPostal}` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "-";
  const estado = datos.estadoActividad;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="RUT">{datos.rut}</Descriptions.Item>
        <Descriptions.Item label="Denominación">
          {datos.denominacion ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Nombre de fantasía">
          {datos.nombreFantasia ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Tipo de entidad">
          {datos.tipoEntidad?.descripcion ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Actividad empresarial">
          <Space size={8}>
            <Tag color={COLOR_ESTADO[estado?.codigo ?? ""]}>
              {estado?.descripcion ?? estado?.codigo ?? "-"}
            </Tag>
            {datos.fechaInicioActividad && (
              <Typography.Text type="secondary">
                desde el {fecha(datos.fechaInicioActividad)}
              </Typography.Text>
            )}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Domicilio fiscal">
          {direccion || "-"}
          {d?.comentario && (
            <div style={{ fontSize: 12, opacity: 0.8 }}>{d.comentario}</div>
          )}
          {d?.complementos?.map((c, i) => (
            <div key={i} style={{ fontSize: 12, opacity: 0.8 }}>
              {c.tipo}: {c.valor}
            </div>
          ))}
        </Descriptions.Item>
        <Descriptions.Item label="Contactos">
          {datos.contactos.length === 0
            ? "-"
            : datos.contactos.map((c, i) => (
                <div key={i}>
                  <Typography.Text type="secondary">{c.tipo}: </Typography.Text>
                  {c.valor}
                </div>
              ))}
        </Descriptions.Item>
      </Descriptions>
      <div>
        <Typography.Title level={5}>Actividades</Typography.Title>
        <List
          size="small"
          bordered
          dataSource={datos.actividades}
          locale={{ emptyText: "Sin actividades" }}
          renderItem={(a) => (
            <List.Item>
              <Space direction="vertical" size={0}>
                <span>
                  {a.nombre}{" "}
                  <Typography.Text type="secondary">
                    ({a.codigo})
                  </Typography.Text>
                </span>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  desde el {fecha(a.desde)}
                </Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Consultado a DGI ahora; no se guarda.
      </Typography.Text>
    </Space>
  );
}

/** Panel lateral con los datos de DGI de un RUT; consulta solo mientras esta abierto */
function PanelRutDgi({ rut, onClose }: { rut?: string; onClose: () => void }) {
  return (
    <Drawer
      open={!!rut}
      onClose={onClose}
      title={`Datos en DGI${rut ? ` – RUT ${rut}` : ""}`}
      width={520}
      destroyOnHidden
    >
      {rut && <DatosRutDgi rut={rut} />}
    </Drawer>
  );
}

/** Boton que consulta a DGI los datos de un RUT, a pedido del usuario */
export function BotonRutDgi({
  rut,
  texto,
  size = "small",
}: {
  rut?: string | null;
  texto?: string;
  /** small al lado de un dato; middle entre otros botones de accion */
  size?: "small" | "middle";
}) {
  const [abierto, setAbierto] = useState(false);
  if (!esRut(rut)) return null;
  return (
    <>
      <Tooltip title="Consultar los datos de este RUT en DGI">
        <Button
          size={size}
          icon={<CloudOutlined />}
          onClick={() => setAbierto(true)}
        >
          {texto ?? "DGI"}
        </Button>
      </Tooltip>
      <PanelRutDgi
        rut={abierto ? rut!.trim() : undefined}
        onClose={() => setAbierto(false)}
      />
    </>
  );
}

/**
 * Empresa (o documento) con el boton de DGI al lado, alineados al centro; si no entra en una linea el boton pasa abajo
 */
export function EmpresaConRutDgi({
  etiqueta,
  rut,
}: {
  etiqueta: ReactNode;
  rut?: string | null;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "4px 8px" }}>
      <span>{etiqueta}</span>
      <BotonRutDgi rut={rut} />
    </span>
  );
}

/** Campo de la barra superior: consulta a DGI cualquier RUT, sin que tenga que existir en el sistema */
export function ConsultarRut() {
  const [texto, setTexto] = useState("");
  const [rut, setRut] = useState<string>();
  const [error, setError] = useState<string>();
  return (
    <>
      <Tooltip open={!!error} title={error} placement="bottom">
        <Input.Search
          allowClear
          placeholder="RUT en DGI"
          // Igual que el buscador de comprobantes: como bloque lo centra el flex del encabezado
          style={{ width: 180, display: "block" }}
          value={texto}
          status={error ? "warning" : undefined}
          onChange={(e) => {
            setTexto(e.target.value);
            setError(undefined);
          }}
          onSearch={(v) => {
            if (!v.trim()) return;
            if (!esRut(v)) {
              setError("El RUT tiene que ser numérico, de hasta 12 dígitos");
              return;
            }
            setRut(v.trim());
          }}
          onBlur={() => setError(undefined)}
        />
      </Tooltip>
      <PanelRutDgi rut={rut} onClose={() => setRut(undefined)} />
    </>
  );
}
