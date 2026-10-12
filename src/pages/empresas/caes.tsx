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
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../api/http";
import { formatFechaDia, tipoDocByName } from "../../constants/cfe";
import {
  DIAS_RITMO,
  emitidosPorTipo,
  estadoCAE,
  pronosticoCAE,
  rangoRitmo,
  type CAE,
  type EstadoCAE,
} from "../../utils/cae";
import { PronosticoCaeTable } from "./pronosticoCae";

const ESTADOS: EstadoCAE[] = ["Vigente", "Vencido", "Agotado", "Anulado"];

interface Filtros {
  tipos: string[];
  estados: EstadoCAE[];
  serie: string;
}

const SIN_FILTROS: Filtros = { tipos: [], estados: [], serie: "" };

/** CAEs de una empresa (solo lectura) */
export function CaeTable({ rut }: { rut: string }) {
  const { result, query } = useList<CAE>({
    resource: "caes",
    meta: { rut },
    pagination: { mode: "off" },
  });

  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const caes = useMemo(() => result?.data ?? [], [result]);

  // Ritmo de emision por tipo, para estimar cuando hace falta un CAE nuevo
  const [emitidos, setEmitidos] = useState<Map<number, number>>();
  const [errorRitmo, setErrorRitmo] = useState<string>();
  useEffect(() => {
    let cancelado = false;
    apiJson<{ emitidos: { idTipoDoc: number; cantidad: number }[] }>(
      "GET",
      `/empresa/${rut}/documentos/resumen`,
      rangoRitmo(),
    )
      .then((r) => !cancelado && setEmitidos(emitidosPorTipo(r.emitidos ?? [])))
      .catch((e: Error) => !cancelado && setErrorRitmo(e.message));
    return () => {
      cancelado = true;
    };
  }, [rut]);
  const pronostico = useMemo(
    () => (emitidos ? pronosticoCAE(caes, emitidos) : []),
    [caes, emitidos],
  );

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
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Por tipo de documento
      </Typography.Title>
      {errorRitmo ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`No se pudo calcular el ritmo de emisión de los últimos ${DIAS_RITMO} días`}
          description={errorRitmo}
        />
      ) : (
        <div style={{ marginBottom: 24 }}>
          <PronosticoCaeTable
            filas={pronostico}
            loading={query.isLoading || !emitidos}
          />
        </div>
      )}

      <Typography.Title level={5}>Todos los CAE</Typography.Title>
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
          render={formatFechaDia}
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
