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
        <Route path="/setup" component={SetupPage} />
        <Route path="/checkout" component={CheckoutPage} />
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
