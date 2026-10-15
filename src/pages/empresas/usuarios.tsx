import { useList } from "@refinedev/core";
import { Alert, Table, Tag, Typography } from "antd";
import { ordenar } from "../../utils/orden";

const nombre = (u: { firstName?: string | null; lastName?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ");

interface UsuarioEmpresa {
  id: number;
  emailAddress: string;
  firstName?: string | null;
  lastName?: string | null;
  role: "ADMIN" | "USER";
  /** ADMIN: acceso a todas las empresas por su rol. PERMISO: asignado a esta empresa. */
  acceso: "ADMIN" | "PERMISO";
}

/** Usuarios con acceso a una empresa (solo lectura; la API lo permite solo a administradores) */
export function UsuariosTable({ rut }: { rut: string }) {
  const { result, query } = useList<UsuarioEmpresa>({
    resource: "usuarios",
    meta: { rut },
    pagination: { mode: "off" },
  });

  if (query.isError) {
    const status = query.error?.statusCode;
    return (
      <Alert
        type={status === 403 ? "info" : "error"}
        showIcon
        message={status === 403 ? "Solo los administradores pueden ver los usuarios de una empresa" : "No se pudieron obtener los usuarios"}
        description={
          status === 404
            ? "La API no tiene el endpoint GET /empresa/:rut/usuarios (requiere una versión más nueva de java_efactura_uy)."
            : status === 403
              ? undefined
              : query.error?.message
        }
      />
    );
  }

  const usuarios = [...(result?.data ?? [])].sort(
    (a, b) => a.acceso.localeCompare(b.acceso) || a.emailAddress.localeCompare(b.emailAddress),
  );

  return (
    <>
      <Table<UsuarioEmpresa> dataSource={usuarios} loading={query.isLoading} rowKey="id" size="middle" pagination={false}>
        <Table.Column<UsuarioEmpresa>
          title="Email"
          dataIndex="emailAddress"
          sorter={ordenar<UsuarioEmpresa>((u) => u.emailAddress)}
        />
        <Table.Column<UsuarioEmpresa>
          title="Nombre"
          render={(_, u) => nombre(u) || "-"}
          sorter={ordenar<UsuarioEmpresa>(nombre)}
        />
        <Table.Column<UsuarioEmpresa>
          title="Acceso"
          dataIndex="acceso"
          sorter={ordenar<UsuarioEmpresa>((u) => (u.acceso === "ADMIN" ? "Administrador (todas las empresas)" : "Asignado"))}
          render={(acceso: UsuarioEmpresa["acceso"]) =>
            acceso === "ADMIN" ? <Tag color="purple">Administrador (todas las empresas)</Tag> : <Tag color="blue">Asignado</Tag>
          }
        />
      </Table>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        La asignación se hace desde la API (solo administradores): PUT / DELETE /api/v1/users/:uid/empresas/{rut}
      </Typography.Paragraph>
    </>
  );
}
