/**
 * Valor em reais digitado da direita para a esquerda — os centavos primeiro.
 *
 * Espelha a máscara que o APP já usa (`logistica/app/src/lib/moeda.ts`): digitar
 * `1` `2` `3` `4` produz `12,34`. O desktop estava com `<input type="number">`, que
 * é outra coisa: obriga a digitar a vírgula (ou ponto — e o separador varia com a
 * localidade do navegador), aceita notação científica, e as setinhas de incremento
 * atrapalham mais do que ajudam em campo de dinheiro. Quem lança despesa em série
 * digita os centavos direto do comprovante.
 *
 * O contrato para fora é o MESMO de antes — string numérica simples (`"1500.50"`,
 * ou `""` quando vazio) — então todos os chamadores seguem fazendo `Number(valor)`
 * sem mudar nada. A máscara vive só dentro do componente.
 */
import { useEffect, useRef, useState } from 'react';

const soDigitos = (v: string) => (v ?? '').replace(/\D/g, '');

/** Dígitos (centavos) → "1.500,50". Vazio quando não há dígito. */
const mascarar = (bruto: string): string => {
  const d = soDigitos(bruto).replace(/^0+/, '').slice(0, 11);
  if (!d) return '';
  const p = d.padStart(3, '0');
  const centavos = p.slice(-2);
  const inteiro = p.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiro},${centavos}`;
};

/** Texto mascarado → string numérica simples ("1500.50"). Lê os dígitos como centavos. */
const paraNumero = (mascarado: string): string => {
  const d = soDigitos(mascarado);
  return d ? (Number(d) / 100).toFixed(2) : '';
};

/** Valor numérico vindo de fora ("50", "1500.5", 50) → texto mascarado. */
const doNumero = (v: string): string => {
  if (v === '' || v == null) return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return mascarar(String(Math.round(n * 100)));
};

interface Props {
  /** String numérica simples (`"1500.50"`) ou vazia. */
  value: string;
  /** Recebe string numérica simples (`"1500.50"`) ou vazia. */
  onChange: (valor: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export function MoedaInput({ value, onChange, className, placeholder = 'R$ 0,00', required, disabled, id }: Props) {
  const [texto, setTexto] = useState(() => doNumero(value));
  const ultimoEmitido = useRef(value);

  // Sincroniza quando o valor muda POR FORA (abrir uma despesa para editar, limpar o
  // formulário). Ignora o eco do próprio onChange, senão a máscara reescreveria o
  // texto no meio da digitação e o cursor pularia.
  useEffect(() => {
    if (value !== ultimoEmitido.current) {
      ultimoEmitido.current = value;
      setTexto(doNumero(value));
    }
  }, [value]);

  const digitar = (bruto: string) => {
    const mascarado = mascarar(bruto);
    setTexto(mascarado);
    const numero = paraNumero(mascarado);
    ultimoEmitido.current = numero;
    onChange(numero);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={texto}
      required={required}
      disabled={disabled}
      onChange={(e) => digitar(e.target.value)}
      className={className}
    />
  );
}
