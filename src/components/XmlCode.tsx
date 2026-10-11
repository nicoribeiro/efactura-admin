import { CheckOutlined, CopyOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { formatearXml } from "../utils/xml";

/** Colores estilo editor oscuro */
const COLORES = {
  fondo: "#1e1e1e",
  borde: "#333",
  texto: "#d4d4d4",
  puntuacion: "#d4d4d4",
  nombre: "#e06c75",
  valor: "#98c379",
  comentario: "#7f848e",
};

const span = (color: string, contenido: string, key: number) => (
  <span key={key} style={{ color }}>
    {contenido}
  </span>
);

/**
 * Colorea una etiqueta ya indentada: <, </, <?, nombre, atributos (nombre="valor") y >, />, ?>.
 * Los nombres con prefijo (xmlns:firma) se colorean completos.
 */
function colorearEtiqueta(etiqueta: string, base: number): ReactNode[] {
  if (etiqueta.startsWith("<!--")) return [span(COLORES.comentario, etiqueta, base)];

  const partes: ReactNode[] = [];
  let k = base;
  const m = /^(<\/?|<\?)([^\s/?>]+)([\s\S]*?)(\/?>|\?>)$/.exec(etiqueta);
  if (!m) return [span(COLORES.texto, etiqueta, k)];

  const [, apertura, nombre, atributos, cierre] = m;
  partes.push(span(COLORES.puntuacion, apertura, k++), span(COLORES.nombre, nombre, k++));

  const reAtributo = /(\s+)([^\s=]+)(=)("[^"]*"|'[^']*')/g;
  let ultimo = 0;
  for (let a = reAtributo.exec(atributos); a; a = reAtributo.exec(atributos)) {
    if (a.index > ultimo) partes.push(span(COLORES.texto, atributos.slice(ultimo, a.index), k++));
    partes.push(
      span(COLORES.texto, a[1], k++),
      span(COLORES.nombre, a[2], k++),
      span(COLORES.puntuacion, a[3], k++),
      span(COLORES.valor, a[4], k++),
    );
    ultimo = a.index + a[0].length;
  }
  if (ultimo < atributos.length) partes.push(span(COLORES.texto, atributos.slice(ultimo), k++));

  partes.push(span(COLORES.puntuacion, cierre, k++));
  return partes;
}

function colorear(xml: string): ReactNode[] {
  const nodos: ReactNode[] = [];
  // Comentarios, CDATA y etiquetas; el resto es texto
  const reToken = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>/g;
  let ultimo = 0;
  let k = 0;
  for (let t = reToken.exec(xml); t; t = reToken.exec(xml)) {
    if (t.index > ultimo) nodos.push(span(COLORES.texto, xml.slice(ultimo, t.index), k++));
    const token = t[0];
    if (token.startsWith("<![CDATA[")) nodos.push(span(COLORES.valor, token, k++));
    else {
      const partes = colorearEtiqueta(token, k);
      k += partes.length;
      nodos.push(...partes);
    }
    ultimo = t.index + token.length;
  }
  if (ultimo < xml.length) nodos.push(span(COLORES.texto, xml.slice(ultimo), k++));
  return nodos;
}

/**
 * Muestra un XML indentado y coloreado. El boton copia el XML ORIGINAL: los XML de DGI estan firmados y cambiar los
 * espacios invalida la firma.
 */
export function XmlCode({ xml, maxHeight = 500 }: { xml: string; maxHeight?: number }) {
  const [copiado, setCopiado] = useState(false);
  const contenido = useMemo(() => colorear(formatearXml(xml)), [xml]);

  const copiar = async () => {
    await navigator.clipboard.writeText(xml);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <div style={{ position: "relative" }}>
      <Tooltip title={copiado ? "Copiado" : "Copiar XML original"}>
        <Button
          size="small"
          type="text"
          onClick={copiar}
          icon={copiado ? <CheckOutlined /> : <CopyOutlined />}
          style={{ position: "absolute", top: 8, right: 8, color: COLORES.texto, zIndex: 1 }}
        />
      </Tooltip>
      <pre
        style={{
          margin: 0,
          maxHeight,
          overflow: "auto",
          background: COLORES.fondo,
          color: COLORES.texto,
          border: `1px solid ${COLORES.borde}`,
          borderRadius: 8,
          padding: "12px 44px 12px 16px",
          fontSize: 12.5,
          lineHeight: 1.6,
          whiteSpace: "pre",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        }}
      >
        {contenido}
      </pre>
    </div>
  );
}
