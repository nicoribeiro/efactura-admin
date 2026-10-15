import { EditOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Show } from "@refinedev/antd";
import { useOne } from "@refinedev/core";
import { Button, Descriptions, Space, Tabs, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { estadoFirma, formatFechaCorta } from "../../constants/firma";
import type { Empresa } from "../../contexts/empresa";
import { CaeTable } from "./caes";
import { rolUsuario } from "../../providers/authProvider";
import { BotonRutDgi } from "../../components/RutDgi";
import { EditarEmpresa } from "./editarEmpresa";
import { EmailsTable } from "./emails";
import { CargarFirma } from "./firma";
import { LogoEmpresa } from "./logo";
import { SucursalesTable } from "./sucursales";
import { UsuariosTable } from "./usuarios";

/** Fecha yyyy-MM-dd de DGI como dd/MM/yyyy */
const fechaDgi = (v?: string | null) => (v ? v.split("-").reverse().join("/") : "-");

export function EmpresaShow() {
  const { id: rut = "" } = useParams();
  // La pestaña va en la URL (?tab=cae) para poder enlazarla desde el tablero
  const [params, setParams] = useSearchParams();
  const { result: empresa, query } = useOne<Empresa & { sucursales?: Record<string, unknown>[] }>({
    resource: "empresas",
    id: rut,
  });
  const [esAdmin, setEsAdmin] = useState(false);
  const [editando, setEditando] = useState(false);
  const [cargandoFirma, setCargandoFirma] = useState(false);

  useEffect(() => {
    rolUsuario().then((r) => setEsAdmin(r === "ADMIN"));
  }, []);

  return (
    <Show isLoading={query.isLoading} title={empresa ? `${empresa.rut} - ${empresa.razon ?? ""}` : "Empresa"}>
      {empresa && (
        <Tabs
          activeKey={params.get("tab") ?? "datos"}
          onChange={(tab) => setParams({ tab }, { replace: true })}
          items={[
            {
              key: "datos",
              label: "Datos",
              children: (
                <>
                <Space style={{ marginBottom: 16 }} wrap>
                  <BotonRutDgi rut={empresa.rut} texto="Datos en DGI" size="middle" />
                  {esAdmin && (
                    <>
                      <Button icon={<EditOutlined />} onClick={() => setEditando(true)}>
                        Editar datos
                      </Button>
                      <Button icon={<SafetyCertificateOutlined />} onClick={() => setCargandoFirma(true)}>
                        Cargar firma digital
                      </Button>
                    </>
                  )}
                </Space>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="RUT">{empresa.rut}</Descriptions.Item>
                  <Descriptions.Item label="Razón social">{empresa.razon}</Descriptions.Item>
                  <Descriptions.Item label="Nombre comercial">{empresa.nombreComercial}</Descriptions.Item>
                  <Descriptions.Item label="Emisor electrónico">
                    {empresa.emisorElectronico ? <Tag color="green">Sí</Tag> : <Tag>No</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Estado">
                    {empresa.activa === false ? <Tag color="red">Dada de baja</Tag> : <Tag color="green">Activa</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Resolución">{empresa.resolucion}</Descriptions.Item>
                  <Descriptions.Item label="Página web">{empresa.paginaWeb}</Descriptions.Item>
                  <Descriptions.Item label="Mail recepción">{empresa.mailRecepcion}</Descriptions.Item>
                  <Descriptions.Item label="Mail notificaciones">{empresa.mailNotificaciones}</Descriptions.Item>
                  <Descriptions.Item label="Servidor IMAP">
                    {empresa.hostRecepcion ? `${empresa.hostRecepcion}:${empresa.puertoRecepcion ?? ""}` : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Usuario IMAP">{empresa.userRecepcion}</Descriptions.Item>
                  <Descriptions.Item label="Remitente de envíos" span={2}>
                    {empresa.fromEnvio}
                  </Descriptions.Item>
                  <Descriptions.Item label="Firma digital">
                    <Tag color={estadoFirma(empresa.firmaDigital).color}>{estadoFirma(empresa.firmaDigital).label}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Validez de la firma">
                    {empresa.firmaDigital
                      ? `${formatFechaCorta(empresa.firmaDigital.validaDesde)} al ${formatFechaCorta(empresa.firmaDigital.validaHasta)}`
                      : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Logo (PDF)" span={2}>
                    <LogoEmpresa
                      rut={empresa.rut}
                      tieneLogo={empresa.tieneLogo}
                      esAdmin={esAdmin}
                      onCambiado={() => query.refetch()}
                    />
                  </Descriptions.Item>
                </Descriptions>
                <Descriptions
                  bordered
                  size="small"
                  column={2}
                  style={{ marginTop: 16 }}
                  title="Emisor electrónico según DGI"
                  extra={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Lo guarda la sincronización de emisores electrónicos
                    </Typography.Text>
                  }
                >
                  <Descriptions.Item label="Inicio">{fechaDgi(empresa.fechaInicioEmisorDgi)}</Descriptions.Item>
                  <Descriptions.Item label="Fin">{fechaDgi(empresa.fechaFinEmisorDgi)}</Descriptions.Item>
                  <Descriptions.Item label="Fin de la transición">{fechaDgi(empresa.fechaFinTransicionDgi)}</Descriptions.Item>
                  <Descriptions.Item label="Contacto técnico">{empresa.mailContactoTecnicoDgi ?? "-"}</Descriptions.Item>
                  <Descriptions.Item label="Web service" span={2}>
                    {empresa.urlWebserviceDgi ?? "-"}
                  </Descriptions.Item>
                </Descriptions>
                {editando && (
                  <EditarEmpresa empresa={empresa} onCerrar={() => setEditando(false)} onGuardada={() => query.refetch()} />
                )}
                {cargandoFirma && (
                  <CargarFirma
                    rut={empresa.rut}
                    onCerrar={() => setCargandoFirma(false)}
                    onCargada={() => query.refetch()}
                  />
                )}
                </>
              ),
            },
            {
              key: "sucursales",
              label: "Sucursales",
              children: <SucursalesTable rut={empresa.rut} />,
            },
            {
              key: "cae",
              label: "CAE",
              children: <CaeTable rut={empresa.rut} />,
            },
            {
              key: "emails",
              label: "Emails recibidos",
              children: <EmailsTable rut={empresa.rut} />,
            },
            {
              key: "usuarios",
              label: "Usuarios",
              children: <UsuariosTable rut={empresa.rut} />,
            },
          ]}
        />
      )}
    </Show>
  );
}
