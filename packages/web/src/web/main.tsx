// Entry point referenced by index.html — composition only, real bootstrap
// lives in __main.tsx (template-managed).
import "./__main";
import { registrarServiceWorker } from "./lib/pwa";

registrarServiceWorker();
