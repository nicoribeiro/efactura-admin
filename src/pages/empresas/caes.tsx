import { useList } from "@refinedev/core";
import {
  Alert,
  Button,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import { formatFechaApi, tipoDocByName } from "../../constants/cfe";

interface CAE {
  id: number;
  tipo?: string;
  idTipoDoc?: number;
  nro: number;
  serie: string;
  inicial: number;
  fin: number;
  siguiente: number;
  fechaVencimiento?: string | null;
  fechaAnulado?: string | null;
  total: number;
  usados: number;
  disponibles: number;
  porcentajeUso: number;
}

type EstadoCAE = "Vigente" | "Vencido" | "Agotado" | "Anulado";
type Estado = { label: EstadoCAE; color: string };

const ESTADOS: EstadoCAE[] = ["Vigente", "Vencido", "Agotado", "Anulado"];

interface Filtros {
  tipos: string[];
  estados: EstadoCAE[];
  serie: string;
}

const SIN_FILTROS: Filtros = { tipos: [], estados: [], serie: "" };

/** Fechas de la API: "yyyy-MM-dd HH:mm:ss z" */
const parseFecha = (value?: string | null) =>
  value ? new Date(value.slice(0, 10) + "T23:59:59") : undefined;

function estadoCAE(cae: CAE): Estado {
  if (cae.fechaAnulado) return { label: "Anulado", color: "default" };
  const vence = parseFecha(cae.fechaVencimiento);
  if (vence && vence < new Date()) return { label: "Vencido", color: "red" };
  if (cae.disponibles <= 0) return { label: "Agotado", color: "red" };
  return { label: "Vigente", color: "green" };
}

/** CAEs de una empresa (solo lectura) */
export function CaeTable({ rut }: { rut: string }) {
  const { result, query } = useList<CAE>({
    resource: "caes",
    meta: { rut },
    pagination: { mode: "off" },
  });

  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const caes = useMemo(() => result?.data ?? [], [result]);

  // Solo se ofrecen los tipos que la empresa tiene
  const tiposDisponibles = useMemo(
    () => [...new Set(caes.map((c) => c.tipo).filter((t): t is string => !!t))],
    [caes],
  );

  const filtrados = useMemo(
    () =>
      caes.filter(
        (cae) =>
          (filtros.tipos.length === 0 ||
            (cae.tipo && filtros.tipos.includes(cae.tipo))) &&
          (filtros.estados.length === 0 ||
            filtros.estados.includes(estadoCAE(cae).label)) &&
          (!filtros.serie ||
            cae.serie
              ?.toUpperCase()
              .includes(filtros.serie.trim().toUpperCase())),
      ),
    [caes, filtros],
  );

  const hayFiltros =
    filtros.tipos.length > 0 || filtros.estados.length > 0 || !!filtros.serie;

  if (query.isError)
    return (
      <Alert
        type="error"
        showIcon
        message="No se pudieron obtener los CAE"
        description={
          query.error?.statusCode === 404
            ? "La API no tiene el endpoint GET /empresa/:rut/cae (requiere una versión más nueva de java_efactura_uy)."
            : query.error?.message
        }
      />
    );

  return (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          mode="multiple"
          allowClear
          placeholder="Tipo de documento"
          style={{ minWidth: 260 }}
          value={filtros.tipos}
          onChange={(tipos: string[]) => setFiltros({ ...filtros, tipos })}
          options={tiposDisponibles.map((tipo) => {
            const t = tipoDocByName(tipo);
            return { value: tipo, label: t ? `${t.id} - ${t.label}` : tipo };
          })}
        />
        <Select
          mode="multiple"
          allowClear
          placeholder="Estado"
          style={{ minWidth: 200 }}
          value={filtros.estados}
          onChange={(estados: EstadoCAE[]) =>
            setFiltros({ ...filtros, estados })
          }
          options={ESTADOS.map((estado) => ({ value: estado, label: estado }))}
        />
        <Input
          allowClear
          placeholder="Serie"
          style={{ width: 100 }}
          value={filtros.serie}
          onChange={(e) => setFiltros({ ...filtros, serie: e.target.value })}
        />
        <Button onClick={() => setFiltros(SIN_FILTROS)} disabled={!hayFiltros}>
          Limpiar
        </Button>
        <Typography.Text type="secondary">
          {filtrados.length} de {caes.length} CAE
        </Typography.Text>
      </Space>

      <Table<CAE>
        dataSource={filtrados}
        loading={query.isLoading}
        rowKey="id"
        size="middle"
        pagination={false}
      >
        <Table.Column<CAE>
          title="Tipo"
          dataIndex="tipo"
          render={(tipo?: string) => {
            const t = tipoDocByName(tipo);
            return t ? `${t.id} - ${t.label}` : (tipo ?? "-");
          }}
        />
        <Table.Column<CAE> title="Nro. CAE" dataIndex="nro" />
        <Table.Column<CAE> title="Serie" dataIndex="serie" />
        <Table.Column<CAE>
          title="Rango"
          render={(_, cae) => `${cae.inicial} - ${cae.fin}`}
        />
        <Table.Column<CAE> title="Siguiente" dataIndex="siguiente" />
        <Table.Column<CAE>
          title="Uso"
          width={220}
          render={(_, cae) => (
            <Tooltip
              title={`${cae.usados} de ${cae.total} usados, ${cae.disponibles} disponibles`}
            >
              <Progress
                percent={cae.porcentajeUso}
                size="small"
                status={cae.porcentajeUso >= 90 ? "exception" : "normal"}
              />
            </Tooltip>
          )}
        />
        <Table.Column<CAE>
          title="Vencimiento"
          dataIndex="fechaVencimiento"
          render={formatFechaApi}
        />
        <Table.Column<CAE>
          title="Estado"
          render={(_, cae) => {
            const estado = estadoCAE(cae);
            return <Tag color={estado.color}>{estado.label}</Tag>;
          }}
        />
      </Table>
    </>
  );
}
