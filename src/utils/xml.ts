/**
 * Indenta un XML para mostrarlo. Solo para visualizar: los XML de DGI estan firmados y cambiar los espacios
 * invalida la firma, por eso para copiar se usa siempre el original.
 *
 * Si el texto no es XML valido se devuelve sin cambios.
 */
export function formatearXml(xml: string, indentacion = "  "): string {
  const texto = xml.trim();
  if (!texto.startsWith("<")) return xml;

  const doc = new DOMParser().parseFromString(texto, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return xml;

  // La declaracion <?xml ...?> no queda en el DOM: se conserva la original
  const declaracion = /^<\?xml[^?]*\?>/.exec(texto)?.[0];
  const lineas: string[] = declaracion ? [declaracion] : [];

  for (const nodo of Array.from(doc.childNodes)) lineas.push(...formatearNodo(nodo, 0, indentacion));
  return lineas.join("\n");
}

const escaparTexto = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escaparAtributo = (s: string) => escaparTexto(s).replace(/"/g, "&quot;");

function formatearNodo(nodo: Node, nivel: number, ind: string): string[] {
  const prefijo = ind.repeat(nivel);

  switch (nodo.nodeType) {
    case Node.ELEMENT_NODE: {
      const el = nodo as Element;
      const atributos = Array.from(el.attributes)
        .map((a) => ` ${a.name}="${escaparAtributo(a.value)}"`)
        .join("");
      const apertura = `<${el.nodeName}${atributos}`;

      // Hijos significativos: se descarta el texto que es solo espacios entre elementos
      const hijos = Array.from(el.childNodes).filter(
        (h) => !(h.nodeType === Node.TEXT_NODE && (h.nodeValue ?? "").trim() === ""),
      );

      if (hijos.length === 0) return [`${prefijo}${apertura}/>`];

      // Un solo texto: en la misma linea (<RUCEmisor>210778720012</RUCEmisor>)
      if (hijos.length === 1 && (hijos[0].nodeType === Node.TEXT_NODE || hijos[0].nodeType === Node.CDATA_SECTION_NODE))
        return [`${prefijo}${apertura}>${formatearTexto(hijos[0])}</${el.nodeName}>`];

      return [
        `${prefijo}${apertura}>`,
        ...hijos.flatMap((h) => formatearNodo(h, nivel + 1, ind)),
        `${prefijo}</${el.nodeName}>`,
      ];
    }
    case Node.TEXT_NODE:
    case Node.CDATA_SECTION_NODE:
      return [`${prefijo}${formatearTexto(nodo)}`];
    case Node.COMMENT_NODE:
      return [`${prefijo}<!--${nodo.nodeValue}-->`];
    case Node.PROCESSING_INSTRUCTION_NODE: {
      const pi = nodo as ProcessingInstruction;
      return [`${prefijo}<?${pi.target} ${pi.data}?>`];
    }
    default:
      return [];
  }
}

function formatearTexto(nodo: Node): string {
  const valor = (nodo.nodeValue ?? "").trim();
  return nodo.nodeType === Node.CDATA_SECTION_NODE ? `<![CDATA[${valor}]]>` : escaparTexto(valor);
}
