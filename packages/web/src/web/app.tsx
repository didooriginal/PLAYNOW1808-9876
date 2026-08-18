import { Suspense, lazy, useEffect } from "react";
import { Route, Switch } from "wouter";
import Index from "./pages/index";
import LoginPage from "./pages/login";
import SignupPage from "./pages/signup";
import EsqueciSenhaPage from "./pages/esqueci-senha";
import RedefinirSenhaPage from "./pages/redefinir-senha";
import { Provider } from "./components/provider";
import { AdminRoute, Carregando, ProtectedRoute } from "./components/protected-route";
import { AgentFeedback } from "@runablehq/website-runtime";

/**
 * CODE SPLITTING.
 * A landing e as telas de login sao o que 99% das visitas carregam, entao ficam
 * no bundle principal. Painel do cliente, painel admin, checkout e as paginas
 * institucionais viram chunks separados — quem so olha a home nao baixa o admin
 * inteiro.
 */
const DashboardPage = lazy(() => import("./pages/dashboard"));
const AdminPage = lazy(() => import("./pages/admin"));
const SetupPage = lazy(() => import("./pages/setup"));
const CheckoutPage = lazy(() => import("./pages/checkout"));
const TermosPage = lazy(() => import("./pages/termos"));
const PrivacidadePage = lazy(() => import("./pages/privacidade"));
const TutoriaisPage = lazy(() => import("./pages/tutoriais"));

/**
 * TRAVA DA RODA DO MOUSE EM CAMPO NUMÉRICO.
 *
 * Todo `input[type=number]` do navegador incrementa/decrementa quando a roda
 * do mouse gira com o campo focado. No admin isso fazia número de vagas,
 * preço e quantidade "mudarem sozinhos" quando a página era rolada logo depois
 * de clicar no campo. Aqui o campo simplesmente perde o foco na primeira
 * rolagem — a página rola normal e o valor não muda.
 */
function useSemRodaEmCampoNumerico() {
  useEffect(() => {
    const aoRolar = (e: WheelEvent) => {
      const alvo = document.activeElement as HTMLInputElement | null;
      if (alvo?.tagName === "INPUT" && alvo.type === "number" && alvo === e.target) {
        alvo.blur();
      }
    };
    document.addEventListener("wheel", aoRolar, { passive: true });
    return () => document.removeEventListener("wheel", aoRolar);
  }, []);
}

function App() {
  useSemRodaEmCampoNumerico();

  return (
    <Provider>
      <Suspense fallback={<Carregando texto="Carregando" />}>
        <Switch>
          <Route path="/" component={Index} />
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
          {/* documentação interna: só admin logado (contém detalhes de infra) */}
          <Route path="/setup">
            <AdminRoute>
              <SetupPage />
            </AdminRoute>
          </Route>
          <Route path="/checkout" component={CheckoutPage} />
          <Route path="/termos" component={TermosPage} />
          <Route path="/privacidade" component={PrivacidadePage} />
          <Route path="/tutoriais" component={TutoriaisPage} />
          <Route path="/esqueci-senha" component={EsqueciSenhaPage} />
          <Route path="/redefinir-senha" component={RedefinirSenhaPage} />
          <Route path="/dashboard">
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          </Route>
          <Route path="/admin">
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          </Route>
        </Switch>
      </Suspense>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
    </Provider>
  );
}

export default App;
