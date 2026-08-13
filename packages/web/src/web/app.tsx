import { Route, Switch } from "wouter";
import Index from "./pages/index";
import DashboardPage from "./pages/dashboard";
import AdminPage from "./pages/admin";
import LoginPage from "./pages/login";
import SignupPage from "./pages/signup";
import SetupPage from "./pages/setup";
import CheckoutPage from "./pages/checkout";
import EsqueciSenhaPage from "./pages/esqueci-senha";
import RedefinirSenhaPage from "./pages/redefinir-senha";
import TermosPage from "./pages/termos";
import PrivacidadePage from "./pages/privacidade";
import TutoriaisPage from "./pages/tutoriais";
import { Provider } from "./components/provider";
import { AdminRoute, ProtectedRoute } from "./components/protected-route";
import { AgentFeedback } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
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
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
    </Provider>
  );
}

export default App;
