import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ROLES } from './lib/roles';
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
 * ⚠️ Papel sem caminho até a tela é papel inútil.
 *
 * A raiz do módulo é a fila do AVALIADOR — mas quem é só do RH não tem fila, e
 * a barra de navegação não aparece para ele (um item só é rótulo, não menu).
 * Sem este desvio a gestora caía numa lista vazia sem link nenhum para os
 * ciclos: nada de errado no log, nenhum 403, e a tela do trabalho dela
 * inalcançável. É o mesmo defeito que deixou `REGISTRADOR_FROTA` com "só
 * Início" na Logística.
 */
function Inicio() {
  const { carregando, tem } = useAuth();
  if (carregando) return null;
  if (!tem(ROLES.AVALIADOR) && tem(ROLES.RH_ADMIN, ROLES.RH_CICLO, ROLES.RH_MODELO)) {
    return <Navigate to="/ciclos" replace />;
  }
  return <MinhasAvaliacoesPage />;
}

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
            <Route path="/" element={<Inicio />} />
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
