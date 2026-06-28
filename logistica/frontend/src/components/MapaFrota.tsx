import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { logisticaApi } from '../services/api';

// Mapa ao vivo das viagens em curso (Fase A). Leaflet PURO (imperativo) — sem
// react-leaflet, pra não brigar com peer-deps do React 19. Tiles do
// OpenStreetMap (grátis, sem chave). Polling próprio (não infla o painel).

interface Ativo {
  viagemId: string;
  numero: number;
  tipo: 'ENTREGA' | 'FROTA';
  condutor: string | null;
  veiculoPlaca: string | null;
  veiculoModelo: string | null;
  dataHoraSaida: string | null;
  posicao: {
    latitude: number;
    longitude: number;
    precisao: number | null;
    velocidade: number | null;
    bateria: number | null;
    capturadoEm: string;
  } | null;
}

const REFRESH_MS = 12_000;
// Unaí/MG aproximado — centro inicial quando ainda não há nenhuma posição.
const CENTRO_DEFAULT: [number, number] = [-16.3578, -46.9036];

const desde = (s: string) => {
  const min = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (min <= 0) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h${String(min % 60).padStart(2, '0')}`;
};

function iconeVeiculo(cor: string, label: string): L.DivIcon {
  const html = `<div style="display:flex;align-items:center;gap:4px;transform:translate(-9px,-9px)">
    <span style="width:18px;height:18px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>
    <span style="background:#fff;padding:1px 5px;border-radius:5px;font-size:11px;font-weight:600;color:#334155;box-shadow:0 1px 3px rgba(0,0,0,.25);white-space:nowrap">${label}</span>
  </div>`;
  return L.divIcon({ html, className: '', iconSize: [0, 0], iconAnchor: [0, 0] });
}

export function MapaFrota() {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, L.Marker>>(new globalThis.Map());
  const fezFit = useRef(false);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [erro, setErro] = useState(false);

  // Inicializa o mapa uma vez.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true }).setView(CENTRO_DEFAULT, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    // Cópia local da ref para o cleanup (a ref pode mudar antes dele rodar).
    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
      fezFit.current = false;
    };
  }, []);

  // Polling das posições ativas.
  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const { data } = await logisticaApi.get<Ativo[]>('/rastreamento/ativos');
        if (!vivo) return;
        setAtivos(data);
        setErro(false);
      } catch {
        if (vivo) setErro(true);
      }
    };
    void carregar();
    const t = setInterval(carregar, REFRESH_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  // Sincroniza marcadores quando as posições mudam.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const comGps = ativos.filter((a) => a.posicao);
    const vistos = new Set<string>();

    for (const a of comGps) {
      const pos = a.posicao!;
      vistos.add(a.viagemId);
      const cor = a.tipo === 'ENTREGA' ? '#0284c7' : '#16a34a';
      const label = a.veiculoPlaca ?? `#${a.numero}`;
      const latlng: [number, number] = [pos.latitude, pos.longitude];
      const popup = `<b>${label}</b><br>${a.condutor ?? '—'}<br>` +
        `<span style="color:#64748b">${a.tipo === 'ENTREGA' ? 'Entrega' : 'Frota'} · ${desde(pos.capturadoEm)}</span>` +
        (pos.velocidade != null ? `<br>${Math.round(pos.velocidade * 3.6)} km/h` : '') +
        (pos.bateria != null ? ` · 🔋 ${pos.bateria}%` : '');

      let m = markersRef.current.get(a.viagemId);
      if (!m) {
        m = L.marker(latlng, { icon: iconeVeiculo(cor, label) }).addTo(map);
        markersRef.current.set(a.viagemId, m);
      } else {
        m.setLatLng(latlng);
        m.setIcon(iconeVeiculo(cor, label));
      }
      m.bindPopup(popup);
    }

    // Remove marcadores de viagens que saíram da lista.
    for (const [id, m] of markersRef.current) {
      if (!vistos.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }

    // Enquadra todo mundo na primeira carga com GPS.
    if (!fezFit.current && comGps.length > 0) {
      const bounds = L.latLngBounds(comGps.map((a) => [a.posicao!.latitude, a.posicao!.longitude] as [number, number]));
      map.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
      fezFit.current = true;
    }
  }, [ativos]);

  const semGps = ativos.filter((a) => !a.posicao).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">Mapa ao vivo ({ativos.length} em curso)</span>
        <span className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-capul-600" /> Entrega</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" /> Frota</span>
        </span>
      </div>
      <div ref={elRef} className="z-0 h-[420px] w-full overflow-hidden rounded-b-xl" />
      <div className="px-4 py-2 text-xs text-slate-400">
        {erro
          ? 'Não foi possível atualizar as posições agora — tentando de novo.'
          : semGps > 0
            ? `${semGps} rota(s) em curso sem GPS recebido ainda (app fechado ou sem sinal).`
            : 'Atualiza automaticamente. Localização ativa só durante a rota.'}
      </div>
    </div>
  );
}
