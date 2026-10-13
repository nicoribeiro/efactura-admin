import {
  BankOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  InboxOutlined,
  TeamOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import {
  AuthPage,
  ErrorComponent,
  ThemedLayout,
  ThemedTitle,
  useNotificationProvider,
} from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import { Authenticated, Refine } from "@refinedev/core";
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
} from "@refinedev/react-router";
import { App as AntdApp } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";
import { STATUS_TIMEOUT } from "./api/http";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { EmpresaProvider } from "./contexts/empresa";
import { TemaProvider } from "./contexts/TemaProvider";
import { DocumentoList } from "./pages/documentos/list";
import { Inicio } from "./pages/inicio";
import { Cotizaciones } from "./pages/cotizaciones";
import { Usuarios } from "./pages/usuarios";
import { Procesos } from "./pages/procesos";
import { DocumentoShow } from "./pages/documentos/show";
import { EmpresaList } from "./pages/empresas/list";
import { ReporteDiarioList } from "./pages/reportes/list";
import { EmpresaShow } from "./pages/empresas/show";
import { SobreList } from "./pages/sobres/list";
import { SobreShow } from "./pages/sobres/show";
import { accessControlProvider } from "./providers/accessControlProvider";
import { authProvider, debeCambiarPassword } from "./providers/authProvider";
import { CambiarPassword } from "./pages/cuenta/cambiarPassword";
import { dataProvider } from "./providers/dataProvider";
import { i18nProvider } from "./providers/i18nProvider";

dayjs.locale("es");

const Title = ({ collapsed }: { collapsed: boolean }) => (
  <ThemedTitle collapsed={collapsed} text="efactura" />
);

export default function App() {
  return (
    <BrowserRouter>
      <TemaProvider>
        <AntdApp>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}
            i18nProvider={i18nProvider}
            routerProvider={routerProvider}
            notificationProvider={useNotificationProvider}
            resources={[
              {
                name: "inicio",
                list: "/inicio",
                meta: { label: "Inicio", icon: <DashboardOutlined /> },
              },
              {
                name: "documentos",
                list: "/documentos",
                show: "/documentos/show/:id",
                meta: { label: "Comprobantes", icon: <FileTextOutlined /> },
              },
              {
                name: "sobres",
                list: "/sobres",
                show: "/sobres/show/:id",
                meta: { label: "Sobres", icon: <InboxOutlined /> },
              },
              {
                name: "reportes",
                list: "/reportes",
                meta: { label: "Reporte diario", icon: <CalendarOutlined /> },
              },
              {
                name: "cotizaciones",
                list: "/cotizaciones",
                meta: { label: "Cotizaciones", icon: <DollarOutlined /> },
              },
              {
                name: "empresas",
                list: "/empresas",
                show: "/empresas/show/:id",
                meta: { label: "Empresas", icon: <BankOutlined /> },
              },
              // Administración: al final del menú, antes de Salir
              {
                name: "usuarios",
                list: "/usuarios",
                meta: { label: "Usuarios", icon: <TeamOutlined /> },
              },
              {
                name: "procesos",
                list: "/procesos",
                meta: { label: "Procesos", icon: <ScheduleOutlined /> },
              },
            ]}
            options={{
              syncWithLocation: false,
              warnWhenUnsavedChanges: false,
              disableTelemetry: true,
              reactQuery: {
                clientConfig: {
                  defaultOptions: {
                    queries: {
                      // Sin respuesta de la API ya se esperaron API_TIMEOUT_MS: a lo sumo un reintento,
                      // y ninguno para errores del cliente (4xx). Antes eran 3 reintentos (~2 min de spinner).
                      retry: (failureCount, error) => {
                        const status = (error as { statusCode?: number })
                          ?.statusCode;
                        if (
                          status !== undefined &&
                          status >= 400 &&
                          status < 500 &&
                          status !== STATUS_TIMEOUT
                        )
                          return false;
                        return failureCount < 1;
                      },
                      refetchOnWindowFocus: false,
                    },
                  },
                },
              },
            }}
          >
            <Routes>
              <Route
                element={
                  <Authenticated
                    key="app"
                    fallback={<CatchAllNavigate to="/login" />}
                  >
                    {/* Con contrasena temporal solo se puede cambiarla (la API rechaza el resto) */}
                    {debeCambiarPassword() ? (
                      <Navigate to="/cambiar-password" replace />
                    ) : (
                      <EmpresaProvider>
                        <ThemedLayout
                          Header={Header}
                          Title={Title}
                          Footer={Footer}
                        >
                          <Outlet />
                        </ThemedLayout>
                      </EmpresaProvider>
                    )}
                  </Authenticated>
                }
              >
                <Route
                  index
                  element={<NavigateToResource resource="inicio" />}
                />
                <Route path="/inicio" element={<Inicio />} />
                <Route path="/documentos">
                  <Route index element={<DocumentoList />} />
                  <Route path="show/:id" element={<DocumentoShow />} />
                </Route>
                <Route path="/sobres">
                  <Route index element={<SobreList />} />
                  <Route path="show/:id" element={<SobreShow />} />
                </Route>
                <Route path="/reportes" element={<ReporteDiarioList />} />
                <Route path="/cotizaciones" element={<Cotizaciones />} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/procesos" element={<Procesos />} />
                <Route path="/empresas">
                  <Route index element={<EmpresaList />} />
                  <Route path="show/:id" element={<EmpresaShow />} />
                </Route>
                <Route path="*" element={<ErrorComponent />} />
              </Route>
              <Route
                path="/cambiar-password"
                element={
                  <Authenticated
                    key="cambio"
                    fallback={<CatchAllNavigate to="/login" />}
                  >
                    <CambiarPassword />
                  </Authenticated>
                }
              />
              <Route
                element={
                  <Authenticated key="auth" fallback={<Outlet />}>
                    <NavigateToResource resource="inicio" />
                  </Authenticated>
                }
              >
                <Route
                  path="/login"
                  element={
                    <AuthPage
                      type="login"
                      title={<ThemedTitle collapsed={false} text="efactura" />}
                      registerLink={false}
                      forgotPasswordLink={false}
                      rememberMe={false}
                    />
                  }
                />
              </Route>
            </Routes>
            <DocumentTitleHandler handler={() => "efactura"} />
          </Refine>
        </AntdApp>
      </TemaProvider>
    </BrowserRouter>
  );
}
