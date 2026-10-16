import { Layout, Typography } from "antd";
import dayjs from "dayjs";

const REPO = "https://github.com/nicoribeiro/efactura-admin";

/** Version del panel: commit y fecha del build (con npm run dev, "dev") */
export function Footer() {
  const compilado = __APP_BUILD__
    ? `compilado ${dayjs(__APP_BUILD__).format("DD/MM/YYYY HH:mm")}`
    : "dev";
  return (
    <Layout.Footer
      style={{
        padding: "8px 24px",
        textAlign: "right",
        background: "transparent",
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        <Typography.Link
          href={REPO}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12 }}
        >
          efactura-admin
        </Typography.Link>{" "}
        · {__APP_COMMIT__} · {compilado}
      </Typography.Text>
    </Layout.Footer>
  );
}
