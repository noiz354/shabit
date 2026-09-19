import { render } from "preact";
import "./styles/tokens.css";
import "./styles/app.css";
import "../assets/css/motion.css";
import "../assets/js/capabilities.js"; // single source; window.HWCapabilities
import { initRouter } from "./router.js";

// Scaffold-only: mount + router. Logika fitur (T5–T19) di sesi terpisah.
const root = document.getElementById("app");
render(null, root);
initRouter(root);
