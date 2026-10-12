import { DesktopOutlined, LogoutOutlined, MoonOutlined, SunOutlined, WarningOutlined } from "@ant-design/icons";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Button, Layout, Segmented, Select, Space, Tag, Tooltip, Typography, theme } from "antd";
import { useEffect, useState } from "react";
import { estadoFirma, formatFechaCorta } from "../constants/firma";
import { useEmpresa } from "../contexts/empresa";
import { BuscarComprobante } from "./BuscarComprobante";
import { useTema, type ModoTema } from "../contexts/tema";

export function Header() {
  const { opciones, empresa, setRut, buscar, loading } = useEmpresa();
  const { data: identity } = useGetIdentity<{ name: string }>();
  const { mutate: logout } = useLogout();
  const [texto, setTexto] = useState("");
  const { modo, setModo } = useTema();
  const { token } = theme.useToken();

  // Busqueda en el servidor con un pequeño retardo para no consultar en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => buscar(texto), 300);
    return () => clearTimeout(timer);
  }, [texto, buscar]);

  return (
    <Layout.Header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Space>
        <Typography.Text type="secondary">Empresa</Typography.Text>
        <Select
          style={{ minWidth: 360 }}
          loading={loading}
          value={empresa?.rut}
          onChange={(rut: string) => {
            setTexto("");
            setRut(rut);
          }}
          showSearch
          filterOption={false}
          onSearch={setTexto}
          placeholder="Buscar por RUT o razón social"
          notFoundContent={loading ? "Buscando..." : "Sin resultados"}
          options={opciones.map((e) => ({ value: e.rut, label: `${e.rut} - ${e.razon ?? e.nombreComercial ?? ""}` }))}
        />
        {empresa && estadoFirma(empresa.firmaDigital).alerta && (
          <Tooltip title={`Firma digital válida hasta ${formatFechaCorta(empresa.firmaDigital?.validaHasta)}`}>
            <Tag color={estadoFirma(empresa.firmaDigital).color}>
              <WarningOutlined /> Firma: {estadoFirma(empresa.firmaDigital).label}
            </Tag>
          </Tooltip>
        )}
      </Space>
      <Space>
        <BuscarComprobante />
        <Segmented<ModoTema>
          value={modo}
          onChange={setModo}
          options={[
            { value: "claro", icon: <Tooltip title="Tema claro"><SunOutlined /></Tooltip> },
            { value: "oscuro", icon: <Tooltip title="Tema oscuro"><MoonOutlined /></Tooltip> },
            { value: "sistema", icon: <Tooltip title="Según el sistema"><DesktopOutlined /></Tooltip> },
          ]}
        />
        <Typography.Text>{identity?.name}</Typography.Text>
        <Button icon={<LogoutOutlined />} onClick={() => logout()}>
          Salir
        </Button>
      </Space>
    </Layout.Header>
  );
}
