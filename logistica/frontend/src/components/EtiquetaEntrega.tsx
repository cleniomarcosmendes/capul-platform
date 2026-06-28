import { maskCep, maskTelefone } from '../utils/format';

export interface EntregaEtiqueta {
  numero: number;
  destinatarioNome: string;
  telefone?: string | null;
  endLogradouro: string;
  endNumero?: string | null;
  endComplemento?: string | null;
  endBairro?: string | null;
  endCidade?: string | null;
  endUf?: string | null;
  endCep?: string | null;
  endReferencia?: string | null;
  quantidadeVolumes: number;
  observacoes?: string | null;
}

/** Uma etiqueta (1 por página na impressão). Layout autossuficiente via classe .etiqueta. */
export function EtiquetaEntrega({
  entrega, sequencia, totalParadas, placa, viagemNumero, filialLabel,
}: {
  entrega: EntregaEtiqueta;
  sequencia?: number;
  totalParadas?: number;
  placa?: string;
  viagemNumero?: number;
  filialLabel?: string;
}) {
  const e = entrega;
  const linha2 = [e.endBairro, [e.endCidade, e.endUf].filter(Boolean).join('/')].filter(Boolean).join(' · ');
  return (
    <div className="etiqueta">
      <div className="etq-topo">
        <div className="etq-marca">CAPUL · Entrega</div>
        <div className="etq-numero">#{e.numero}</div>
      </div>

      {(sequencia || viagemNumero || placa) && (
        <div className="etq-viagem">
          {viagemNumero ? `Rota #${viagemNumero}` : ''}
          {placa ? ` · ${placa}` : ''}
          {sequencia ? ` · parada ${sequencia}${totalParadas ? `/${totalParadas}` : ''}` : ''}
        </div>
      )}

      <div className="etq-dest">{e.destinatarioNome}</div>
      {e.telefone && <div className="etq-tel">{maskTelefone(e.telefone)}</div>}

      <div className="etq-end">
        {e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''}{e.endComplemento ? ` — ${e.endComplemento}` : ''}
        {linha2 && <><br />{linha2}</>}
        {e.endCep && <><br />CEP {maskCep(e.endCep)}</>}
        {e.endReferencia && <div className="etq-ref">Ref.: {e.endReferencia}</div>}
      </div>

      <div className="etq-rodape">
        <div className="etq-vol">Volumes: <b>{e.quantidadeVolumes}</b></div>
        {filialLabel && <div className="etq-filial">{filialLabel}</div>}
      </div>

      {e.observacoes && <div className="etq-obs">Obs.: {e.observacoes}</div>}
    </div>
  );
}
