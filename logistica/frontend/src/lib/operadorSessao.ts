// Cache em memória do OPERADOR identificado (login PADRAO/caixa): matrícula+senha
// validadas 1x por sessão da aplicação, reaproveitadas nas próximas entregas pra
// não pedir senha a cada cadastro. NÃO persiste (some no reload/logout). A senha
// fica só em memória e é reenviada ao backend (que revalida) a cada criação.
export interface OperadorSessao {
  matricula: string;
  senha: string;
  nome: string;
}

let operador: OperadorSessao | null = null;

export const getOperador = (): OperadorSessao | null => operador;
export const setOperador = (o: OperadorSessao): void => {
  operador = o;
};
export const limparOperador = (): void => {
  operador = null;
};
