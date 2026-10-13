# Verificação — 05/10/2026

## Fidelidade integral ao PDF — 06/10/2026

- Transcrição refeita dos 28 tópicos e 142 blocos do PDF original de 27 páginas, mantendo palavras, pontuação, acentos, números e capitalização. A comparação normaliza somente espaços de diagramação.
- `manual_fidelity.py`: quatro cenários aprovados. Uma extração independente de texto simples do PDF foi comparada ao fluxo completo efetivamente servido pela API. Verificados também cada tópico, os metadados de origem, ML/LM, ângulos, compressão, marcadores, aviso compartilhado, rodapé e a numeração 1–4 das duas rotações.
- `manual_browser.py`: todos os blocos dos 28 tópicos renderizados foram comparados aos dados da API. Conferidos navegação, retorno, resposta lenta de MLO, listas e duas rotações, sem erros JavaScript ou overflow em 390 px. Inspecionadas capturas de texto no celular e no desktop.
- O tópico e a categoria passaram a ser derivados da rota. A tela só exibe o conteúdo que corresponde ao ID atual; não reaproveita o texto anterior sob outro título durante a troca.
- `manual-correction.sql` executado duas vezes localmente e comparação integral aprovada depois da importação: 142 blocos, sem duplicação. Atualização em transação e restrita aos textos, vínculos/títulos/páginas dos 28 tópicos originais e aviso educacional. Backup privado dos textos anteriores preservado.
- Typecheck e lint mobile aprovados; versão web exportada; sintaxe PHP e Python dos arquivos alterados aprovada. Os cinco testes da biblioteca/API anteriores continuam aprovados. Sem APK/AAB e sem commit.
- Na hospedagem, a correção depende de importar `database/manual-correction.sql` e enviar o pacote de atualização. A comparação realizada foi no banco/API e navegador locais; não foi alterado o banco remoto.

Relatório por tópico: `docs/conferencia-textos-pdf.md`. Implantação: `docs/atualizacao-textos-pdf.md`. Capturas: `test-results/manual-topic-3-mobile.png`, `manual-topic-13-mobile.png`, `manual-topic-24-mobile.png`, `manual-topic-27-mobile.png` e `manual-rotation-desktop.png`.

## Correção do filtro de acesso na hospedagem — 06/10/2026

- No domínio publicado, `/health`, `/categories`, `/stats` e `/media?type=VIDEO&limit=1` responderam HTTP 200. As consultas de mídia com `access=FREE` ou `access=PREMIUM` responderam HTTP 500, isolando a falha no filtro SQL de acesso. O erro SQL exato depende do log PHP da hospedagem.
- `api/controllers/library.php` passou a filtrar as flags de acesso diretamente, evitando comparar o texto calculado por `IF` com um parâmetro PDO. Mantida a restrição Premium herdada de tópico e categoria, incluindo relacionamentos ausentes.
- Sintaxe PHP aprovada e cinco testes locais da API aprovados. A regressão cobre vídeo gratuito, filtros FREE/PREMIUM, herança de categoria Premium e consulta administrativa.
- Aplicação na hospedagem: substituir apenas `public_html/app_mamografia/api/controllers/library.php` e repetir a consulta original. Não exige alteração de banco, configuração ou build. A correção publicada ainda precisa ser verificada após o envio do arquivo.
- Se o erro persistir, consultar o log PHP da hospedagem pela entrada `[Mamografia]`, que registra a exceção sem expor detalhes na resposta pública.

## Gestão de clientes, métricas e configurações — 06/10/2026

- Painel passou a iniciar em Visão geral e reúne Clientes, Mídias, Parcerias/anúncios e Configurações. Os novos itens têm dados e operações reais.
- Quatro cenários de integração da gestão aprovados: permissões/validação, ficha e acesso Premium, bloqueio/revogação de sessões/senhas, configurações e métricas/deduplicação. Testados conta gratuita, Premium e administrador; nenhuma senha de conta real foi alterada.
- Cinco testes anteriores da API e dois testes de publicidade aprovados. Navegação, galeria/zoom, reprodução de vídeo, bloqueio Premium e biblioteca administrativa continuam aprovados no navegador.
- `management_browser.py` aprovado com cadastro, busca, ficha, alteração de acesso e senhas, configurações, conta administrativa e navegação para campanhas. Dashboard, listagem, ficha e configurações conferidos em 320, 390, 768, 1024 e 1440 px sem overflow. Ajustado truncamento do breadcrumb de Configurações em 320 px.
- O teste confirmou o envio real de visitas pela versão web e a exibição do aviso educacional e links de suporte, privacidade e termos salvos pelo painel. Eventos desse teste foram removidos, e configurações originais restauradas.
- Typecheck/lint mobile aprovados; painel compilado com TypeScript/Vite e site exportado. PHP da API e scripts alterados passaram na análise de sintaxe. Não houve APK/AAB nem commit.
- Publicação remota ainda depende do envio do pacote e da importação de `database/management.sql`. A coleta não reconstrói o tráfego anterior e não mede receita nem desempenho dos anúncios.

Capturas desta entrega: `test-results/management-dashboard-desktop.png`, `management-dashboard-mobile.png`, `management-clients-desktop.png`, `management-clients-mobile.png`, `management-client-detail-desktop.png`, `management-client-detail-mobile.png`, `management-settings-desktop.png`, `management-settings-mobile.png`, `management-account-desktop.png` e `management-advertising-desktop.png`. Contas “Teste gestão” aparecem apenas nas capturas dos testes; suas fixtures foram removidas.

- API: 4 testes de integração aprovados, cobrindo catálogo/filtros/paginação, autorização, arquivos assinados, HTTP Range, favoritos sem duplicação, logout, upload, edição, desativação e arquivamento. Upload com conteúdo PHP disfarçado e URL `javascript:` rejeitados.
- Navegador Chromium: app desktop e 390 × 844, reprodução real de vídeo, galeria anterior/próxima, zoom, bloqueio Premium, login administrativo para revisão, conteúdo do manual, painel desktop e 390 × 844. Nenhum erro JavaScript e nenhum overflow horizontal nas telas estreitas.
- TypeScript mobile e painel: aprovados.
- Lint mobile: aprovado.
- Expo Doctor: 21/21 checks aprovados.
- PHP: arquivos da API passaram na análise de sintaxe.
- Painel Vite compilado e prévia web do React Native exportada. Endereços locais e acesso direto às rotas respondem com HTTP 200.

Capturas: `test-results/app-desktop.png`, `app-mobile.png`, `app-video.png`, `app-conteudo.png`, `admin-desktop.png` e `admin-mobile.png`.

## Revisão de UI/UX

- App e painel compartilham paleta rosa/vinho, tipografia DM Sans/Manrope embarcada e uma hierarquia visual mais clara. Logo e imagens clínicas foram preservados.
- Destaque compacto no celular, busca antes das abas, navegação com seleção visível, ações explícitas nos cards, filtros com limpeza e controles de mostrar/ocultar senha.
- Painel com formulário de mídia refinado, botão de seleção de arquivo, ícones de edição maiores, estados de foco/hover e saída acessível também no celular.
- `tests/design_review.py` aprovado em Chromium nas larguras 320, 390, 768, 1024 e 1440 px. Fontes locais carregadas, senha alternando corretamente e ausência de erros JavaScript. Overflow do painel em 320 px corrigido.
- Typecheck e lint do app aprovados; painel recompilado e prévia web exportada. Teste de navegação/galeria/vídeo/login aprovado após o refinamento.

Capturas da revisão: `test-results/design-after-desktop.png`, `design-after-mobile.png`, `design-after-mobile-small.png`, `design-after-mobile-cards.png`, `design-after-premium.png`, `design-after-profile.png`, `design-after-login.png`, `design-after-admin.png`, `design-after-admin-mobile.png` e `design-after-editor.png`.

Limites da primeira verificação: não houve build de APK/AAB nem execução em aparelho Android. Pagamentos, anúncios e os módulos futuros do CMS estavam pendentes naquela entrega. O npm audit reportou 29 alertas nas dependências mobile/ferramentas; não foi aplicado downgrade automático incompatível. O painel não apresentou alertas na instalação.

## Parcerias e nova página inicial

- Início passou a ser a entrada do app, com atalhos de vídeos/imagens, destaque de vídeo gratuito no desktop e cards de categorias. Parceiros integra a navegação inferior e lateral.
- Parceiros e campanhas implementados na API, banco e painel. Cadastro com upload e prévia, edição, datas inclusivas em UTC, ordem, locais, pausa e arquivamento. Consulta pública valida status, agenda e política Premium no servidor.
- `advertising_tests.py`: dois cenários completos aprovados, cobrindo autorização, upload válido/inválido, validação de IDs/URLs/datas, cronograma, pausa, arquivamento e Premium.
- `advertising_browser.py`: aprovado. Cadastro real de parceiro e campanha no painel, upload, prévia, salvamento das configurações, exibição no app e retirada ao pausar. Conferidas larguras 320, 390, 768, 1024 e 1440 px, sem overflow após o ajuste responsivo do React Native. Nenhum erro JavaScript. Nenhuma requisição Google Ads no localhost mesmo com a configuração temporária de teste ativada.
- Os quatro testes anteriores da API e o teste de navegador de biblioteca/galeria/zoom/vídeo/login continuam aprovados. Revisão de fontes e layouts anteriores também aprovada.
- TypeScript e lint do app aprovados sem avisos; painel compilado e prévia web exportada.
- Export do JavaScript Android com o módulo AdMob concluído em `api/storage/android-js-check`, sem gerar projeto nativo, APK ou AAB. Isso valida o empacotamento do código, não a execução do SDK em dispositivo.
- Fixtures de parceiros/campanhas foram removidas e as configurações originais restauradas. Não há anúncios ou marcas de demonstração publicados como parceiros reais.

Capturas adicionais em `test-results/`: `app-home-refined-desktop.png`, `app-home-refined-mobile.png`, `app-partners-campaign.png`, `app-partners-mobile-campaign.png`, `app-library-ad-placement.png`, `partnerships-admin-empty.png`, `partnerships-admin-campaigns.png`, `partnerships-campaign-editor.png`, `partnerships-settings.png` e `partnerships-admin-mobile.png`. Capturas com a marca “Teste publicidade” documentam o teste temporário.

Limites atuais: IDs reais e contato comercial ainda não foram fornecidos. AdMob/AdSense ficam desligados por padrão. Publicidade Google real não foi executada em aparelho Android ou domínio aprovado. A instalação mobile passou a reportar 30 alertas npm (10 moderados, 20 altos); não houve `audit fix --force`. Pagamentos e CMS geral permanecem pendentes.
