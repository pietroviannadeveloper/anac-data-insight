"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface MapPoint {
  city: string; lat: number; lon: number;
  total: number; sem_giaso: number; sem_pcdp: number; sem_processo: number;
  pendencias: number; severity: "low" | "medium" | "high";
}

const SEVERITY_COLOR = {
  low:    "#34d399",  // emerald
  medium: "#fbbf24",  // amber
  high:   "#f87171",  // red
};

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const lats = points.map(p => p.lat);
    const lons = points.map(p => p.lon);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]],
      { padding: [40, 40], maxZoom: 7 }
    );
  }, [points, map]);
  return null;
}

export default function MapView({ points }: { points: MapPoint[] }) {
  const maxTotal = Math.max(...points.map(p => p.total), 1);

  return (
    <MapContainer
      center={[-15.78, -47.93]}
      zoom={4}
      style={{ height: "100%", width: "100%", background: "#0d1f3c" }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      <FitBounds points={points} />
      {points.map((p, i) => {
        const radius = 6 + (p.total / maxTotal) * 18;
        const color  = SEVERITY_COLOR[p.severity];
        return (
          <CircleMarker
            key={i}
            center={[p.lat, p.lon]}
            radius={radius}
            pathOptions={{ fillColor: color, fillOpacity: 0.75, color: color, weight: 1.5, opacity: 0.9 }}
          >
            <Popup>
              <div style={{ minWidth: 180, fontFamily: "Arial, sans-serif" }}>
                <strong style={{ fontSize: 13 }}>{p.city}</strong>
                <hr style={{ margin: "6px 0", borderColor: "#e2e8f0" }} />
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <tbody>
                    <tr><td>Total</td><td align="right"><b>{p.total}</b></td></tr>
                    <tr><td>Sem GIASO</td><td align="right" style={{ color: p.sem_giaso > 0 ? "#dc2626" : "#16a34a" }}>{p.sem_giaso}</td></tr>
                    <tr><td>Sem PCDP</td><td align="right" style={{ color: p.sem_pcdp > 0 ? "#d97706" : "#16a34a" }}>{p.sem_pcdp}</td></tr>
                    <tr><td>Sem processo</td><td align="right" style={{ color: p.sem_processo > 0 ? "#d97706" : "#16a34a" }}>{p.sem_processo}</td></tr>
                    <tr><td><b>Pendências</b></td><td align="right"><b style={{ color: p.pendencias > 0 ? "#dc2626" : "#16a34a" }}>{p.pendencias}</b></td></tr>
                  </tbody>
                </table>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
