# Painel de gestão — atualização de 06/10/2026

## O que está disponível

- **Visão geral:** tráfego do site em 7, 30 ou 90 dias, páginas mais visitadas, divisão celular/computador, novos clientes, clientes Premium ativos, biblioteca, parceiros, campanhas vigentes e últimas ações administrativas.
- **Clientes:** listagem paginada, busca por nome/e-mail e filtros de perfil, acesso e situação. Cadastro e ficha individual com edição, favoritos, sessões válidas e histórico. O administrador pode liberar/retirar Premium, bloquear/reativar e redefinir a senha.
- **Mídias:** biblioteca e editor existentes.
- **Conteúdos do manual:** edição dos títulos, textos e etapas dos tópicos, inclusão/remoção e ordem das seções. Salvamento no banco usado pelo aplicativo; detalhes e pacote sem SQL em [textos-painel.md](textos-painel.md).
- **Parcerias e anúncios:** cadastro de parceiros, campanhas, locais, agenda, publicação, pausa, imagens e ajustes AdSense/AdMob.
- **Configurações:** nome do app, aviso educacional, apresentação do Premium, suporte, privacidade, termos e registro de visitas. Minha conta permite alterar nome, e-mail e senha do próprio administrador.

As alterações de senha pelo administrador não pedem a senha anterior. A nova senha exige confirmação na interface e validação no servidor. Senhas usam hash e nunca retornam na API. Redefinir a senha de um cliente revoga todos os seus tokens; trocar a própria senha administrativa revoga as outras sessões e mantém a sessão atual. Bloquear uma conta ou trocar o e-mail do cliente também revoga os tokens. Administradores listados na área de clientes têm ficha de consulta; o próprio administrador é editado em Minha conta.

Premium liberado pelo painel é uma autorização manual, sem cobrança ou simulação de pagamento. A API confere o acesso atualizado em cada requisição. O site atualiza o perfil ao voltar à aba do navegador; atualizar a página também recarrega o estado.

## Aplicar na hospedagem existente

O pacote `api/storage/atualizacao-painel.zip` é criado por `python scripts/package-panel-update.py`. Contém API, painel compilado, site compilado e a migração. Não contém credenciais, `api/config/local.php`, armazenamento privado, banco exportado, uploads ou APK.

1. No phpMyAdmin, selecione o banco que a API já utiliza e importe **database/management.sql**, fornecido no pacote. Ele cria somente `analytics_events`; não apaga clientes nem outras tabelas. Não execute novamente `schema.sql` para esta atualização.
2. Extraia o pacote na pasta **public_html/app_mamografia**, mantendo as pastas `api`, `admin/dist` e `preview`. Substitua os arquivos existentes. A conexão já configurada em `api/config/local.php` fica preservada.
3. Abra **https://testes-techcode.shop/app_mamografia/admin/** e atualize com **Ctrl+F5**. A entrada do painel passa a ser Visão geral.
4. Navegue no site em uma janela separada sem autenticação administrativa. Volte ao painel e clique em Atualizar métricas. As visitas começam nesta atualização; não há histórico anterior reconstruído.

O pacote completo atualizado também contém `database/manual-correction.sql`. Use esse SQL somente para repor os textos originais do PDF, conforme `atualizacao-textos-pdf.md`: ele sobrescreve as edições de texto feitas pelo painel. A instalação do editor de textos não requer SQL; use o pacote específico `atualizacao-textos-painel.zip`. `management.sql` cria apenas a tabela de métricas.

O SQL pode ficar apenas no computador depois da importação. A API exige as tabelas de parcerias da entrega anterior. Sem a tabela de métricas, a visão geral informa a migração pendente e as demais áreas continuam funcionando; o site ignora a coleta indisponível.

Localmente: `php scripts/migrate-management.php`. A instalação inicial `scripts/setup.php` também cria a tabela de métricas.

## Como as métricas são medidas

Somente o site registra páginas: início, biblioteca, favoritos, perfil, tópicos, categorias e parceiros. O app nativo não participa desta contagem. Cada entrada em uma tela gera um evento com ID exclusivo; repetir esse ID não aumenta a contagem. Não são contadas imagens de miniatura, requisições de vídeo/Range ou renderizações repetidas da mesma tela. Abrir outro tópico/categoria conta como nova página, e busca não gera uma visita adicional.

O navegador mantém um identificador aleatório em armazenamento local. O servidor salva apenas seu hash HMAC, a seção, o tipo de dispositivo e a data UTC. Não salva IP, e-mail, nome, URL completa ou busca. “Visitantes” significa navegadores distintos, não pessoas identificadas; limpar o armazenamento ou usar outro navegador cria um novo identificador. Celular/computador é uma classificação pela largura abaixo/acima de 800 px. Contas administrativas autenticadas são excluídas da coleta. A coleta pode ser pausada em Configurações sem apagar o histórico.

Última entrada é registrada pelos logins a partir desta atualização. Sessões válidas são tokens não expirados, não uma medição de pessoas online. Receita, vendas e impressões/cliques de anúncios não são estimados nesta entrega.

## Verificação

`tests/management_tests.py` verifica autorização, validação, edição de clientes, concessão/revogação de Premium, bloqueio, redefinição de senha, revogação de sessões, configurações, senha administrativa, tráfego e deduplicação. As contas usadas são temporárias.

`tests/management_browser.py` exercita cadastro, busca, ficha, acesso, senhas, configurações e anúncios pelo painel. Confere 320, 390, 768, 1024 e 1440 px, e confirma que o site usa os textos/links configurados e envia visitas reais. Capturas em `test-results/management-*.png`. Nenhuma conta real tem senha alterada durante os testes.
