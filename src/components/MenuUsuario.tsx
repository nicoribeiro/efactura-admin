import {
  CheckOutlined,
  DesktopOutlined,
  LockOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { useGetIdentity, useLogout } from "@refinedev/core";
import {
  Avatar,
  Dropdown,
  Space,
  Tag,
  Typography,
  theme,
  type MenuProps,
} from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useTema, type ModoTema } from "../contexts/tema";
import { cuentaActual, type Cuenta } from "../providers/authProvider";

/** Iniciales para el avatar: nombre y apellido, o la primera letra del email */
const iniciales = (cuenta: Cuenta | null, email?: string) => {
  const partes = [cuenta?.firstName, cuenta?.lastName].filter(
    (p): p is string => !!p?.trim(),
  );
  if (partes.length > 0)
    return partes
      .map((p) => p.trim()[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return (email ?? "?")[0].toUpperCase();
};

const TEMAS: { modo: ModoTema; label: string; icon: ReactNode }[] = [
  { modo: "claro", label: "Claro", icon: <SunOutlined /> },
  { modo: "oscuro", label: "Oscuro", icon: <MoonOutlined /> },
  { modo: "sistema", label: "Según el sistema", icon: <DesktopOutlined /> },
];

/**
 * Usuario logueado en el encabezado: avatar con sus iniciales y un menú con sus datos, cambio de contraseña, tema y
 * salir.
 */
export function MenuUsuario() {
  const { data: identity } = useGetIdentity<{ name: string }>();
  const { mutate: logout } = useLogout();
  const navigate = useNavigate();
  const { modo, setModo } = useTema();
  const { token } = theme.useToken();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);

  useEffect(() => {
    cuentaActual().then(setCuenta);
  }, []);

  const email = cuenta?.emailAddress ?? identity?.name;
  const nombre = [cuenta?.firstName, cuenta?.lastName]
    .filter(Boolean)
    .join(" ");

  const items: MenuProps["items"] = [
    { key: "password", icon: <LockOutlined />, label: "Cambiar contraseña" },
    { type: "divider" },
    {
      type: "group",
      label: "Tema",
      children: TEMAS.map((t) => ({
        key: `tema-${t.modo}`,
        icon: t.icon,
        label: (
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            {t.label}
            {modo === t.modo && (
              <CheckOutlined style={{ color: token.colorPrimary }} />
            )}
          </Space>
        ),
      })),
    },
    { type: "divider" },
    { key: "salir", icon: <LogoutOutlined />, label: "Salir", danger: true },
  ];

  const onClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "password") navigate("/cambiar-password");
    else if (key === "salir") logout();
    else if (key.startsWith("tema-")) setModo(key.slice(5) as ModoTema);
  };

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      menu={{ items, onClick }}
      popupRender={(menu) => (
        <div
          style={{
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
            minWidth: 240,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${token.colorSplit}`,
            }}
          >
            {nombre && (
              <Typography.Text strong style={{ display: "block" }}>
                {nombre}
              </Typography.Text>
            )}
            <Typography.Text
              type="secondary"
              style={{ display: "block", fontSize: 12 }}
            >
              {email}
            </Typography.Text>
            {cuenta && (
              <Tag
                color={cuenta.role === "ADMIN" ? "purple" : undefined}
                style={{ marginTop: 6 }}
              >
                {cuenta.role === "ADMIN" ? "Administrador" : "Usuario"}
              </Tag>
            )}
          </div>
          {/* El menu sin su propia sombra ni fondo: los pone el contenedor */}
          <div style={{ boxShadow: "none" }}>{menu}</div>
        </div>
      )}
    >
      <Avatar
        size={32}
        style={{
          backgroundColor: token.colorPrimary,
          cursor: "pointer",
          flexShrink: 0,
        }}
        aria-label={`Usuario ${email ?? ""}: menú`}
      >
        {iniciales(cuenta, email)}
      </Avatar>
    </Dropdown>
  );
}
