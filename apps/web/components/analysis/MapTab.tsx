"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, AlertCircle, MapPin } from "lucide-react";
import dynamic from "next/dynamic";

// Leaflet must be loaded client-side only
const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full gap-2 text-blue-200/50">
    <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Carregando mapa...</span>
  </div>
)});

interface MapPoint {
  city: string;
  lat: number;
  lon: number;
  total: number;
  sem_giaso: number;
  sem_pcdp: number;
  sem_processo: number;
  pendencias: number;
  severity: "low" | "medium" | "high";
}

export default function MapTab({ analysisId }: { analysisId: string }) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total_geocoded: 0, total_cities: 0 });

  useEffect(() => {
    api.get(`/api/v1/analyses/${analysisId}/map-data`)
      .then(d => { setPoints(d.points); setStats({ total_geocoded: d.total_geocoded, total_cities: d.total_cities }); })
      .catch(() => setError("Não foi possível carregar os dados do mapa."))
      .finally(() => setLoading(false));
  }, [analysisId]);

  if (loading) return (
    <div className="bg-white/5 border border-white/10 rounded-xl flex items-center justify-center py-20 gap-2 text-blue-200/50">
      <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Carregando dados do mapa...</span>
    </div>
  );

  if (error) return (
    <div className="bg-white/5 border border-white/10 rounded-xl flex items-center justify-center py-20 gap-2 text-red-400">
      <AlertCircle className="w-5 h-5" /><span className="text-sm">{error}</span>
    </div>
  );

  if (points.length === 0) return (
    <div className="bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center py-20 gap-2 text-blue-200/40">
      <MapPin className="w-8 h-8" />
      <p className="text-sm">Nenhuma cidade identificada com coordenadas disponíveis.</p>
      <p className="text-xs">{stats.total_cities} cidades encontradas, {stats.total_geocoded} geocodificadas.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-blue-200/40 px-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" /> Sem pendências</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Com pendências</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Crítico (&gt;50% pendentes)</span>
        <span className="ml-auto">{stats.total_geocoded} de {stats.total_cities} cidades mapeadas</span>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden" style={{ height: "60vh" }}>
        <MapView points={points} />
      </div>
    </div>
  );
}
