# Dominando a Mamografia

Primeira etapa implementada: aplicativo React Native com biblioteca de imagens e vídeos, painel de mídias em React + Vite e API PHP + MySQL. Sem geração de APK/AAB. A cópia Git criada automaticamente pelo gerador foi retirada do aplicativo e preservada em `api/storage/expo-template-git`.

## Analisar agora no XAMPP

- Aplicativo, prévia web: **http://localhost/app_mamografia/**
- Painel de mídias: **http://localhost/app_mamografia/admin/**
- As credenciais administrativas locais estão em `api/storage/acesso-local.txt`. Esse arquivo é bloqueado pelo Apache. A mesma conta pode entrar no perfil do app para revisar as mídias Premium.

O banco `dominando_mamografia` foi criado no MySQL local. Os materiais originais foram preservados. A importação cadastrou **62 imagens, 15 vídeos, 28 tópicos e 5 categorias**, com textos do PDF e miniaturas. A prévia web utiliza o mesmo código React Native e a mesma API; a validação Android em aparelho permanece pendente.

## O que funciona nesta etapa

A interface do app e do painel foi refinada com a mesma paleta de rosa e vinho, fontes locais DM Sans e Manrope, ícones consistentes e controles maiores. No celular, a busca aparece antes das abas, os vídeos usam cards mais largos e o destaque ocupa menos espaço. Os formulários incluem mostrar/ocultar senha. As imagens técnicas continuam exibidas sem recorte na biblioteca.

- Biblioteca com abas de vídeos e imagens, busca por título/tópico/categoria/legenda, filtros e paginação.
- Imagens em galeria por tópico, navegação anterior/próxima e ampliação até 300%.
- Vídeos MP4/WebM com controles e suporte HTTP Range. Links externos HTTPS abrem no navegador.
- Categorias → tópicos → conteúdo em blocos, seguindo o material fornecido.
- Cadastro, login, logout, perfil de consulta e favoritos de mídias persistidos no banco.
- Conteúdo gratuito/Premium validado pelo backend. URLs de arquivos são assinadas e temporárias.
- Painel: upload, URL externa, edição de título/legenda/texto alternativo, vínculo com tópico, ordem, ativação/desativação, substituição e remoção da biblioteca.
- Remoção arquiva o registro (`status=2`), preservando o arquivo. Substituição também preserva o arquivo anterior.
- Nova entrada pelo Início, com atalhos de vídeos/imagens, categorias em cards e navegação para Parceiros.
- Parceiros e campanhas administráveis: logo, banner, links, prévia, ordem, agenda, locais de exibição, pausa e arquivamento.
- Espaços de publicidade no Início, Biblioteca, fim do Conteúdo e Parceiros, com identificação comercial e navegação entre campanhas.
- Configurações AdMob/AdSense no painel, opção de ocultar anúncios para Premium e contato comercial. Google Ads começa desligado; IDs reais e validação de anúncios publicados ainda estão pendentes.

Veja [como cadastrar parceiros, publicar campanhas e configurar anúncios](docs/parcerias-publicidade.md). No painel, abra **Parcerias e anúncios**. A área pública não contém parceiros fictícios; as campanhas usadas nos testes foram removidas.

## Desenvolvimento

PHP 8.2+, MySQL/MariaDB, Node 22+ e npm. O servidor de produção precisa somente de PHP, MySQL e arquivos estáticos.

```powershell
# API e dados iniciais; a instalação é repetível e não sobrescreve edições do painel
php scripts/setup.php

# Aplicativo
cd mobile
npm install
npm start
```

Em emulador Android a API padrão usa `10.0.2.2`. Para aparelho físico copie `mobile/.env.example` para `mobile/.env` e configure `EXPO_PUBLIC_API_URL` com o IP da máquina na rede local. O aparelho precisa alcançar o Apache. Não use `localhost` para apontar para o computador a partir do aparelho. Use um cliente Expo compatível com o SDK do projeto.

```powershell
# Painel em desenvolvimento
cd admin
npm install
npm run dev

# Atualizar a prévia web e o painel compilado, sem build Android
cd mobile
npm run export:web
cd ../admin
npm run build
```

O export web usa `/app_mamografia/preview` como subpasta. Em outra hospedagem ajuste `expo.experiments.baseUrl`, as variáveis de API e `api/config/local.php`. O painel compilado está em `admin/dist`; para hospedagem compartilhada publique os arquivos de `dist` no diretório do painel. Use HTTPS na hospedagem e configure `allowed_origins` e `base_url` com o domínio real. Não publique os materiais originais, scripts, documentação ou credenciais. O `.htaccess` local bloqueia esses diretórios.

Para reimportar a partir do PDF e das pastas originais, o script `scripts/import_materials.py` usa PyMuPDF, Pillow e OpenCV. Os caminhos internos são seguros e os arquivos recebem nomes derivados de hash. O `setup.php` ignora registros já importados para preservar alterações editoriais.

## Conferências

Para gerar um APK local no Windows: na pasta `mobile`, execute `npm run build:apk`. O arquivo será salvo em `mobile/builds/dominando-mamografia.apk`. Para verificar o ambiente primeiro, use `npm run build:apk:check`. Configuração de API, SDK e assinatura em [docs/apk-local.md](docs/apk-local.md).

Os 28 conteúdos escritos foram revistos integralmente contra o PDF, com listas, destaques, numeração, pontuação e referências de páginas. Para corrigir os textos na hospedagem, importe `database/manual-correction.sql` e envie o pacote `api/storage/atualizacao-conteudos-pdf.zip`, conforme [docs/atualizacao-textos-pdf.md](docs/atualizacao-textos-pdf.md). O código do app também impede exibir o conteúdo anterior sob outro título ao mudar de tópico.

O painel agora inclui Visão geral, Clientes, Mídias, Parcerias/anúncios e Configurações. A ficha do cliente permite editar, bloquear, liberar Premium e redefinir senha; Minha conta permite alterar a senha administrativa sem pedir a anterior. Para atualizar a hospedagem existente, consulte [docs/painel-gestao.md](docs/painel-gestao.md): importe `database/management.sql` e envie o pacote gerado por `python scripts/package-panel-update.py`. A configuração de conexão existente não entra no pacote.

```powershell
python -X utf8 tests/api_tests.py
python -X utf8 tests/browser_smoke.py
python -X utf8 tests/design_review.py
python -X utf8 tests/advertising_tests.py
python -X utf8 tests/advertising_browser.py
python -X utf8 tests/management_tests.py
python -X utf8 tests/management_browser.py
python -X utf8 tests/manual_fidelity.py
python -X utf8 tests/manual_browser.py
cd mobile
npm run typecheck
npm run lint
cd ../admin
npm run build
```

Testes da API exigem Pillow; os de navegador exigem Playwright e Chromium. Os testes usam dados temporários e removem suas fixtures. Capturas ficam em `test-results/`. Os testes de navegador leem as credenciais locais sem imprimi-las.

`design_review.py` confere o app e o painel em 320, 390, 768, 1024 e 1440 px, incluindo carregamento das fontes, controles de senha e erros JavaScript. As fontes e suas licenças OFL estão em `mobile/assets/fonts` e `admin/public/fonts`. O script `scripts/prepare_design_fonts.py` permite recriá-las a partir do repositório oficial Google Fonts, usando `fonttools`.

## Próximas etapas do projeto

O escopo completo está em `docs/arquitetura.md`. Permanecem para implementação: CMS completo de categorias/tópicos/blocos, edição de perfil pelo cliente e recuperação automática de senha, favoritos de conteúdos, busca no texto completo, preço Premium, pagamentos/webhooks Asaas, documentos oficiais e preparação da loja. Gestão administrativa de clientes, senhas e Premium, métricas, configurações, parceiros e campanhas estão implementados. A veiculação Google depende dos IDs, da conta configurada e da validação em Android/domínio publicado. A tela Premium informa que o pagamento ainda não está disponível; a liberação pelo painel é manual e não realiza cobrança.

O PHP do XAMPP aceita uploads até 40 MB atualmente (`upload_max_filesize` e `post_max_size`). A API permite configurar um teto maior, mas o menor limite do servidor prevalece. Uploads de vídeos novos ainda não geram miniatura automaticamente; os vídeos fornecidos possuem miniaturas extraídas na importação.

A instalação atual sinalizou 30 alertas na árvore de dependências mobile e ferramentas (10 moderados e 20 altos). Não foi aplicado `audit fix --force`, pois a proposta automática anterior rebaixava o SDK para versões incompatíveis. Essas dependências precisam ser revisadas antes da publicação; o painel React não apresentou alertas na instalação.

Diferenças de quantidade e nomenclatura estão em `docs/revisao-material.md`. O texto técnico do PDF não foi corrigido nem complementado.
