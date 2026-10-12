import {
  Alert,
  App,
  Button,
  Empty,
  List,
  Modal,
  Popconfirm,
  Space,
  Typography,
} from "antd";
import { useState } from "react";
import { usuariosApi } from "./api";
import { SelectorEmpresa } from "./selectorEmpresa";
import type { Usuario } from "./tipos";

/** Empresas a las que tiene acceso un usuario: agregar y quitar (los ADMIN acceden a todas por su rol) */
export function EmpresasUsuario({
  usuario,
  onCerrar,
  onCambio,
}: {
  usuario: Usuario;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const { message } = App.useApp();
  const [empresas, setEmpresas] = useState(usuario.empresas);
  const [nueva, setNueva] = useState<string>();
  const [trabajando, setTrabajando] = useState(false);

  const agregar = async () => {
    if (!nueva) return;
    setTrabajando(true);
    try {
      await usuariosApi.agregarEmpresa(usuario.id, nueva);
      if (!empresas.some((e) => e.rut === nueva))
        setEmpresas([...empresas, { rut: nueva }]);
      setNueva(undefined);
      onCambio();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  };

  const quitar = async (rut: string) => {
    try {
      await usuariosApi.quitarEmpresa(usuario.id, rut);
      setEmpresas(empresas.filter((e) => e.rut !== rut));
      onCambio();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Modal
      open
      title={`Empresas de ${usuario.emailAddress}`}
      onCancel={onCerrar}
      footer={null}
      width={560}
    >
      {usuario.role === "ADMIN" ? (
        <Alert
          type="info"
          showIcon
          message="Es administrador: accede a todas las empresas por su rol."
        />
      ) : (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space.Compact style={{ width: "100%" }}>
            <SelectorEmpresa
              style={{ width: "100%" }}
              value={nueva}
              onChange={(v) => setNueva(v as string)}
            />
            <Button
              type="primary"
              onClick={agregar}
              loading={trabajando}
              disabled={!nueva}
            >
              Agregar
            </Button>
          </Space.Compact>
          {empresas.length === 0 ? (
            <Empty description="Sin empresas asignadas" />
          ) : (
            <List
              size="small"
              bordered
              dataSource={empresas}
              renderItem={(e) => (
                <List.Item
                  actions={[
                    <Popconfirm
                      key="quitar"
                      title="¿Quitar el acceso a esta empresa?"
                      okText="Quitar"
                      cancelText="Cancelar"
                      onConfirm={() => quitar(e.rut)}
                    >
                      <Button size="small" danger type="link">
                        Quitar
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <Typography.Text>
                    {e.razon ? `${e.rut} - ${e.razon}` : e.rut}
                  </Typography.Text>
                </List.Item>
              )}
            />
          )}
        </Space>
      )}
    </Modal>
  );
}
