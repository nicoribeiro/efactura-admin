import {
  DownOutlined,
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  LogoutOutlined,
  ShopOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Dropdown,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
  type MenuProps,
} from "antd";
import { useEffect, useState } from "react";
import { usuariosApi } from "./api";
import { EmpresasUsuario } from "./empresasUsuario";
import { MostrarSecreto } from "./secreto";
import type { Usuario } from "./tipos";

type Secreto = {
  titulo: string;
  valores: { label: string; valor: string }[];
  aviso: string;
};

/** Credencial HMAC: se ve la key; el secret solo al regenerarla */
function CredencialesUsuario({
  usuario,
  onCerrar,
  onSecreto,
}: {
  usuario: Usuario;
  onCerrar: () => void;
  onSecreto: (s: Secreto) => void;
}) {
  const { modal, message } = App.useApp();
  const [datos, setDatos] = useState<{ key: string | null; valida: boolean }>();

  useEffect(() => {
    usuariosApi
      .verCredenciales(usuario.id)
      .then(setDatos)
      .catch((e: Error) => message.error(e.message));
  }, [usuario.id, message]);

  const regenerar = () =>
    modal.confirm({
      title: "¿Regenerar las credenciales HMAC?",
      content:
        "La key y el secret actuales dejan de funcionar de inmediato: cualquier integración que los use (scripts, otros sistemas) va a fallar hasta que se actualice con los nuevos.",
      okText: "Regenerar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const r = await usuariosApi.regenerarCredenciales(usuario.id);
          onCerrar();
          onSecreto({
            titulo: `Credenciales HMAC de ${usuario.emailAddress}`,
            valores: [
              { label: "Key (ACCESS_KEY)", valor: r.key },
              { label: "Secret", valor: r.secret },
            ],
            aviso:
              "El secret no se vuelve a mostrar. Guardalo en la configuración de la integración que lo use.",
          });
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });

  return (
    <Modal
      open
      title={`Credenciales HMAC de ${usuario.emailAddress}`}
      onCancel={onCerrar}
      footer={null}
    >
      {!datos ? (
        <Spin />
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Para integraciones que llaman a la API firmando cada pedido
            (ACCESS_KEY / ACCESS_SIGNATURE). No vencen con la sesión. El secret
            solo se muestra al regenerarlas.
          </Typography.Paragraph>
          <div>
            <Typography.Text type="secondary">Key </Typography.Text>
            {datos.valida ? (
              <Tag color="green">Válida</Tag>
            ) : (
              <Tag>Revocada</Tag>
            )}
            <Typography.Paragraph
              code
              copyable={!!datos.key}
              style={{ wordBreak: "break-all", marginBottom: 0 }}
            >
              {datos.key ?? "Sin credenciales"}
            </Typography.Paragraph>
          </div>
          <Button danger icon={<KeyOutlined />} onClick={regenerar}>
            Regenerar key y secret
          </Button>
        </Space>
      )}
    </Modal>
  );
}

/** Acciones sobre un usuario (solo ADMIN). Cada cambio recarga el listado con onCambio */
export function AccionesUsuario({
  usuario,
  esYo,
  onEditar,
  onCambio,
}: {
  usuario: Usuario;
  esYo: boolean;
  onEditar: () => void;
  onCambio: () => void;
}) {
  const { modal, message } = App.useApp();
  const [abierto, setAbierto] = useState<"empresas" | "credenciales" | null>(
    null,
  );
  const [secreto, setSecreto] = useState<Secreto | null>(null);
  const activo = usuario.activo !== false;

  const confirmar = (
    titulo: string,
    contenido: string,
    okText: string,
    accion: () => Promise<void>,
    peligro = false,
  ) =>
    modal.confirm({
      title: titulo,
      content: contenido,
      okText,
      okButtonProps: { danger: peligro },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await accion();
          onCambio();
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });

  const items: MenuProps["items"] = [
    { key: "editar", icon: <EditOutlined />, label: "Editar datos y rol" },
    { key: "empresas", icon: <ShopOutlined />, label: "Empresas" },
    { type: "divider" },
    {
      key: "password",
      icon: <LockOutlined />,
      label: "Generar contraseña temporal",
    },
    { key: "sesiones", icon: <LogoutOutlined />, label: "Cerrar sesiones" },
    { key: "credenciales", icon: <KeyOutlined />, label: "Credenciales HMAC" },
    { type: "divider" },
    activo
      ? {
          key: "desactivar",
          icon: <StopOutlined />,
          label: "Desactivar",
          danger: true,
          disabled: esYo,
        }
      : { key: "activar", icon: <CheckCircleOutlined />, label: "Activar" },
  ];

  const onClick: MenuProps["onClick"] = ({ key }) => {
    switch (key) {
      case "editar":
        return onEditar();
      case "empresas":
      case "credenciales":
        return setAbierto(key);
      case "password":
        return confirmar(
          `¿Generar una contraseña temporal para ${usuario.emailAddress}?`,
          "La contraseña actual deja de funcionar y se cierran sus sesiones. Al ingresar con la temporal va a tener que cambiarla.",
          "Generar",
          async () => {
            const r = await usuariosApi.resetearPassword(usuario.id);
            setSecreto({
              titulo: `Contraseña temporal de ${usuario.emailAddress}`,
              valores: [
                { label: "Contraseña temporal", valor: r.passwordTemporal },
              ],
              aviso:
                "Pasásela al usuario por un medio seguro. Al ingresar va a tener que cambiarla.",
            });
          },
        );
      case "sesiones":
        return confirmar(
          `¿Cerrar las sesiones de ${usuario.emailAddress}?`,
          "Va a tener que volver a ingresar en todos los navegadores. Sus credenciales HMAC no se ven afectadas.",
          "Cerrar sesiones",
          async () => {
            const r = await usuariosApi.cerrarSesiones(usuario.id);
            message.success(`${r.cerradas} sesión(es) cerrada(s)`);
          },
        );
      case "desactivar":
        return confirmar(
          `¿Desactivar a ${usuario.emailAddress}?`,
          "No va a poder ingresar ni usar sus credenciales HMAC, y se cierran sus sesiones. Su historial se conserva y se puede volver a activar.",
          "Desactivar",
          async () => {
            await usuariosApi.cambiarActivo(usuario.id, false);
          },
          true,
        );
      case "activar":
        return confirmar(
          `¿Activar a ${usuario.emailAddress}?`,
          "Va a poder volver a ingresar con su contraseña.",
          "Activar",
          async () => {
            await usuariosApi.cambiarActivo(usuario.id, true);
          },
        );
    }
  };

  return (
    <>
      <Dropdown menu={{ items, onClick }} trigger={["click"]}>
        <Button size="small">
          Acciones <DownOutlined />
        </Button>
      </Dropdown>
      {abierto === "empresas" && (
        <EmpresasUsuario
          usuario={usuario}
          onCerrar={() => setAbierto(null)}
          onCambio={onCambio}
        />
      )}
      {abierto === "credenciales" && (
        <CredencialesUsuario
          usuario={usuario}
          onCerrar={() => setAbierto(null)}
          onSecreto={setSecreto}
        />
      )}
      {secreto && (
        <MostrarSecreto {...secreto} onCerrar={() => setSecreto(null)} />
      )}
    </>
  );
}
