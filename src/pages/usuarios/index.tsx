import { UserAddOutlined } from "@ant-design/icons";
import { List } from "@refinedev/antd";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { apiJson } from "../../api/http";
import { formatFechaApi } from "../../constants/cfe";
import { navegador } from "../../utils/userAgent";
import { cuentaActual } from "../../providers/authProvider";
import { AccionesUsuario } from "./acciones";
import { FormularioUsuario } from "./formulario";
import { MostrarSecreto } from "./secreto";
import { SesionesUsuario } from "./sesiones";
import type { Usuario } from "./tipos";

dayjs.extend(relativeTime);

type Modo = "OFF" | "LOG" | "ENFORCE";

interface Respuesta {
  seguridad: {
    accesoEmpresa: Modo;
    expiracionSesion: Modo;
    inactividadMinutos: number;
    duracionMaximaHoras: number;
  };
  usuarios: Usuario[];
}

const MODOS: Record<Modo, { color: string; texto: string }> = {
  OFF: { color: "red", texto: "desactivado" },
  LOG: { color: "orange", texto: "solo registra (no bloquea)" },
  ENFORCE: { color: "green", texto: "bloquea" },
};

/** Fechas de la API "yyyy-MM-dd HH:mm:ss z" -> dayjs (sin la zona) */
const fecha = (v?: string | null) => (v ? dayjs(v.slice(0, 19)) : undefined);
const ultimoUso = (u: Usuario) =>
  fecha(u.sesiones.ultima?.ultimoAcceso) ?? fecha(u.sesiones.ultima?.creada);

/**
 * Usuarios de la API (solo lectura, solo ADMIN): rol, empresas a las que tienen acceso, sesiones y modos de seguridad.
 * Sirve para revisar quién vería qué antes de pasar seguridad.accesoEmpresa / sesion.expiracion a enforce.
 */
export function Usuarios() {
  const [datos, setDatos] = useState<Respuesta>();
  const [error, setError] = useState<{
    message?: string;
    statusCode?: number;
  }>();
  const [texto, setTexto] = useState("");
  const [rol, setRol] = useState<string>();
  const [estado, setEstado] = useState<"activos" | "desactivados">();
  const [miId, setMiId] = useState<number>();
  // Formulario: undefined = cerrado, null = alta, usuario = edicion
  const [formulario, setFormulario] = useState<Usuario | null>();
  const [creado, setCreado] = useState<{ email: string; password: string }>();

  const cargar = useCallback(() => {
    apiJson<Respuesta>("GET", "/usuarios").then(setDatos).catch(setError);
  }, []);

  useEffect(() => {
    cargar();
    cuentaActual().then((c) => setMiId(c?.id));
  }, [cargar]);

  const usuarios = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return (datos?.usuarios ?? [])
      .filter(
        (u) =>
          (!rol || u.role === rol) &&
          (!estado || (estado === "activos") === (u.activo !== false)) &&
          (!t ||
            [u.emailAddress, u.firstName, u.lastName]
              .filter(Boolean)
              .some((x) => x!.toLowerCase().includes(t))),
      )
      .sort(
        (a, b) =>
          (ultimoUso(b)?.valueOf() ?? 0) - (ultimoUso(a)?.valueOf() ?? 0),
      );
  }, [datos, texto, rol, estado]);

  if (error)
    return (
      <List title="Usuarios">
        <Alert
          type="error"
          showIcon
          message="No se pudieron obtener los usuarios"
          description={
            error.statusCode === 404
              ? "La API no tiene el endpoint GET /usuarios (requiere una versión más nueva de java_efactura_uy)."
              : error.statusCode === 403
                ? "Solo los administradores pueden ver los usuarios."
                : error.message
          }
        />
      </List>
    );

  const seg = datos?.seguridad;
  const todos = datos?.usuarios ?? [];
  const sinEmpresas = todos.filter(
    (u) => !u.accesoTotal && u.empresas.length === 0,
  );
  const conVencidas = todos.filter((u) => u.sesiones.vencidas > 0);

  return (
    <List
      title="Usuarios"
      headerButtons={
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={() => setFormulario(null)}
        >
          Nuevo usuario
        </Button>
      }
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title="Seguridad"
            loading={!datos}
            style={{ height: "100%" }}
          >
            {seg && (
              <Space direction="vertical" size={8}>
                <span>
                  Acceso a empresas:{" "}
                  <Tag color={MODOS[seg.accesoEmpresa].color}>
                    {seg.accesoEmpresa} – {MODOS[seg.accesoEmpresa].texto}
                  </Tag>
                </span>
                <span>
                  Expiración de sesiones:{" "}
                  <Tag color={MODOS[seg.expiracionSesion].color}>
                    {seg.expiracionSesion} – {MODOS[seg.expiracionSesion].texto}
                  </Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {seg.inactividadMinutos / 60} h de inactividad o{" "}
                    {seg.duracionMaximaHoras / 24} días desde el login
                  </Typography.Text>
                </span>
                {seg.accesoEmpresa !== "ENFORCE" && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Mientras el acceso a empresas no sea ENFORCE, un USER puede
                    ver todas las empresas. Revisar abajo los usuarios sin
                    empresas asignadas antes de activarlo.
                  </Typography.Text>
                )}
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" loading={!datos} style={{ height: "100%" }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Usuarios" value={todos.length} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Administradores"
                  value={todos.filter((u) => u.role === "ADMIN").length}
                />
              </Col>
              <Col span={6}>
                <Tooltip title="USER sin empresas asignadas: con acceso en ENFORCE no verían ninguna">
                  <Statistic title="Sin empresas" value={sinEmpresas.length} />
                </Tooltip>
              </Col>
              <Col span={6}>
                <Tooltip title="Con sesiones que las reglas de expiración ya consideran vencidas (en ENFORCE se rechazarían)">
                  <Statistic
                    title="Con sesiones vencidas"
                    value={conVencidas.length}
                  />
                </Tooltip>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="Email o nombre"
          style={{ width: 260 }}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Select
          allowClear
          placeholder="Rol"
          style={{ width: 160 }}
          value={rol}
          onChange={setRol}
          options={[
            { value: "ADMIN", label: "Administrador" },
            { value: "USER", label: "Usuario" },
          ]}
        />
        <Select
          allowClear
          placeholder="Estado"
          style={{ width: 160 }}
          value={estado}
          onChange={setEstado}
          options={[
            { value: "activos", label: "Activos" },
            { value: "desactivados", label: "Desactivados" },
          ]}
        />
        <Typography.Text type="secondary">
          {usuarios.length} de {todos.length}
        </Typography.Text>
      </Space>

      <Table<Usuario>
        dataSource={usuarios}
        rowKey="id"
        size="middle"
        loading={!datos}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: true }}
        onRow={(u) => ({
          style: u.activo === false ? { opacity: 0.55 } : undefined,
        })}
        expandable={{
          // Las sesiones se piden al expandir la fila
          expandedRowRender: (u) => <SesionesUsuario uid={u.id} />,
          rowExpandable: (u) => u.sesiones.total > 0,
        }}
      >
        <Table.Column<Usuario>
          title="Usuario"
          render={(_, u) => (
            <div>
              <div>
                {[u.firstName, u.lastName].filter(Boolean).join(" ") || "-"}
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {u.emailAddress}
              </Typography.Text>
              {(u.activo === false || u.debeCambiarPassword) && (
                <div style={{ marginTop: 2 }}>
                  {u.activo === false && <Tag>Desactivado</Tag>}
                  {u.debeCambiarPassword && (
                    <Tooltip title="Todavía no cambió la contraseña temporal">
                      <Tag color="gold">Contraseña temporal</Tag>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          )}
        />
        <Table.Column<Usuario>
          title="Rol"
          render={(_, u) =>
            u.role === "ADMIN" ? (
              <Tag color="purple">Administrador</Tag>
            ) : (
              <Tag>Usuario</Tag>
            )
          }
        />
        <Table.Column<Usuario>
          title="Empresas"
          render={(_, u) =>
            u.accesoTotal ? (
              <Typography.Text type="secondary">
                Todas (por rol)
              </Typography.Text>
            ) : u.empresas.length === 0 ? (
              <Tooltip title="Con acceso a empresas en ENFORCE no vería ninguna">
                <Tag color="orange">Ninguna asignada</Tag>
              </Tooltip>
            ) : (
              <Space size={[4, 4]} wrap>
                {u.empresas.map((e) => (
                  <Link key={e.rut} to={`/empresas/show/${e.rut}?tab=usuarios`}>
                    <Tag color="blue">{e.razon ?? e.rut}</Tag>
                  </Link>
                ))}
              </Space>
            )
          }
        />
        <Table.Column<Usuario>
          title="Último acceso"
          render={(_, u) => {
            const s = u.sesiones.ultima;
            const uso = ultimoUso(u);
            if (!s || !uso)
              return (
                <Typography.Text type="secondary">
                  Nunca inició sesión
                </Typography.Text>
              );
            return (
              <Tooltip
                title={
                  <>
                    <div>{formatFechaApi(s.ultimoAcceso ?? s.creada)}</div>
                    <div>Login: {formatFechaApi(s.creada)}</div>
                    {s.userAgent && (
                      <div style={{ fontSize: 11, opacity: 0.8 }}>
                        {s.userAgent}
                      </div>
                    )}
                  </>
                }
              >
                <div style={{ whiteSpace: "nowrap" }}>
                  {uso.fromNow()}
                  {!s.vigente && (
                    <Tag style={{ marginLeft: 6 }} color="default">
                      vencida
                    </Tag>
                  )}
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {[s.ip, s.userAgent && navegador(s.userAgent)]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography.Text>
              </Tooltip>
            );
          }}
        />
        <Table.Column<Usuario>
          title="Sesiones"
          align="right"
          render={(_, u) => (
            <Tooltip
              title={`${u.sesiones.vigentes} vigentes, ${u.sesiones.vencidas} vencidas según las reglas de expiración, ${u.sesiones.total} en total (incluye cerradas)`}
            >
              <span style={{ whiteSpace: "nowrap" }}>
                {u.sesiones.vigentes}
                {u.sesiones.vencidas > 0 && (
                  <Typography.Text type="secondary">
                    {" "}
                    / {u.sesiones.vencidas} venc.
                  </Typography.Text>
                )}
              </span>
            </Tooltip>
          )}
        />
        <Table.Column<Usuario>
          title="Alta"
          render={(_, u) =>
            u.creado ? formatFechaApi(u.creado).slice(0, 10) : "-"
          }
        />
        <Table.Column<Usuario>
          title=""
          render={(_, u) => (
            <AccionesUsuario
              usuario={u}
              esYo={u.id === miId}
              onEditar={() => setFormulario(u)}
              onCambio={cargar}
            />
          )}
        />
      </Table>
      {formulario !== undefined && (
        <FormularioUsuario
          usuario={formulario ?? undefined}
          esYo={!!formulario && formulario.id === miId}
          onCerrar={() => setFormulario(undefined)}
          onGuardado={cargar}
          onCreado={(email, password) => setCreado({ email, password })}
        />
      )}
      {creado && (
        <MostrarSecreto
          titulo={`Usuario ${creado.email} creado`}
          valores={[{ label: "Contraseña temporal", valor: creado.password }]}
          aviso="Pasásela al usuario por un medio seguro. Al ingresar va a tener que cambiarla."
          onCerrar={() => setCreado(undefined)}
        />
      )}
    </List>
  );
}
