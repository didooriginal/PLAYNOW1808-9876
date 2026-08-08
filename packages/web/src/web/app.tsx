import { Route, Switch } from "wouter";
import Index from "./pages/index";
import DashboardPage from "./pages/dashboard";
import AdminPage from "./pages/admin";
import LoginPage from "./pages/login";
import SignupPage from "./pages/signup";
import { Provider } from "./components/provider";
import { AdminRoute, ProtectedRoute } from "./components/protected-route";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
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
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
