/**
 * Data em dd/mm/aaaa digitável de corrida — as barras entram sozinhas.
 *
 * O campo era um `<input type="date">`, que obriga o operador a acertar três
 * subcampos com seta/mouse ou a abrir o calendário para lançar uma despesa de
 * ontem. Quem lança despesa em série digita a data direto do comprovante, e o
 * teclado numérico é o caminho mais rápido: aqui `01082026` vira `01/08/2026`.
 *
 * O valor de fora e para fora continua em ISO (`YYYY-MM-DD`), igual ao
 * `type="date"` que ele substitui — nenhum chamador precisa converter nada. Data
 * incompleta ou impossível (31/02) devolve string vazia, então o `required` do
 * form segue barrando, e o botãozinho de calendário continua disponível para
 * quem prefere apontar.
 */
import { useEffect, useRef, useState } from 'react';

/** "2026-08-01" → "01/08/2026" (e vazio quando não há data). */
const isoParaBr = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/** "01/08/2026" → "2026-08-01". Valida o dia no calendário real: 31/02 e 30/02
 *  não passam (o Date rola para março e a comparação denuncia). */
const brParaIso = (br: string): string => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return '';
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1) return '';
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
};

/** Só dígitos, cortados em 8, com as barras nas posições certas. */
const mascarar = (bruto: string) => {
  const d = (bruto ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

interface Props {
  /** Data em ISO (`YYYY-MM-DD`) ou string vazia. */
  value: string;
  /** Recebe ISO (`YYYY-MM-DD`) ou string vazia enquanto a data não é válida. */
  onChange: (iso: string) => void;
  className?: string;
  required?: boolean;
  id?: string;
}

export function DataInput({ value, onChange, className, required, id }: Props) {
  const [texto, setTexto] = useState(() => isoParaBr(value));
  const ultimoEmitido = useRef(value);

  // Sincroniza quando o valor muda POR FORA (editar uma despesa existente, limpar
  // o formulário). Ignora o eco do próprio onChange, senão a máscara reescreveria
  // o texto no meio da digitação e o cursor pularia.
  useEffect(() => {
    if (value !== ultimoEmitido.current) {
      ultimoEmitido.current = value;
      setTexto(isoParaBr(value));
    }
  }, [value]);

  const digitar = (bruto: string) => {
    const mascarado = mascarar(bruto);
    setTexto(mascarado);
    const iso = brParaIso(mascarado);
    ultimoEmitido.current = iso;
    onChange(iso);
  };

  return (
    <div className="flex gap-1">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        value={texto}
        required={required}
        onChange={(e) => digitar(e.target.value)}
        className={className}
      />
      {/* Escape para quem prefere apontar no calendário; escondido do leitor de
          tela porque duplica o campo acima. */}
      <input
        type="date"
        value={value || ''}
        onChange={(e) => { ultimoEmitido.current = e.target.value; setTexto(isoParaBr(e.target.value)); onChange(e.target.value); }}
        aria-hidden
        tabIndex={-1}
        className="w-9 shrink-0 rounded-lg border border-slate-300 bg-white px-1 text-slate-400"
      />
    </div>
  );
}
