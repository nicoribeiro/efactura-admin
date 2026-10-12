import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  InfoCircleFilled,
} from "@ant-design/icons";
import { List } from "@refinedev/antd";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { apiJson } from "../../api/http";
import { TIPOS_DOC, tipoDocByName } from "../../constants/cfe";
import { estadoFirma, formatFechaCorta } from "../../constants/firma";
import { useEmpresa } from "../../contexts/empresa";
import { useTema } from "../../contexts/tema";
import {
  mismoRango,
  rangoPorDefecto,
  rangosRapidos,
  type Rango,
} from "../../utils/rangos";
import {
  DIAS_RITMO,
  emitidosPorTipo,
  pronosticoCAE,
  rangoRitmo,
  textoPronostico,
  type CAE,
} from "../../utils/cae";
import { documentoId } from "../../providers/dataProvider";
import { obtenerSobreDocumento } from "../documentos/useSobre";
import { PronosticoCaeTable } from "../empresas/pronosticoCae";
import { INFO as INFO_PROCESOS } from "../procesos/info";
import { GraficoPorDia, type PuntoDia } from "./grafico";
import { RechazadosCard } from "./rechazados";

interface FilaEmitidos {
  tipo: string;
  idTipoDoc: number;
  estado: string | null;
  moneda: string | null;
  cantidad: number;
  total: number;
}

interface FilaRecibidos {
  tipo: string;
  idTipoDoc: number;
  moneda: string | null;
  cantidad: number;
  total: number;
}

interface Resumen {
  desde: string;
  hasta: string;
  emitidos: FilaEmitidos[];
  recibidos: FilaRecibidos[];
  porDia: PuntoDia[];
}

interface FilaTipoEmitidos {
  idTipoDoc: number;
  tipo: string;
  cantidad: number;
  AE: number;
  BE: number;
  CE: number;
  sin: number;
  UYU: number;
  USD: number;
  otras: number;
}

interface Carpeta {
  folderName: string;
  ultimaSincronizacion?: string | null;
}

/** Emitido sin respuesta de DGI despues de la hora que DGI indico para consultarla */
interface SinRespuestaDgi {
  idTipoDoc: number;
  tipo: string;
  serie: string;
  nro: number;
  fechaEmision: string;
}

/** GET /procesos (solo ADMIN) */
interface EstadoProcesos {
  inicioInstancia: string;
  ahora: string;
  procesos: {
    nombre: string;
    activo: boolean;
    intervaloSegundos: number;
    ultimoInicio?: string | null;
    enEjecucion: boolean;
    ultimoError?: string | null;
    ultimoErrorFecha?: string | null;
  }[];
}

/** Margen despues de la hora de respuesta de DGI antes de avisar (lerandsys consulta apenas pasa la hora) */
const MARGEN_RESPUESTA_DGI_MIN = 60;

/** "yyyy-MM-dd HH:mm:ss z" de la API */
const fechaApi = (v?: string | null) => (v ? dayjs(v.slice(0, 19)) : undefined);

interface Datos {
  resumen?: Resumen;
  caes?: CAE[];
  /** Emitidos por tipo en los ultimos DIAS_RITMO dias (ritmo de uso de los CAE) */
  ritmo?: Map<number, number>;
  emailsError?: number;
  carpetas?: Carpeta[];
  /** Venta USD de ayer (null si no esta cargada) y valores de UI: los usa el tope de UI de los eTickets */
  usdAyer?: number | null;
  uis?: { anio: number }[];
  reportes?: { fecha: string }[];
  /** Emitidos sin respuesta de DGI pasada la hora de consulta + margen (de los 50 mas recientes sin respuesta) */
  sinRespuestaDgi?: SinRespuestaDgi[];
  /** null si el usuario no es ADMIN (la API no le muestra los procesos) */
  procesos?: EstadoProcesos | null;
  errores: Record<string, string>;
}

type Gravedad = "error" | "warning" | "info";

interface Aviso {
  gravedad: Gravedad;
  texto: ReactNode;
}

const MAX_DIAS = 62;
const etiquetaTipo = (id?: number, nombre?: string) =>
  TIPOS_DOC.find((t) => t.id === id || t.name === nombre)?.label ??
  nombre ??
  String(id);

const monto = (n: number) =>
  n.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Link al listado de comprobantes ya filtrado, con el periodo del tablero */
const urlComprobantes = (
  filtros: Record<string, string>,
  desde: Dayjs,
  hasta: Dayjs,
) =>
  `/documentos?${new URLSearchParams({ ...filtros, desde: desde.format("YYYY-MM-DD"), hasta: hasta.format("YYYY-MM-DD") })}`;

/** Agrupa fechas consecutivas en rangos legibles: "01/10–10/10, 13/10" */
function rangosDeFechas(fechas: string[]) {
  const ordenadas = [...fechas].sort();
  const partes: string[] = [];
  let inicio = ordenadas[0];
  let anterior = ordenadas[0];
  for (const fecha of [...ordenadas.slice(1), undefined]) {
    if (fecha && dayjs(fecha).diff(dayjs(anterior), "day") === 1) {
      anterior = fecha;
      continue;
    }
    if (inicio)
      partes.push(
        inicio === anterior
          ? dayjs(inicio).format("DD/MM")
          : `${dayjs(inicio).format("DD/MM")}–${dayjs(anterior).format("DD/MM")}`,
      );
    inicio = fecha!;
    anterior = fecha!;
  }
  return partes.join(", ");
}

/** Colores de estado: en claro los del tablero original; en oscuro, los del tema oscuro de Ant Design */
const COLORES_ESTADO = {
  claro: {
    error: "#d03b3b",
    warning: "#c98500",
    info: "#52514e",
    ok: "#2e8540",
  },
  oscuro: {
    error: "#e86465",
    warning: "#d89614",
    info: "#a6a5a0",
    ok: "#49aa19",
  },
};

const icono = (gravedad: Gravedad, colores: typeof COLORES_ESTADO.claro) =>
  ({
    error: <CloseCircleFilled style={{ color: colores.error }} />,
    warning: <ExclamationCircleFilled style={{ color: colores.warning }} />,
    info: <InfoCircleFilled style={{ color: colores.info }} />,
  })[gravedad];

/** Tablero de la empresa seleccionada (solo lectura) */
export function Inicio() {
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const { oscuro } = useTema();
  const colores = COLORES_ESTADO[oscuro ? "oscuro" : "claro"];
  const [rango, setRango] = useState<Rango>(rangoPorDefecto);
  const [datos, setDatos] = useState<Datos>({ errores: {} });
  const [loading, setLoading] = useState(true);

  const [desde, hasta] = rango;

  useEffect(() => {
    if (!empresa) return;
    let cancelado = false;
    setLoading(true);
    const rut = empresa.rut;
    const fromDate = Math.floor(desde.startOf("day").valueOf() / 1000);
    const toDate = Math.floor(hasta.endOf("day").valueOf() / 1000);
    const dias = Math.min(MAX_DIAS, hasta.diff(desde, "day") + 1);

    const consultas = {
      resumen: apiJson<Resumen>("GET", `/empresa/${rut}/documentos/resumen`, {
        fromDate,
        toDate,
      }),
      caes: apiJson<CAE[]>("GET", `/empresa/${rut}/cae`),
      ritmo: apiJson<Resumen>(
        "GET",
        `/empresa/${rut}/documentos/resumen`,
        rangoRitmo(),
      ).then((r) => emitidosPorTipo(r.emitidos ?? [])),
      emailsError: apiJson<{ count: number }>("GET", `/empresa/${rut}/emails`, {
        estado: "PROCESADO_ERROR",
        desde: fromDate,
        hasta: toDate,
        page: 1,
        pageSize: 1,
      }).then((r) => r.count),
      carpetas: apiJson<Carpeta[]>("GET", `/empresa/${rut}/emails/carpetas`),
      usdAyer: apiJson<{ cotizaciones: { venta?: number | null }[] }>(
        "GET",
        "/tiposDeCambio",
        {
          moneda: "USD",
          desde: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
          hasta: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
        },
      ).then((r) => r.cotizaciones[0]?.venta ?? null),
      uis: apiJson<{ anio: number }[]>("GET", "/ui"),
      reportes: apiJson<{ fecha: string }[][]>(
        "GET",
        `/empresa/${rut}/reporteDiario/${desde.format("YYYYMMDD")}`,
        {
          cantReportes: dias,
        },
      ).then((r) => (r ?? []).flat()),
      // Sin importar el periodo: lo que esta pendiente ahora. La hora de cada uno sale de su sobre.
      sinRespuestaDgi: apiJson<{
        results: { tipo: string; serie: string; nro: number; fechaEmision: string }[];
      }>("GET", `/empresa/${rut}/documentos`, {
        direccion: "EMITIDO",
        estado: "SIN",
        fromDate: 0,
        toDate: Math.floor(Date.now() / 1000) + 86400,
        page: 1,
        pageSize: 50,
      }).then(async (r) => {
        const ahora = dayjs();
        const revisados = await Promise.allSettled(
          r.results.map(async (d) => {
            const idTipoDoc = tipoDocByName(d.tipo)?.id;
            if (!idTipoDoc) return null;
            const { sobre } = await obtenerSobreDocumento(
              rut,
              { idTipoDoc, serie: d.serie, nro: d.nro },
              "EMITIDO",
            );
            // Solo los sobres recibidos por DGI (AS): los rechazados no van a tener respuesta
            const desdeConsulta = fechaApi(sobre?.fechaConsulta);
            return sobre?.estadoDgi === "AS" &&
              desdeConsulta &&
              ahora.diff(desdeConsulta, "minute") > MARGEN_RESPUESTA_DGI_MIN
              ? { idTipoDoc, ...d }
              : null;
          }),
        );
        return revisados.flatMap((x) =>
          x.status === "fulfilled" && x.value ? [x.value] : [],
        );
      }),
      // Solo ADMIN: para el resto la API lo rechaza y no se avisa nada
      procesos: apiJson<EstadoProcesos>("GET", "/procesos").catch(() => null),
    };

    // Cada seccion es independiente: si una falla se muestra su error y el resto del tablero sigue
    Promise.allSettled(Object.values(consultas)).then((resultados) => {
      if (cancelado) return;
      const nuevos: Datos = { errores: {} };
      Object.keys(consultas).forEach((clave, i) => {
        const r = resultados[i];
        if (r.status === "fulfilled")
          (nuevos as unknown as Record<string, unknown>)[clave] = r.value;
        else nuevos.errores[clave] = (r.reason as Error)?.message ?? "Error";
      });
      setDatos(nuevos);
      setLoading(false);
    });
    return () => {
      cancelado = true;
    };
  }, [empresa, desde, hasta]);

  const calculo = useMemo(() => {
    const emitidos = datos.resumen?.emitidos ?? [];
    const recibidos = datos.resumen?.recibidos ?? [];
    const sumar = (filas: { cantidad: number }[]) =>
      filas.reduce((a, f) => a + f.cantidad, 0);
    const porEstado = (estado: string | null) =>
      sumar(emitidos.filter((f) => f.estado === estado));

    // Dias del periodo sin reporte. El reporte del dia D se envia el dia D+1 a la noche: se revisa hasta anteayer
    const limite = dayjs().subtract(2, "day").startOf("day");
    const conReporte = new Set((datos.reportes ?? []).map((r) => r.fecha));
    const sinReporte: string[] = [];
    for (
      let d = desde.startOf("day");
      !d.isAfter(hasta, "day") && !d.isAfter(limite, "day");
      d = d.add(1, "day")
    )
      if (!conReporte.has(d.format("YYYY-MM-DD")))
        sinReporte.push(d.format("YYYY-MM-DD"));

    return {
      emitidos: sumar(emitidos),
      recibidos: sumar(recibidos),
      aceptados: porEstado("AE"),
      rechazados: porEstado("BE"),
      observados: porEstado("CE"),
      sinRespuesta: porEstado(null),
      sinReporte,
    };
  }, [datos, desde, hasta]);

  const pronostico = useMemo(
    () =>
      datos.caes ? pronosticoCAE(datos.caes, datos.ritmo ?? new Map()) : [],
    [datos],
  );

  const avisos = useMemo<Aviso[]>(() => {
    const lista: Aviso[] = [];
    if (!empresa) return lista;

    const firma = estadoFirma(empresa.firmaDigital);
    if (firma.alerta)
      lista.push({
        gravedad: (firma.dias ?? 0) <= 0 ? "error" : "warning",
        texto: `Firma digital: ${firma.label.toLowerCase()} (válida hasta ${formatFechaCorta(empresa.firmaDigital?.validaHasta)})`,
      });
    else if (!empresa.firmaDigital)
      lista.push({
        gravedad: "error",
        texto: "La empresa no tiene firma digital cargada",
      });

    if (calculo.sinReporte.length > 0)
      lista.push({
        gravedad: "error",
        texto: `Sin reporte diario a DGI ${calculo.sinReporte.length === 1 ? "el día" : `en ${calculo.sinReporte.length} días`}: ${rangosDeFechas(calculo.sinReporte)}`,
      });

    if (calculo.rechazados > 0)
      lista.push({
        gravedad: "error",
        texto: (
          <>
            {calculo.rechazados} comprobante
            {calculo.rechazados === 1 ? "" : "s"} rechazado
            {calculo.rechazados === 1 ? "" : "s"} por DGI en el período (
            <Link to={urlComprobantes({ estado: "BE" }, desde, hasta)}>
              ver rechazados
            </Link>
            )
          </>
        ),
      });

    // CAE: cuando hace falta uno nuevo por tipo (se agota al ritmo actual o vence)
    const linkCae = (
      <Link to={`/empresas/show/${empresa.rut}?tab=cae`}>ver CAE</Link>
    );
    const sinVigenteSinUso: string[] = [];
    for (const p of pronostico) {
      const nombre = etiquetaTipo(p.idTipoDoc, p.tipo);
      if (p.vigentes === 0) {
        if (p.gravedad === "error")
          lista.push({
            gravedad: "error",
            texto: (
              <>
                Sin CAE vigente para {nombre} ({p.emitidos} emitidos en los
                últimos {DIAS_RITMO} días, {linkCae})
              </>
            ),
          });
        else sinVigenteSinUso.push(nombre);
      } else if (p.gravedad === "error" || p.gravedad === "warning")
        lista.push({
          gravedad: p.gravedad,
          texto: (
            <>
              CAE de {nombre}: {textoPronostico(p).toLowerCase()} (
              {p.limite?.format("DD/MM/YYYY")}
              {p.motivo === "agota"
                ? `, quedan ${p.disponibles} números al ritmo de ${p.emitidos} cada ${DIAS_RITMO} días`
                : ""}
              , {linkCae})
            </>
          ),
        });
    }
    if (sinVigenteSinUso.length > 0)
      lista.push({
        gravedad: "info",
        texto: `Sin CAE vigente (sin emisiones en los últimos ${DIAS_RITMO} días): ${sinVigenteSinUso.join(", ")}`,
      });

    if ((datos.emailsError ?? 0) > 0)
      lista.push({
        gravedad: "warning",
        texto: (
          <>
            {datos.emailsError} email{datos.emailsError === 1 ? "" : "s"}{" "}
            recibido{datos.emailsError === 1 ? "" : "s"} con error en el período
            (
            <Link
              to={`/empresas/show/${empresa.rut}?tab=emails&estado=PROCESADO_ERROR`}
            >
              ver emails con error
            </Link>
            )
          </>
        ),
      });

    const atrasadas = (datos.carpetas ?? []).filter(
      (c) =>
        !c.ultimaSincronizacion ||
        dayjs().diff(dayjs(c.ultimaSincronizacion.slice(0, 19)), "minute") > 15,
    );
    if (atrasadas.length > 0)
      lista.push({
        gravedad: "warning",
        texto: `${atrasadas.length} carpeta${atrasadas.length === 1 ? "" : "s"} de email sin sincronizar en los últimos 15 minutos`,
      });

    // Valores que necesita la emision de eTickets en moneda extranjera (tope de UI). Si la API no tiene los
    // endpoints (version vieja) no se avisa nada.
    const faltaUsd = datos.usdAyer === null;
    const faltaUi =
      datos.uis !== undefined &&
      !datos.uis.some((u) => u.anio === dayjs().year());
    if (faltaUsd || faltaUi)
      lista.push({
        gravedad: "warning",
        texto: (
          <>
            {[
              faltaUsd &&
                `Sin cotización USD del ${dayjs().subtract(1, "day").format("DD/MM")}`,
              faltaUi && `sin UI de ${dayjs().year()}`,
            ]
              .filter(Boolean)
              .join(" y ")}
            : los eTickets en moneda extranjera fallan (
            <Link to="/cotizaciones">ver cotizaciones</Link>)
          </>
        ),
      });

    const sinRespuesta = datos.sinRespuestaDgi ?? [];
    if (sinRespuesta.length > 0) {
      const nombre = (d: SinRespuestaDgi) =>
        `${etiquetaTipo(d.idTipoDoc, d.tipo)} ${d.serie}-${d.nro}`;
      const masViejo = sinRespuesta
        .map((d) => d.fechaEmision.slice(0, 10))
        .sort()[0];
      lista.push({
        gravedad: "warning",
        texto: (
          <>
            {sinRespuesta.length === 1
              ? `${nombre(sinRespuesta[0])} sigue sin respuesta de DGI`
              : `${sinRespuesta.length} comprobantes siguen sin respuesta de DGI`}{" "}
            más de una hora después de la hora indicada por DGI (
            <Link
              to={
                sinRespuesta.length === 1
                  ? `/documentos/show/${encodeURIComponent(documentoId(sinRespuesta[0].idTipoDoc, sinRespuesta[0].serie, sinRespuesta[0].nro))}?direccion=EMITIDO`
                  : urlComprobantes({ estado: "SIN" }, dayjs(masViejo), dayjs())
              }
            >
              {sinRespuesta.length === 1 ? "ver comprobante" : "ver sin respuesta"}
            </Link>
            )
          </>
        ),
      });
    }

    // Procesos (solo ADMIN): ultima ejecucion con error, o sin ejecutarse hace mas de 3 intervalos
    if (datos.procesos) {
      const ahoraApi = fechaApi(datos.procesos.ahora) ?? dayjs();
      const inicioInstancia = fechaApi(datos.procesos.inicioInstancia);
      for (const p of datos.procesos.procesos.filter((p) => p.activo)) {
        const titulo = INFO_PROCESOS[p.nombre]?.titulo ?? p.nombre;
        const inicio = fechaApi(p.ultimoInicio);
        const error = fechaApi(p.ultimoErrorFecha);
        const link = <Link to="/procesos">ver procesos</Link>;
        if (error && (!inicio || !error.isBefore(inicio)))
          lista.push({
            gravedad: "error",
            texto: (
              <>
                Proceso «{titulo}»: falló la última ejecución
                {p.ultimoError ? ` (${p.ultimoError})` : ""} ({link})
              </>
            ),
          });
        const limiteMin = Math.max(10, (3 * p.intervaloSegundos) / 60);
        const ultimo = inicio ?? inicioInstancia;
        if (!p.enEjecucion && ultimo && ahoraApi.diff(ultimo, "minute") > limiteMin)
          lista.push({
            gravedad: "warning",
            texto: (
              <>
                Proceso «{titulo}»: no se ejecuta desde{" "}
                {inicio ? `hace ${ahoraApi.diff(inicio, "minute")} minutos` : "que arrancó la API"}{" "}
                ({link})
              </>
            ),
          });
      }
    }

    const orden: Record<Gravedad, number> = { error: 0, warning: 1, info: 2 };
    return lista.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);
  }, [empresa, datos, calculo, pronostico, desde, hasta]);

  const filasEmitidos = useMemo(() => {
    const porTipo = new Map<number, FilaTipoEmitidos>();
    for (const f of datos.resumen?.emitidos ?? []) {
      const fila = porTipo.get(f.idTipoDoc) ?? {
        idTipoDoc: f.idTipoDoc,
        tipo: f.tipo,
        cantidad: 0,
        AE: 0,
        BE: 0,
        CE: 0,
        sin: 0,
        UYU: 0,
        USD: 0,
        otras: 0,
      };
      fila.cantidad += f.cantidad;
      if (f.estado === "AE" || f.estado === "BE" || f.estado === "CE")
        fila[f.estado] += f.cantidad;
      else fila.sin += f.cantidad;
      if (f.moneda === "UYU" || f.moneda === "USD") fila[f.moneda] += f.total;
      else fila.otras += f.total;
      porTipo.set(f.idTipoDoc, fila);
    }
    return [...porTipo.values()].sort((x, y) => x.idTipoDoc - y.idTipoDoc);
  }, [datos]);

  const filasRecibidos = useMemo(() => {
    const porTipo = new Map<
      number,
      {
        idTipoDoc: number;
        tipo: string;
        cantidad: number;
        UYU: number;
        USD: number;
        otras: number;
      }
    >();
    for (const f of datos.resumen?.recibidos ?? []) {
      const fila = porTipo.get(f.idTipoDoc) ?? {
        idTipoDoc: f.idTipoDoc,
        tipo: f.tipo,
        cantidad: 0,
        UYU: 0,
        USD: 0,
        otras: 0,
      };
      fila.cantidad += f.cantidad;
      const moneda =
        f.moneda === "UYU" || f.moneda === "USD" ? f.moneda : "otras";
      fila[moneda] += f.total;
      porTipo.set(f.idTipoDoc, fila);
    }
    return [...porTipo.values()].sort((a, b) => a.idTipoDoc - b.idTipoDoc);
  }, [datos]);

  if (!empresa)
    return <Typography.Text>Seleccione una empresa.</Typography.Text>;

  const errorSeccion = (clave: string) =>
    datos.errores[clave] ? (
      <Alert
        type="error"
        showIcon
        message="No se pudieron obtener los datos"
        description={datos.errores[clave]}
      />
    ) : null;

  const kpis: {
    titulo: string;
    valor: number | undefined;
    destacar?: boolean;
    link?: string;
  }[] = [
    {
      titulo: "Emitidos",
      valor: datos.resumen ? calculo.emitidos : undefined,
      link: urlComprobantes({ direccion: "EMITIDO" }, desde, hasta),
    },
    {
      titulo: "Recibidos",
      valor: datos.resumen ? calculo.recibidos : undefined,
      link: urlComprobantes({ direccion: "RECIBIDO" }, desde, hasta),
    },
    {
      titulo: "Rechazados por DGI",
      valor: datos.resumen ? calculo.rechazados : undefined,
      destacar: calculo.rechazados > 0,
      link: urlComprobantes({ estado: "BE" }, desde, hasta),
    },
    {
      titulo: "Sin respuesta de DGI",
      valor: datos.resumen ? calculo.sinRespuesta : undefined,
      link: urlComprobantes({ estado: "SIN" }, desde, hasta),
    },
    {
      titulo: "Emails con error",
      valor: datos.emailsError,
      destacar: (datos.emailsError ?? 0) > 0,
      link: `/empresas/show/${empresa.rut}`,
    },
    {
      titulo: "Días sin reporte diario",
      valor: datos.reportes ? calculo.sinReporte.length : undefined,
      destacar: calculo.sinReporte.length > 0,
      link: "/reportes",
    },
  ];

  return (
    <List title={`Inicio - ${empresa.razon ?? empresa.rut}`}>
      <Space wrap size={[8, 8]} style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker
          format="DD/MM/YYYY"
          allowClear={false}
          value={rango}
          presets={rangosRapidos()}
          disabledDate={(d) => d.isAfter(dayjs(), "day")}
          onChange={(v) =>
            v?.[0] && v?.[1] && setRango([v[0] as Dayjs, v[1] as Dayjs])
          }
        />
        {rangosRapidos().map(({ label, value }) => (
          <Button
            key={label}
            size="small"
            type={mismoRango(rango, value) ? "primary" : "default"}
            onClick={() => setRango(value)}
          >
            {label}
          </Button>
        ))}
      </Space>

      <Row gutter={[16, 16]}>
        {kpis.map((k) => (
          <Col key={k.titulo} xs={12} md={8} xl={4}>
            <Card
              size="small"
              hoverable={!!k.link}
              onClick={k.link ? () => navigate(k.link!) : undefined}
              style={{ cursor: k.link ? "pointer" : undefined }}
            >
              {k.valor === undefined && loading ? (
                <Skeleton active paragraph={false} />
              ) : (
                <Statistic
                  title={k.titulo}
                  value={k.valor ?? "-"}
                  valueStyle={{
                    color: k.destacar ? colores.error : undefined,
                    fontWeight: 600,
                  }}
                  prefix={
                    k.destacar ? (
                      <ExclamationCircleFilled style={{ fontSize: 18 }} />
                    ) : undefined
                  }
                />
              )}
            </Card>
          </Col>
        ))}

        <Col xs={24} xl={10}>
          <Card size="small" title="Atención" style={{ height: "100%" }}>
            {loading ? (
              <Skeleton active />
            ) : avisos.length === 0 ? (
              <Space>
                <CheckCircleFilled style={{ color: colores.ok }} />
                <Typography.Text>Todo en orden</Typography.Text>
              </Space>
            ) : (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {avisos.map((a, i) => (
                  <Space key={i} align="start">
                    {icono(a.gravedad, colores)}
                    <Typography.Text>{a.texto}</Typography.Text>
                  </Space>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card size="small" title="Comprobantes por día">
            {errorSeccion("resumen") ??
              (loading && !datos.resumen ? (
                <Skeleton active />
              ) : (
                <GraficoPorDia
                  desde={desde.format("YYYY-MM-DD")}
                  hasta={hasta.format("YYYY-MM-DD")}
                  datos={datos.resumen?.porDia ?? []}
                />
              ))}
          </Card>
        </Col>

        <Col xs={24}>
          <RechazadosCard
            rut={empresa.rut}
            desde={desde}
            hasta={hasta}
            urlListado={urlComprobantes({ estado: "BE" }, desde, hasta)}
          />
        </Col>

        <Col xs={24} xl={14}>
          <Card size="small" title="Emitidos por tipo">
            {errorSeccion("resumen") ?? (
              <Table
                dataSource={filasEmitidos}
                rowKey="idTipoDoc"
                size="small"
                pagination={false}
                loading={loading}
                scroll={{ x: true }}
              >
                <Table.Column
                  title="Tipo"
                  render={(_, f: { idTipoDoc: number; tipo: string }) =>
                    etiquetaTipo(f.idTipoDoc, f.tipo)
                  }
                />
                <Table.Column
                  title="Cantidad"
                  dataIndex="cantidad"
                  align="right"
                />
                <Table.Column title="Aceptados" dataIndex="AE" align="right" />
                <Table.Column
                  title="Rechazados"
                  dataIndex="BE"
                  align="right"
                  render={(n: number) =>
                    n ? <Typography.Text type="danger">{n}</Typography.Text> : 0
                  }
                />
                <Table.Column title="Observados" dataIndex="CE" align="right" />
                <Table.Column
                  title="Sin respuesta"
                  dataIndex="sin"
                  align="right"
                />
                <Table.Column
                  title="Total UYU"
                  dataIndex="UYU"
                  align="right"
                  render={monto}
                />
                <Table.Column
                  title="Total USD"
                  dataIndex="USD"
                  align="right"
                  render={monto}
                />
              </Table>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card size="small" title="Recibidos por tipo">
            {errorSeccion("resumen") ?? (
              <Table
                dataSource={filasRecibidos}
                rowKey="idTipoDoc"
                size="small"
                pagination={false}
                loading={loading}
                scroll={{ x: true }}
              >
                <Table.Column
                  title="Tipo"
                  render={(_, f: { idTipoDoc: number; tipo: string }) =>
                    etiquetaTipo(f.idTipoDoc, f.tipo)
                  }
                />
                <Table.Column
                  title="Cantidad"
                  dataIndex="cantidad"
                  align="right"
                />
                <Table.Column
                  title="Total UYU"
                  dataIndex="UYU"
                  align="right"
                  render={monto}
                />
                <Table.Column
                  title="Total USD"
                  dataIndex="USD"
                  align="right"
                  render={monto}
                />
              </Table>
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            size="small"
            title="CAE por tipo de documento"
            extra={
              <Link to={`/empresas/show/${empresa.rut}?tab=cae`}>
                Ver todos los CAE
              </Link>
            }
          >
            {errorSeccion("caes") ?? (
              <PronosticoCaeTable
                filas={pronostico}
                loading={loading && !datos.caes}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}
      >
        Totales por moneda sumados tal cual (las notas de crédito no se restan).
        El reporte diario se revisa hasta anteayer. El pronóstico de CAE usa el
        ritmo de emisión de los últimos {DIAS_RITMO} días, sin importar el
        período elegido.
      </Typography.Paragraph>
    </List>
  );
}
