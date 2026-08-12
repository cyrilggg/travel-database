import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "../app/globals.css";
import TravelMap from "../app/components/TravelMap";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Travel map root element is missing");
}

createRoot(root).render(<TravelMap />);
