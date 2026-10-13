# Edição dos textos pelo painel — 07/10/2026

O painel agora tem **Conteúdos do manual**, além da Biblioteca de mídias. Abra um dos tópicos, edite o título do conteúdo e os textos/títulos das seções, e clique em **Salvar conteúdo**. Também é possível adicionar, remover e ordenar seções. Etapas numeradas e critérios continuam apresentados como listas no aplicativo.

O salvamento atualiza as mesmas tabelas que o aplicativo consulta. Abra novamente o tópico ou atualize a página do aplicativo para carregar os novos textos e títulos. Não é necessário recompilar o aplicativo para cada edição.

As seções que não tiveram seu texto/tipo alterado mantêm o negrito e itálico originais do PDF. Ao editar o texto de uma seção, seus parágrafos são reconstruídos em texto simples; dicas permanecem em itálico. Páginas e hash do PDF indicam a origem do material, não uma certificação de fidelidade após alterações administrativas. As seções originalmente ocultas continuam ocultas.

A API aceita edição apenas por administradores, valida todas as seções antes de salvar e faz a atualização em uma transação. Se outro administrador tiver salvo o mesmo conteúdo, a edição antiga é recusada: volte à lista e abra o tópico novamente. A versão anterior é registrada na tabela `logs`, ação `CONTENT_UPDATED`, para recuperação administrativa via banco; não há botão de restauração nesta versão.

## Publicar esta atualização

1. Extraia **atualizacao-textos-painel.zip** na pasta do projeto na hospedagem, substituindo `api`, `admin/dist` e `admin/index.php`. Preserve a conexão já existente em `api/config/local.php`; ela não faz parte do pacote.
2. Atualize o painel com Ctrl+F5 e abra **Conteúdos do manual**.
3. Edite e salve um tópico; confira a aba Conteúdo no aplicativo após atualizar a página.

Esta atualização não precisa de SQL nem de novas tabelas. **Não reimporte `manual-correction.sql` para instalar o editor:** esse arquivo repõe os textos originais do PDF e sobrescreve alterações feitas pelo painel. O pacote específico de textos não contém SQL, credenciais ou uploads.

## Verificação local

- `npm run build` em `admin`: TypeScript e compilação do painel.
- `python tests/contents_tests.py`: autorização, edição de textos e títulos, listas, ordem, inclusão/remoção, formatação preservada, validação, atualização pública e conflito entre edições.
- `python tests/contents_browser.py`: edição pelo navegador, persistência e leitura no aplicativo, com telas de 320, 390, 768 e 1440 px.
- `python tests/manual_fidelity.py`: conferência dos 28 textos originais contra o PDF após os testes. Todos os testes de edição usam tópicos temporários, removidos no final.
