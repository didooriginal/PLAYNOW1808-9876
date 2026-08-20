import { Suspense, lazy, useEffect } from "react";
import { Route, Switch } from "wouter";
import Index from "./pages/index";
import { Provider } from "./components/provider";
import { AdminRoute, Carregando, ProtectedRoute } from "./components/protected-route";

/**
 * CODE SPLITTING.
 * SO a landing fica no bundle principal — e a unica pagina que praticamente
 * toda visita abre, e no iPhone cada kB de JS a mais custa tempo de tela branca
 * (o Safari e bem mais lento que o Chrome para interpretar JS).
 *
 * Todo o resto vira chunk separado e baixa junto do clique: login, cadastro,
 * recuperacao de senha, painel do cliente, painel admin, checkout e paginas
 * institucionais. Medido em iPhone/4G: as telas de auth sozinhas custavam
 * ~31 kB de JS em TODA visita a home, inclusive de quem nunca faz login.
 *
 * O AgentFeedback (website-runtime) tambem sai do bundle: ele so roda em DEV,
 * mas o import estatico arrastava ~40 kB para producao.
 */
const LoginPage = lazy(() => import("./pages/login"));
const SignupPage = lazy(() => import("./pages/signup"));
const EsqueciSenhaPage = lazy(() => import("./pages/esqueci-senha"));
const RedefinirSenhaPage = lazy(() => import("./pages/redefinir-senha"));
const DashboardPage = lazy(() => import("./pages/dashboard"));
const AdminPage = lazy(() => import("./pages/admin"));
const SetupPage = lazy(() => import("./pages/setup"));
const CheckoutPage = lazy(() => import("./pages/checkout"));
const TermosPage = lazy(() => import("./pages/termos"));
const PrivacidadePage = lazy(() => import("./pages/privacidade"));
const TutoriaisPage = lazy(() => import("./pages/tutoriais"));

/* Do not remove — off by default, activated by parent iframe via postMessage.
   Carregado sob demanda para nao pesar o bundle de producao. */
const AgentFeedback = lazy(() =>
  import("@runablehq/website-runtime").then((m) => ({ default: m.AgentFeedback })),
);

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
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <AgentFeedback />
        </Suspense>
      )}
    </Provider>
  );
}

export default App;
