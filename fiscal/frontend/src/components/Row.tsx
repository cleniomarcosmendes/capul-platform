/**
 * Row — pequeno componente reutilizado em todas as páginas de consulta para
 * exibir par label/value em grid de 2 colunas. Antes estava duplicado em
 * NfeConsultaPage, CteConsultaPage e CadastroConsultaPage.
 */

interface RowProps {
  label: string;
  value: string;
  /** Ocupa as 2 colunas do grid pai. */
  wide?: boolean;
}

export function Row({ label, value, wide = false }: RowProps) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value}</dd>
    </div>
  );
}
