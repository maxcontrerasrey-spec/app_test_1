import type { Map as MapLibreMap } from "maplibre-gl";

function createRouteArrowImage(): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No fue posible preparar las flechas de ruta.");
  context.fillStyle = "#4b37c7";
  context.strokeStyle = "#ffffff";
  context.lineWidth = 3;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(5, 7);
  context.lineTo(26, 16);
  context.lineTo(5, 25);
  context.lineTo(9, 16);
  context.closePath();
  context.fill();
  context.stroke();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export function ensurePlannedRouteLayers(map: MapLibreMap) {
  if (!map.getSource("planned-route")) {
    map.addSource("planned-route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer("planned-route-halo")) {
    map.addLayer({ id: "planned-route-halo", type: "line", source: "planned-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 10 } });
  }
  if (!map.getLayer("planned-route-line")) {
    map.addLayer({ id: "planned-route-line", type: "line", source: "planned-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#4b37c7", "line-width": 6 } });
  }
  if (!map.hasImage("planned-route-arrow")) map.addImage("planned-route-arrow", createRouteArrowImage(), { pixelRatio: 2 });
  if (!map.getLayer("planned-route-arrows")) {
    map.addLayer({
      id: "planned-route-arrows",
      type: "symbol",
      source: "planned-route",
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 110,
        "icon-image": "planned-route-arrow",
        "icon-size": 0.72,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      }
    });
  }
}
