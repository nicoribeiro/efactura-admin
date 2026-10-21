import { Collapse, Table, Typography } from "antd";
import dayjs from "dayjs";
import { theme } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTema } from "../../contexts/tema";
import { ordenar } from "../../utils/orden";

export interface PuntoDia {
  fecha: string; // yyyy-MM-dd
  emitidos: number;
  recibidos: number;
}

/**
 * Paleta categorica de referencia (slots 1 y 2) con sus pasos para cada tema, validada contra la superficie de las
 * tarjetas: claro (#fff) CVD ΔE 24.7, vision normal 33.6; oscuro (#141414) CVD ΔE 26.8, vision normal 31.8;
 * contraste >= 3:1 en ambos.
 */
const PALETAS = {
  claro: {
    series: { emitidos: "#2a78d6", recibidos: "#eb6834" },
    texto: "#52514e",
    grilla: "#e8e7e3",
    resaltado: "#000",
  },
  oscuro: {
    series: { emitidos: "#3987e5", recibidos: "#d95926" },
    texto: "#c3c2b7",
    grilla: "#383835",
    resaltado: "#fff",
  },
};
const SERIES = [
  { clave: "emitidos" as const, label: "Emitidos" },
  { clave: "recibidos" as const, label: "Recibidos" },
];
const ALTO = 220;
const MARGEN = { arriba: 12, derecha: 12, abajo: 28, izquierda: 36 };

/** Escala "limpia" para el eje Y: 0 / mitad / maximo redondeados */
function maximoLimpio(max: number) {
  if (max <= 4) return 4;
  const magnitud = 10 ** Math.floor(Math.log10(max));
  for (const paso of [1, 2, 2.5, 5, 10])
    if (paso * magnitud >= max) return paso * magnitud;
  return 10 * magnitud;
}

/** Columna con el extremo de dato redondeado (4px) y la base recta */
function columna(x: number, y: number, ancho: number, base: number) {
  const alto = base - y;
  if (alto <= 0) return "";
  const r = Math.min(4, ancho / 2, alto);
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${base} Z`;
}

/**
 * Comprobantes por dia (emitidos y recibidos). Un punto por dia del periodo (los dias sin comprobantes van en 0).
 * Hover por dia con todas las series; tabla accesible debajo.
 */
export function GraficoPorDia({
  desde,
  hasta,
  datos,
}: {
  desde: string;
  hasta: string;
  datos: PuntoDia[];
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(800);
  const [activo, setActivo] = useState<number | null>(null);
  const { oscuro } = useTema();
  const { token } = theme.useToken();
  const paleta = PALETAS[oscuro ? "oscuro" : "claro"];
  const TEXTO_SECUNDARIO = paleta.texto;
  const GRILLA = paleta.grilla;

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const observer = new ResizeObserver(([entrada]) =>
      setAncho(Math.max(320, entrada.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Serie completa: todos los dias del periodo, con 0 donde no hay comprobantes
  const dias = useMemo(() => {
    const porFecha = new Map(datos.map((d) => [d.fecha, d]));
    const resultado: PuntoDia[] = [];
    for (
      let d = dayjs(desde);
      !d.isAfter(dayjs(hasta), "day");
      d = d.add(1, "day")
    ) {
      const fecha = d.format("YYYY-MM-DD");
      resultado.push(
        porFecha.get(fecha) ?? { fecha, emitidos: 0, recibidos: 0 },
      );
    }
    return resultado;
  }, [datos, desde, hasta]);

  const anchoPlot = ancho - MARGEN.izquierda - MARGEN.derecha;
  const altoPlot = ALTO - MARGEN.arriba - MARGEN.abajo;
  const banda = anchoPlot / Math.max(1, dias.length);
  const anchoColumna = Math.max(2, Math.min(12, (banda - 6) / 2));
  const maximo = maximoLimpio(
    Math.max(1, ...dias.flatMap((d) => [d.emitidos, d.recibidos])),
  );
  const y = (valor: number) =>
    MARGEN.arriba + altoPlot - (valor / maximo) * altoPlot;
  const base = MARGEN.arriba + altoPlot;
  const ticks = [0, maximo / 2, maximo];

  // Etiquetas del eje X: primer y ultimo dia, y un lunes por semana
  const etiquetasX = dias
    .map((d, i) => ({ d, i }))
    .filter(
      ({ d, i }) =>
        i === 0 ||
        i === dias.length - 1 ||
        (dayjs(d.fecha).day() === 1 && i > 2 && i < dias.length - 3),
    );

  const diaActivo = activo !== null ? dias[activo] : null;

  return (
    <div>
      <div
        style={{ display: "flex", gap: 16, marginBottom: 8 }}
        aria-label="Leyenda"
      >
        {SERIES.map((s) => (
          <span
            key={s.clave}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: TEXTO_SECUNDARIO,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: paleta.series[s.clave],
                display: "inline-block",
              }}
            />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={contenedor} style={{ position: "relative" }}>
        <svg
          width={ancho}
          height={ALTO}
          role="img"
          aria-label="CFE emitidos y recibidos por día"
          style={{ display: "block" }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGEN.izquierda}
                x2={ancho - MARGEN.derecha}
                y1={y(t)}
                y2={y(t)}
                stroke={GRILLA}
                strokeWidth={1}
              />
              <text
                x={MARGEN.izquierda - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill={TEXTO_SECUNDARIO}
              >
                {t.toLocaleString("es-UY")}
              </text>
            </g>
          ))}

          {dias.map((d, i) => {
            const x0 =
              MARGEN.izquierda +
              i * banda +
              (banda - (anchoColumna * 2 + 2)) / 2;
            return (
              <g key={d.fecha}>
                {activo === i && (
                  <rect
                    x={MARGEN.izquierda + i * banda}
                    y={MARGEN.arriba}
                    width={banda}
                    height={altoPlot}
                    fill={paleta.resaltado}
                    opacity={oscuro ? 0.08 : 0.04}
                  />
                )}
                {SERIES.map((s, j) => (
                  <path
                    key={s.clave}
                    d={columna(
                      x0 + j * (anchoColumna + 2),
                      y(d[s.clave]),
                      anchoColumna,
                      base,
                    )}
                    fill={paleta.series[s.clave]}
                  />
                ))}
                {/* Area de hover: toda la banda del dia, mas grande que las columnas */}
                <rect
                  x={MARGEN.izquierda + i * banda}
                  y={MARGEN.arriba}
                  width={banda}
                  height={altoPlot}
                  fill="transparent"
                  onPointerEnter={() => setActivo(i)}
                  onPointerLeave={() => setActivo((a) => (a === i ? null : a))}
                />
              </g>
            );
          })}

          {etiquetasX.map(({ d, i }) => (
            <text
              key={d.fecha}
              x={MARGEN.izquierda + i * banda + banda / 2}
              y={ALTO - 8}
              textAnchor={
                i === 0 ? "start" : i === dias.length - 1 ? "end" : "middle"
              }
              fontSize={11}
              fill={TEXTO_SECUNDARIO}
            >
              {dayjs(d.fecha).format("DD/MM")}
            </text>
          ))}
        </svg>

        {diaActivo && activo !== null && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: Math.min(
                Math.max(0, MARGEN.izquierda + activo * banda + banda / 2 - 70),
                ancho - 150,
              ),
              width: 140,
              pointerEvents: "none",
              background: token.colorBgElevated,
              border: `1px solid ${GRILLA}`,
              borderRadius: 6,
              boxShadow: token.boxShadowSecondary,
              padding: "6px 10px",
              fontSize: 12,
            }}
          >
            <div style={{ color: TEXTO_SECUNDARIO, marginBottom: 4 }}>
              {dayjs(diaActivo.fecha).format("ddd DD/MM/YYYY")}
            </div>
            {SERIES.map((s) => (
              <div
                key={s.clave}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 2,
                    background: paleta.series[s.clave],
                    display: "inline-block",
                  }}
                />
                <strong>{diaActivo[s.clave]}</strong>
                <span style={{ color: TEXTO_SECUNDARIO }}>
                  {s.label.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Collapse
        ghost
        size="small"
        items={[
          {
            key: "tabla",
            label: (
              <Typography.Text type="secondary">Ver como tabla</Typography.Text>
            ),
            children: (
              <Table<PuntoDia>
                dataSource={[...dias].reverse()}
                rowKey="fecha"
                size="small"
                pagination={{ pageSize: 10, size: "small" }}
              >
                <Table.Column<PuntoDia>
                  title="Fecha"
                  dataIndex="fecha"
                  sorter={ordenar<PuntoDia>((d) => d.fecha)}
                  render={(f: string) => dayjs(f).format("ddd DD/MM/YYYY")}
                />
                <Table.Column<PuntoDia>
                  title="Emitidos"
                  dataIndex="emitidos"
                  align="right"
                  sorter={ordenar<PuntoDia>((d) => d.emitidos)}
                />
                <Table.Column<PuntoDia>
                  title="Recibidos"
                  dataIndex="recibidos"
                  align="right"
                  sorter={ordenar<PuntoDia>((d) => d.recibidos)}
                />
              </Table>
            ),
          },
        ]}
      />
    </div>
  );
}
