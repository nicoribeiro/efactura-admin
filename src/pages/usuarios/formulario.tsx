import { Alert, Button, Drawer, Form, Input, Select, Space } from "antd";
import { useEffect, useState } from "react";
import { usuariosApi } from "./api";
import { SelectorEmpresa } from "./selectorEmpresa";
import type { Usuario } from "./tipos";

interface Valores {
  emailAddress: string;
  firstName: string;
  lastName?: string;
  role: "ADMIN" | "USER";
  empresas?: string[];
}

/**
 * Alta (sin usuario) o edición de un usuario. Al crear, la API genera una contraseña temporal que se devuelve en
 * onCreado (para mostrarla una sola vez). Las empresas se eligen al crear; después se administran aparte.
 */
export function FormularioUsuario({
  usuario,
  esYo,
  onCerrar,
  onGuardado,
  onCreado,
}: {
  usuario?: Usuario;
  esYo?: boolean;
  onCerrar: () => void;
  onGuardado: () => void;
  onCreado: (email: string, passwordTemporal: string) => void;
}) {
  const [form] = Form.useForm<Valores>();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string>();
  const editando = !!usuario;
  const rol = Form.useWatch("role", form);

  useEffect(() => {
    form.setFieldsValue(
      usuario
        ? {
            emailAddress: usuario.emailAddress,
            firstName: usuario.firstName ?? "",
            lastName: usuario.lastName ?? "",
            role: usuario.role,
          }
        : { role: "USER", empresas: [] },
    );
  }, [usuario, form]);

  const guardar = async (v: Valores) => {
    setGuardando(true);
    setError(undefined);
    try {
      if (usuario) {
        await usuariosApi.editar(usuario.id, {
          emailAddress: v.emailAddress.trim(),
          firstName: v.firstName.trim(),
          lastName: v.lastName?.trim() || null,
          role: v.role,
        });
        onGuardado();
      } else {
        const r = await usuariosApi.crear({
          emailAddress: v.emailAddress.trim(),
          firstName: v.firstName.trim(),
          lastName: v.lastName?.trim(),
          role: v.role,
          empresas: v.role === "ADMIN" ? [] : (v.empresas ?? []),
        });
        onGuardado();
        onCreado(v.emailAddress.trim(), r.passwordTemporal);
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Drawer
      open
      width={460}
      title={editando ? `Editar ${usuario!.emailAddress}` : "Nuevo usuario"}
      onClose={onCerrar}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button
            type="primary"
            loading={guardando}
            onClick={() => form.submit()}
          >
            {editando ? "Guardar" : "Crear"}
          </Button>
        </Space>
      }
    >
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form<Valores>
        form={form}
        layout="vertical"
        onFinish={guardar}
        requiredMark="optional"
      >
        <Form.Item
          name="emailAddress"
          label="Email"
          rules={[
            { required: true, message: "Ingresá el email" },
            { type: "email", message: "Email inválido" },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="firstName"
          label="Nombre"
          rules={[{ required: true, message: "Ingresá el nombre" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="lastName" label="Apellido">
          <Input />
        </Form.Item>
        <Form.Item
          name="role"
          label="Rol"
          extra={
            esYo
              ? "No podés quitarte el rol de administrador."
              : "Un administrador accede a todas las empresas y a la administración de usuarios."
          }
        >
          <Select
            disabled={esYo}
            options={[
              { value: "USER", label: "Usuario (solo sus empresas)" },
              { value: "ADMIN", label: "Administrador" },
            ]}
          />
        </Form.Item>
        {!editando && rol !== "ADMIN" && (
          <Form.Item
            name="empresas"
            label="Empresas"
            extra="Las empresas a las que va a tener acceso."
          >
            <SelectorEmpresa mode="multiple" />
          </Form.Item>
        )}
        {!editando && (
          <Alert
            type="info"
            showIcon
            message="La contraseña la genera el sistema"
            description="Al crear el usuario se muestra una contraseña temporal (una sola vez) para que se la pases. Al ingresar, va a tener que cambiarla."
          />
        )}
      </Form>
    </Drawer>
  );
}
