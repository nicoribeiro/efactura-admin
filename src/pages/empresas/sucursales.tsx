import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useList } from "@refinedev/core";
import { Alert, App, Button, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { apiJson } from "../../api/http";
import { rolUsuario } from "../../providers/authProvider";
import { ordenar } from "../../utils/orden";

/** Formato de SucursalSerializer (claves con mayúscula como en el JSON de entrada de la API) */
interface Sucursal {
  id: number;
  CdgDGISucur?: number | null;
  DomFiscal?: string | null;
  Ciudad?: string | null;
  Departamento?: string | null;
  CodigoPostal?: string | null;
  Telefono?: string | null;
}

type Valores = Omit<Sucursal, "id">;

/** Alta o edicion de una sucursal (solo ADMIN). El codigo DGI solo se elige al crearla. */
function EditarSucursal({
  rut,
  sucursal,
  onCerrar,
  onGuardada,
}: {
  rut: string;
  /** undefined = nueva */
  sucursal?: Sucursal;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Valores>();
  const [guardando, setGuardando] = useState(false);
  const nueva = !sucursal;

  const guardar = async (valores: Valores) => {
    const body: Record<string, string | number> = {};
    for (const campo of ["DomFiscal", "Ciudad", "Departamento", "CodigoPostal", "Telefono"] as const)
      body[campo] = (valores[campo] ?? "").toString().trim();
    if (nueva) body.CdgDGISucur = Number(valores.CdgDGISucur);

    setGuardando(true);
    try {
      if (nueva) await apiJson("POST", `/empresa/${rut}/sucursales`, undefined, body);
      else await apiJson("PUT", `/empresa/${rut}/sucursales/${sucursal!.CdgDGISucur}`, undefined, body);
      message.success(nueva ? "Sucursal creada" : "Sucursal actualizada");
      onGuardada();
      onCerrar();
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      setGuardando(false);
    }
  };

  const requerido = [{ required: true, whitespace: true, message: "Requerido" }];

  return (
    <Modal
      open
      title={nueva ? "Nueva sucursal" : `Editar sucursal ${sucursal!.CdgDGISucur}`}
      okText="Guardar"
      cancelText="Cancelar"
      confirmLoading={guardando}
      onOk={() => form.submit()}
      onCancel={onCerrar}
      maskClosable={false}
      destroyOnHidden
    >
      <Form<Valores>
        form={form}
        layout="vertical"
        initialValues={sucursal ?? {}}
        onFinish={guardar}
        requiredMark={false}
      >
        <Form.Item
          name="CdgDGISucur"
          label="Código DGI de la sucursal"
          extra={nueva ? "El código con el que la sucursal está registrada en DGI." : undefined}
          rules={nueva ? [{ required: true, message: "Requerido" }] : undefined}
        >
          <InputNumber min={1} precision={0} disabled={!nueva} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="DomFiscal" label="Domicilio fiscal" rules={requerido}>
          <Input />
        </Form.Item>
        <Form.Item name="Ciudad" label="Ciudad" rules={requerido}>
          <Input />
        </Form.Item>
        <Form.Item name="Departamento" label="Departamento" rules={requerido}>
          <Input />
        </Form.Item>
        <Form.Item name="CodigoPostal" label="Código postal">
          <Input style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="Telefono" label="Teléfono">
          <Input style={{ width: 220 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** Sucursales de una empresa; un ADMIN puede agregarlas, editarlas y borrarlas (sin comprobantes, no la ultima) */
export function SucursalesTable({ rut }: { rut: string }) {
  const { result, query } = useList<Sucursal>({
    resource: "sucursales",
    meta: { rut },
    pagination: { mode: "off" },
  });
  const { message } = App.useApp();
  const [esAdmin, setEsAdmin] = useState(false);
  const [borrando, setBorrando] = useState<number>();
  // null = cerrado, undefined = nueva
  const [editando, setEditando] = useState<Sucursal | undefined | null>(null);

  useEffect(() => {
    rolUsuario().then((r) => setEsAdmin(r === "ADMIN"));
  }, []);

  if (query.isError)
    return <Alert type="error" showIcon message="No se pudieron obtener las sucursales" description={query.error?.message} />;

  const sucursales = [...(result?.data ?? [])].sort((a, b) => (a.CdgDGISucur ?? 0) - (b.CdgDGISucur ?? 0));

  // La API verifica que no tenga comprobantes y que no sea la ultima
  const borrar = async (s: Sucursal) => {
    setBorrando(s.id);
    try {
      await apiJson("DELETE", `/empresa/${rut}/sucursales/${s.CdgDGISucur}`);
      message.success(`Sucursal ${s.CdgDGISucur} borrada`);
      query.refetch();
    } catch (e) {
      message.error((e as { message?: string })?.message ?? "Error");
    } finally {
      setBorrando(undefined);
    }
  };

  return (
    <>
      {esAdmin && (
        <Button icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => setEditando(undefined)}>
          Agregar sucursal
        </Button>
      )}
      <Table<Sucursal> dataSource={sucursales} loading={query.isLoading} rowKey="id" size="middle" pagination={false}>
        <Table.Column<Sucursal> title="Código DGI" dataIndex="CdgDGISucur" sorter={ordenar<Sucursal>((s) => s.CdgDGISucur)} />
        <Table.Column<Sucursal> title="Domicilio fiscal" dataIndex="DomFiscal" sorter={ordenar<Sucursal>((s) => s.DomFiscal)} />
        <Table.Column<Sucursal> title="Ciudad" dataIndex="Ciudad" sorter={ordenar<Sucursal>((s) => s.Ciudad)} />
        <Table.Column<Sucursal> title="Departamento" dataIndex="Departamento" sorter={ordenar<Sucursal>((s) => s.Departamento)} />
        <Table.Column<Sucursal> title="Código postal" dataIndex="CodigoPostal" sorter={ordenar<Sucursal>((s) => s.CodigoPostal)} />
        <Table.Column<Sucursal> title="Teléfono" dataIndex="Telefono" sorter={ordenar<Sucursal>((s) => s.Telefono)} />
        {esAdmin && (
          <Table.Column<Sucursal>
            title=""
            render={(_, s) => (
              <Space size={4}>
                <Button size="small" onClick={() => setEditando(s)}>
                  Editar
                </Button>
                {sucursales.length > 1 ? (
                  <Popconfirm
                    title={`¿Borrar la sucursal ${s.CdgDGISucur}?`}
                    description="Solo se puede si no tiene comprobantes."
                    okText="Borrar"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancelar"
                    onConfirm={() => borrar(s)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} loading={borrando === s.id}>
                      Borrar
                    </Button>
                  </Popconfirm>
                ) : (
                  <Tooltip title="No se puede borrar la única sucursal">
                    <Button size="small" danger icon={<DeleteOutlined />} disabled>
                      Borrar
                    </Button>
                  </Tooltip>
                )}
              </Space>
            )}
          />
        )}
      </Table>
      {editando !== null && (
        <EditarSucursal
          rut={rut}
          sucursal={editando}
          onCerrar={() => setEditando(null)}
          onGuardada={() => query.refetch()}
        />
      )}
    </>
  );
}
