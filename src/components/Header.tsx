import { LogoutOutlined } from "@ant-design/icons";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Button, Layout, Select, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { useEmpresa } from "../contexts/empresa";

export function Header() {
  const { opciones, empresa, setRut, buscar, loading } = useEmpresa();
  const { data: identity } = useGetIdentity<{ name: string }>();
  const { mutate: logout } = useLogout();
  const [texto, setTexto] = useState("");

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
        background: "#fff",
        borderBottom: "1px solid #f0f0f0",
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
      </Space>
      <Space>
        <Typography.Text>{identity?.name}</Typography.Text>
        <Button icon={<LogoutOutlined />} onClick={() => logout()}>
          Salir
        </Button>
      </Space>
    </Layout.Header>
  );
}
