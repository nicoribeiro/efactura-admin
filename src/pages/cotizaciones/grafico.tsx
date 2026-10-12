import { theme } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTema } from "../../contexts/tema";

export interface PuntoCotizacion {
  fecha: string; // yyyy-MM-dd
  valor?: number | null;
}

/** Slot 1 de la paleta de referencia (mismo azul que "Emitidos" en el tablero), paso claro y oscuro */
const COLOR = { claro: "#2a78d6", oscuro: "#3987e5" };
const ALTO = 200;
const MARGEN = { arriba: 12, derecha: 12, abajo: 26, izquierda: 48 };

/**
 * Linea de una cotizacion por dia. Los dias sin dato cortan la linea (no se interpolan). Hover por dia con el valor.
 */
export function GraficoCotizacion({
  dias,
  etiqueta,
}: {
  dias: PuntoCotizacion[];
  etiqueta: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(800);
  const [activo, setActivo] = useState<number | null>(null);
  const { oscuro } = useTema();
  const { token } = theme.useToken();
  const color = oscuro ? COLOR.oscuro : COLOR.claro;

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) =>
      setAncho(Math.max(320, e.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const valores = dias
    .map((d) => d.valor)
    .filter((v): v is number => v != null);
  const { min, max } = useMemo(() => {
    if (valores.length === 0) return { min: 0, max: 1 };
    const lo = Math.min(...valores);
    const hi = Math.max(...valores);
    const margen = Math.max((hi - lo) * 0.1, hi * 0.002);
    return { min: lo - margen, max: hi + margen };
  }, [valores]);

  const anchoPlot = ancho - MARGEN.izquierda - MARGEN.derecha;
  const altoPlot = ALTO - MARGEN.arriba - MARGEN.abajo;
  const paso = dias.length > 1 ? anchoPlot / (dias.length - 1) : 0;
  const x = (i: number) => MARGEN.izquierda + i * paso;
  const y = (v: number) =>
    MARGEN.arriba + altoPlot - ((v - min) / (max - min || 1)) * altoPlot;

  // Tramos continuos (un dia sin dato corta la linea)
  const path = dias
    .map((d, i) =>
      d.valor == null
        ? ""
        : `${i > 0 && dias[i - 1].valor != null ? "L" : "M"}${x(i)},${y(d.valor)}`,
    )
    .join(" ");

  const ticks = [min, (min + max) / 2, max];
  const etiquetasX = dias
    .map((d, i) => ({ d, i }))
    .filter(
      ({ i }) =>
        i === 0 ||
        i === dias.length - 1 ||
        (dias.length > 2 &&
          i % Math.ceil(dias.length / 6) === 0 &&
          i < dias.length - 3),
    );
  const formato = (v: number) =>
    v.toLocaleString("es-UY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  const diaActivo = activo !== null ? dias[activo] : null;

  return (
    <div ref={contenedor} style={{ position: "relative" }}>
      <svg
        width={ancho}
        height={ALTO}
        role="img"
        aria-label={`${etiqueta} por día`}
        style={{ display: "block" }}
        onPointerLeave={() => setActivo(null)}
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
          const i = Math.round(
            (e.clientX - rect.left - MARGEN.izquierda) / (paso || 1),
          );
          setActivo(i >= 0 && i < dias.length ? i : null);
        }}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={MARGEN.izquierda}
              x2={ancho - MARGEN.derecha}
              y1={y(t)}
              y2={y(t)}
              stroke={token.colorBorderSecondary}
            />
            <text
              x={MARGEN.izquierda - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill={token.colorTextSecondary}
            >
              {formato(t)}
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {activo !== null && (
          <line
            x1={x(activo)}
            x2={x(activo)}
            y1={MARGEN.arriba}
            y2={MARGEN.arriba + altoPlot}
            stroke={token.colorTextTertiary}
            strokeDasharray="3 3"
          />
        )}
        {diaActivo?.valor != null && activo !== null && (
          <circle
            cx={x(activo)}
            cy={y(diaActivo.valor)}
            r={4}
            fill={color}
            stroke={token.colorBgContainer}
            strokeWidth={2}
          />
        )}
        {etiquetasX.map(({ d, i }) => (
          <text
            key={d.fecha}
            x={x(i)}
            y={ALTO - 8}
            textAnchor={
              i === 0 ? "start" : i === dias.length - 1 ? "end" : "middle"
            }
            fontSize={11}
            fill={token.colorTextSecondary}
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
            left: Math.min(Math.max(0, x(activo) - 70), ancho - 150),
            width: 140,
            pointerEvents: "none",
            background: token.colorBgElevated,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 6,
            boxShadow: token.boxShadowSecondary,
            padding: "6px 10px",
            fontSize: 12,
          }}
        >
          <div style={{ color: token.colorTextSecondary }}>
            {dayjs(diaActivo.fecha).format("ddd DD/MM/YYYY")}
          </div>
          <strong>
            {diaActivo.valor != null
              ? formato(diaActivo.valor)
              : "Sin cotización"}
          </strong>{" "}
          <span style={{ color: token.colorTextSecondary }}>
            {etiqueta.toLowerCase()}
          </span>
        </div>
      )}
    </div>
  );
}
