import { Layout, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { apiJson } from "../api/http";

const REPO = "https://github.com/nicoribeiro/efactura-admin";
const REPO_API = "https://github.com/nicoribeiro/java_efactura_uy";

/** GET /version de la API (VersionController en java_efactura_uy) */
interface VersionApi {
  version: string;
  commit: string;
  compilado: string | null;
}

const fecha = (iso: string) => dayjs(iso).format("DD/MM/YYYY HH:mm");

/** Version del panel (numero, commit y fecha del build; con npm run dev, "dev") y la de la API */
export function Footer() {
  const [api, setApi] = useState<VersionApi | null>(null);
  useEffect(() => {
    apiJson<VersionApi>("GET", "/version")
      .then(setApi)
      // Una API sin /version (anterior) no muestra nada
      .catch(() => setApi(null));
  }, []);

  const compilado = __APP_BUILD__ ? `compilado ${fecha(__APP_BUILD__)}` : "dev";
  const link = (href: string, texto: string) => (
    <Typography.Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontSize: 12 }}
    >
      {texto}
    </Typography.Link>
  );
  return (
    <Layout.Footer
      style={{
        padding: "8px 24px",
        textAlign: "right",
        background: "transparent",
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {link(REPO, "efactura-admin")} v{__APP_VERSION__} · {__APP_COMMIT__} ·{" "}
        {compilado}
        {api && (
          <>
            {" | "}
            {link(REPO_API, "API")}{" "}
            <Tooltip
              title={
                api.compilado ? `compilada ${fecha(api.compilado)}` : undefined
              }
            >
              <span>
                v{api.version} · {api.commit}
              </span>
            </Tooltip>
          </>
        )}
      </Typography.Text>
    </Layout.Footer>
  );
}
