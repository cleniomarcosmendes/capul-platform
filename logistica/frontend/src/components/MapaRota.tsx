import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Mapa da MONTAGEM da rota: pins numerados na ordem das paradas + traçado
// ligando filial → 1 → 2 → … Leaflet PURO (imperativo), mesmo padrão do
// MapaFrota — sem react-leaflet, pra não brigar com peer-deps do React 19.
//
// O mapa mostra o que o ALGORITMO enxergou, não a verdade do endereço: parada
// cuja coordenada veio de fallback (bairro/município) é desenhada em âmbar e
// tracejada, para o operador não confundir um pin chutado com um pin certo. É
// justamente esse caso que faz uma entrega vizinha da empresa cair no fim da
// rota — ver rota.service.ts.

export type PrecisaoMapa = 'CEP' | 'LOGRADOURO' | 'BAIRRO' | 'CIDADE';

export interface ParadaMapa {
  id: string;
  rotulo: string;
  lat: number;
  lng: number;
  precisao?: PrecisaoMapa;
}

interface Props {
  paradas: ParadaMapa[];
  origem: { lat: number; lng: number } | null;
  /** Paradas na rota que não têm coordenada — só para informar no rodapé. */
  semPosicao?: number;
  onSelecionar?: (id: string) => void;
  altura?: string;
}

const APROXIMADA: readonly PrecisaoMapa[] = ['BAIRRO', 'CIDADE'];
const ehAproximada = (p?: PrecisaoMapa) => p != null && APROXIMADA.includes(p);
const COR_OK = '#0284c7';
const COR_APROX = '#d97706';
const CENTRO_DEFAULT: [number, number] = [-16.3578, -46.9036]; // Unaí/MG

function iconeParada(n: number, aproximada: boolean): L.DivIcon {
  const cor = aproximada ? COR_APROX : COR_OK;
  const borda = aproximada ? `2px dashed ${cor}` : '2px solid #fff';
  const html = `<div style="transform:translate(-13px,-13px);display:flex;align-items:center;justify-content:center;
    width:26px;height:26px;border-radius:50%;background:${aproximada ? '#fffbeb' : cor};border:${borda};
    box-shadow:0 1px 4px rgba(0,0,0,.35);font-size:12px;font-weight:700;color:${aproximada ? cor : '#fff'}">${n}</div>`;
  return L.divIcon({ html, className: '', iconSize: [0, 0], iconAnchor: [0, 0] });
}

function iconeOrigem(): L.DivIcon {
  const html = `<div style="transform:translate(-13px,-13px);display:flex;align-items:center;justify-content:center;
    width:26px;height:26px;border-radius:6px;background:#334155;border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,.35);font-size:11px;font-weight:700;color:#fff">🏢</div>`;
  return L.divIcon({ html, className: '', iconSize: [0, 0], iconAnchor: [0, 0] });
}

export function MapaRota({ paradas, origem, semPosicao = 0, onSelecionar, altura = 'h-[420px]' }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const camadaRef = useRef<L.LayerGroup | null>(null);
  // Fita só quando a COMPOSIÇÃO muda; reordenar não deve mexer no zoom que o
  // operador ajustou (senão o mapa "pula" a cada clique nas setas).
  const chaveComposicao = useMemo(
    () => [...paradas.map((p) => p.id)].sort().join('|') + `#${origem ? 'F' : '-'}`,
    [paradas, origem],
  );
  const ultimaComposicao = useRef<string>('');

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true }).setView(CENTRO_DEFAULT, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    camadaRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      camadaRef.current = null;
      ultimaComposicao.current = '';
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const camada = camadaRef.current;
    if (!map || !camada) return;
    camada.clearLayers();

    const pontos: [number, number][] = [];
    if (origem) {
      L.marker([origem.lat, origem.lng], { icon: iconeOrigem(), zIndexOffset: 500 })
        .bindPopup('<b>Filial</b><br><span style="color:#64748b">partida da rota</span>')
        .addTo(camada);
      pontos.push([origem.lat, origem.lng]);
    }

    paradas.forEach((p, i) => {
      const aprox = ehAproximada(p.precisao);
      const latlng: [number, number] = [p.lat, p.lng];
      const m = L.marker(latlng, { icon: iconeParada(i + 1, aprox), zIndexOffset: 100 }).addTo(camada);
      m.bindPopup(
        `<b>${i + 1}. ${p.rotulo}</b>` +
          (aprox
            ? `<br><span style="color:${COR_APROX}">Posição aproximada (${p.precisao === 'CIDADE' ? 'centro da cidade' : 'só o bairro'})<br>o endereço exato não foi encontrado</span>`
            : '<br><span style="color:#64748b">localizada na porta</span>'),
      );
      if (onSelecionar) m.on('click', () => onSelecionar(p.id));
      pontos.push(latlng);
    });

    if (pontos.length >= 2) {
      L.polyline(pontos, { color: COR_OK, weight: 3, opacity: 0.65 }).addTo(camada);
    }

    if (pontos.length && ultimaComposicao.current !== chaveComposicao) {
      map.fitBounds(L.latLngBounds(pontos).pad(0.25), { maxZoom: 16 });
      ultimaComposicao.current = chaveComposicao;
    }
  }, [paradas, origem, onSelecionar, chaveComposicao]);

  const aproximadas = paradas.filter((p) => ehAproximada(p.precisao)).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">Mapa da rota ({paradas.length} no mapa)</span>
        <span className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-slate-700" /> Filial</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-capul-600" /> Na porta</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber-600" /> Aproximada</span>
        </span>
      </div>
      <div ref={elRef} className={`z-0 w-full overflow-hidden ${altura}`} />
      <div className="rounded-b-xl px-4 py-2 text-xs text-slate-400">
        {!origem
          ? 'O endereço da filial não foi localizado — o traçado começa na 1ª parada, não na empresa.'
          : aproximadas > 0
            ? `${aproximadas} pin(s) em âmbar estão aproximados: a posição no mapa não é o endereço real, e foi ela que definiu a ordem.`
            : 'O traçado segue a ordem das paradas ao lado — reordene com as setas e o mapa acompanha.'}
        {semPosicao > 0 && ` ${semPosicao} parada(s) sem localização não aparecem no mapa.`}
      </div>
    </div>
  );
}
