import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './layouts/Layout';
import MinhasAvaliacoesPage from './pages/MinhasAvaliacoesPage';
import AvaliacaoResponderPage from './pages/AvaliacaoResponderPage';
import CiclosPage from './pages/CiclosPage';
import CicloPage from './pages/CicloPage';
import AplicacoesPage from './pages/AplicacoesPage';
import DesignacaoPage from './pages/DesignacaoPage';
import CadastroAvaliadoresPage from './pages/CadastroAvaliadoresPage';
import PainelPage from './pages/PainelPage';
import ResultadosPage from './pages/ResultadosPage';

/**
 * ⭐⭐ A RAIZ DO MÓDULO É A FILA, PARA TODO MUNDO — sem desvio por papel.
 *
 * Havia aqui um redirect: quem NÃO tinha o papel `AVALIADOR` e era do RH ia
 * direto para `/ciclos`. Ele decidia por PAPEL, e a gestora de RH tem 13
 * avaliações com `RH_ADMIN` e nenhum `AVALIADOR` — então o clique em "Minhas
 * avaliações" caía em `/`, era desviado para `/ciclos`, e **a fila dela ficava
 * inalcançável pela tela**: item de menu existindo, rota existindo, e nenhum
 * jeito de chegar. Vale o mesmo por URL direta. É o mesmo defeito da §3.1.3,
 * uma camada abaixo do menu — a regra "ser avaliador é fato do DADO, não papel"
 * tinha sido aplicada ao menu e não a este desvio.
 *
 * ⚠️ E o motivo pelo qual ele existia **deixou de existir em 07/09**: ele era
 * remendo para o menu que sumia quando havia um destino só. Com a sidebar
 * permanente, quem é do RH e não tem fila vê "Ciclos" e "Quem avalia quem" ao
 * lado da tela vazia — que agora ainda oferece o atalho. Não recriar o desvio.
 */

export default function App() {
  return (
    <BrowserRouter basename="/gestao-pessoas">
      <AuthProvider>
        <Routes>
          {/* A tela de resposta fica FORA do Layout de propósito: ela já tem
              cabeçalho próprio, com o nome de quem está sendo avaliado, o
              progresso e o botão voltar. Empilhar os dois custava ~90px de uma
              tela de celular — espaço que, respondendo em pé no corredor da
              loja, é uma alternativa a menos visível por vez. */}
          <Route path="/avaliacao/:id" element={<AvaliacaoResponderPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<MinhasAvaliacoesPage />} />
            <Route path="/ciclos" element={<CiclosPage />} />
            {/* Fora de `/ciclos/:id` de propósito: o cadastro de quem avalia
                quem é da PLATAFORMA, não do ciclo — cada ciclo copia dele. Pendurá-lo
                numa aba do ciclo faria parecer que se remonta a cada ano. */}
            <Route path="/avaliadores" element={<CadastroAvaliadoresPage />} />
            {/* As quatro telas do RH são ETAPAS do mesmo ciclo, não seções
                soltas — por isso são rotas filhas, e o ciclo escolhido não se
                perde ao trocar de aba. */}
            <Route path="/ciclos/:cicloId" element={<CicloPage />}>
              <Route index element={<Navigate to="aplicacoes" replace />} />
              <Route path="aplicacoes" element={<AplicacoesPage />} />
              <Route path="designacao" element={<DesignacaoPage />} />
              <Route path="painel" element={<PainelPage />} />
              <Route path="resultados" element={<ResultadosPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
