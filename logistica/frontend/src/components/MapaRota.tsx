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

export type PrecisaoMapa = 'CEP' | 'LOGRADOURO' | 'BAIRRO' | 'CIDADE' | 'MANUAL';

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
  /** Arrastou o pin para o lugar certo. Sem isso os pins ficam fixos. */
  onCorrigir?: (id: string, lat: number, lng: number) => void;
  altura?: string;
}

const APROXIMADA: readonly PrecisaoMapa[] = ['BAIRRO', 'CIDADE'];
const ehAproximada = (p?: PrecisaoMapa) => p != null && APROXIMADA.includes(p);
const COR_OK = '#0284c7';
const COR_APROX = '#d97706';
const COR_MANUAL = '#059669';
const CENTRO_DEFAULT: [number, number] = [-16.3578, -46.9036]; // Unaí/MG

function iconeParada(n: number, precisao?: PrecisaoMapa): L.DivIcon {
  const aprox = ehAproximada(precisao);
  const manual = precisao === 'MANUAL';
  const cor = manual ? COR_MANUAL : aprox ? COR_APROX : COR_OK;
  const borda = aprox ? `2px dashed ${cor}` : '2px solid #fff';
  const fundo = aprox ? '#fffbeb' : cor;
  const texto = aprox ? cor : '#fff';
  const html = `<div style="transform:translate(-13px,-13px);display:flex;align-items:center;justify-content:center;
    width:26px;height:26px;border-radius:50%;background:${fundo};border:${borda};
    box-shadow:0 1px 4px rgba(0,0,0,.35);font-size:12px;font-weight:700;color:${texto}">${n}</div>`;
  return L.divIcon({ html, className: '', iconSize: [0, 0], iconAnchor: [0, 0] });
}

function iconeOrigem(): L.DivIcon {
  const html = `<div style="transform:translate(-13px,-13px);display:flex;align-items:center;justify-content:center;
    width:26px;height:26px;border-radius:6px;background:#334155;border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,.35);font-size:11px;font-weight:700;color:#fff">🏢</div>`;
  return L.divIcon({ html, className: '', iconSize: [0, 0], iconAnchor: [0, 0] });
}

export function MapaRota({ paradas, origem, semPosicao = 0, onSelecionar, onCorrigir, altura = 'h-[420px]' }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const camadaRef = useRef<L.LayerGroup | null>(null);
  // O callback do arraste vive num ref: o pai o redefine a cada render e, como
  // dependência do efeito, faria os marcadores serem recriados o tempo todo —
  // no meio de um arraste isso derruba o gesto.
  const onCorrigirRef = useRef(onCorrigir);
  onCorrigirRef.current = onCorrigir;
  const podeCorrigir = !!onCorrigir;
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
        .bindPopup('<b>Filial</b><br><span style="color:#64748b">partida e retorno da rota</span>')
        .addTo(camada);
      pontos.push([origem.lat, origem.lng]);
    }

    paradas.forEach((p, i) => {
      const aprox = ehAproximada(p.precisao);
      const latlng: [number, number] = [p.lat, p.lng];
      const m = L.marker(latlng, {
        icon: iconeParada(i + 1, p.precisao),
        zIndexOffset: 100,
        draggable: podeCorrigir,
        autoPan: true,
      }).addTo(camada);
      const estado =
        p.precisao === 'MANUAL'
          ? `<br><span style="color:${COR_MANUAL}">Posição corrigida à mão</span>`
          : aprox
            ? `<br><span style="color:${COR_APROX}">Posição aproximada (${p.precisao === 'CIDADE' ? 'centro da cidade' : 'só o bairro'})<br>o endereço exato não foi encontrado</span>`
            : '<br><span style="color:#64748b">localizada na porta</span>';
      m.bindPopup(
        `<b>${i + 1}. ${p.rotulo}</b>${estado}` +
          (podeCorrigir ? '<br><span style="color:#94a3b8;font-size:11px">arraste o pin para o lugar certo</span>' : ''),
      );
      if (onSelecionar) m.on('click', () => onSelecionar(p.id));
      if (podeCorrigir) {
        m.on('dragend', () => {
          const ll = m.getLatLng();
          onCorrigirRef.current?.(p.id, ll.lat, ll.lng);
        });
      }
      pontos.push(latlng);
    });

    if (pontos.length >= 2) {
      L.polyline(pontos, { color: COR_OK, weight: 3, opacity: 0.65 }).addTo(camada);
    }

    // A VOLTA à filial, tracejada. A rota é um ciclo — o veículo não fica na
    // última entrega —, e o traçado terminava na última parada: "não percebi na
    // rota o caminho para RETORNO" (Clenio, 11/08). Tracejada de propósito: é
    // percurso, não uma parada a mais, e a distinção importa para quem lê o mapa.
    if (origem && pontos.length >= 2) {
      const ultima = pontos[pontos.length - 1];
      L.polyline([ultima, [origem.lat, origem.lng]], {
        color: COR_OK,
        weight: 2.5,
        opacity: 0.5,
        dashArray: '6 8',
      })
        .bindPopup('<b>Retorno à filial</b><br><span style="color:#64748b">a rota fecha onde começou</span>')
        .addTo(camada);
    }

    if (pontos.length && ultimaComposicao.current !== chaveComposicao) {
      map.fitBounds(L.latLngBounds(pontos).pad(0.25), { maxZoom: 16 });
      ultimaComposicao.current = chaveComposicao;
    }
  }, [paradas, origem, onSelecionar, podeCorrigir, chaveComposicao]);

  const aproximadas = paradas.filter((p) => ehAproximada(p.precisao)).length;
  const corrigidas = paradas.filter((p) => p.precisao === 'MANUAL').length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">Mapa da rota ({paradas.length} no mapa)</span>
        <span className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-slate-700" /> Filial</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-capul-600" /> Na porta</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber-600" /> Aproximada</span>
          {corrigidas > 0 && (
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" /> Corrigida</span>
          )}
        </span>
      </div>
      <div ref={elRef} className={`z-0 w-full overflow-hidden ${altura}`} />
      <div className="rounded-b-xl px-4 py-2 text-xs text-slate-400">
        {!origem
          ? 'O endereço da filial não foi localizado — o traçado começa na 1ª parada, não na empresa.'
          : aproximadas > 0
            ? `${aproximadas} pin(s) em âmbar estão aproximados: a posição no mapa não é o endereço real, e foi ela que definiu a ordem.`
            : onCorrigir
              ? 'Arraste um pin para corrigir o endereço — a correção vale para as próximas entregas no mesmo local.'
              : 'O traçado segue a ordem das paradas ao lado — reordene com as setas e o mapa acompanha.'}
        {semPosicao > 0 && ` ${semPosicao} parada(s) sem localização não aparecem no mapa.`}
      </div>
    </div>
  );
}
