import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "./style.css";
import { Dashboard } from "./Dashboard";

createRoot(document.getElementById("root")!).render(<Dashboard />);
