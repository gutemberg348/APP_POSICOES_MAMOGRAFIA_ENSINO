# Arquitetura e escopo

## Sistema

Aplicativo Android educacional Dominando a Mamografia. A cliente gerencia conteúdos no painel, sem republicar o app. Compra única libera Premium. Não existe assinatura recorrente nesta arquitetura.

Referências: manual fornecido de 27 páginas, identidade visual e 15 pastas de mídias. Instruções de navegação/editoria do PDF foram tratadas como especificações, não como parágrafos clínicos. O pedido atual autoriza iniciar a implementação pelas telas de mídia, sem APK e sem commits manuais.

## Componentes

```text
React Native + Expo + Expo Router (Android e prévia web)
              ↓ HTTP JSON / token
PHP REST → PDO → MySQL/MariaDB
              ↑ HTTP JSON / token administrativo
React + Vite (painel compilado em arquivos estáticos)

PHP → arquivos físicos em uploads/ → entrega assinada com acesso validado
```

O servidor não depende de Node, Docker, Redis, PM2 ou WebSocket. Node serve apenas ao desenvolvimento e compilação dos clientes.

## Telas

Inicial → categoria → tópicos → conteúdo. Conteúdo possui abas de texto, vídeos e imagens. Biblioteca → filtros/busca → player ou galeria. Favoritos → mídias salvas. Perfil → cadastro/login/dados da conta. Premium → apresentação administrável → compra única futura.

O painel implementado possui Visão geral com métricas reais, Clientes com gestão de contas/senhas/Premium, biblioteca com upload/editor, Parceiros/Campanhas/publicidade e Configurações do site e da conta administrativa. A expansão prevista inclui CMS de Categorias, Tópicos e Conteúdos, Pagamentos e preço Premium. Não há menus fictícios com operações simuladas. Detalhes da gestão em `painel-gestao.md`.

## Banco e relacionamentos atuais

- `categories` → muitos `topics` → um ou mais `contents` → muitos `content_blocks`.
- `media` referencia um tópico opcional; `content_media` relaciona conteúdo e mídias.
- `users` distingue `USER` e `ADMIN`; senhas usam `password_hash`/`password_verify`.
- `auth_tokens` armazena apenas o hash do token e a expiração de 7 dias.
- `favorites` relaciona usuário e mídia, com chave composta evitando duplicação.
- `settings` armazena chave/valor; `logs` registra autenticação e ações administrativas de mídias, clientes, acesso, senhas e configurações, sem credenciais.
- `analytics_events` registra páginas vistas no site com identificador aleatório transformado em hash, seção, dispositivo e data UTC. Migração adicional: `database/management.sql`.

O acesso de categoria/tópico Premium prevalece sobre mídia configurada como gratuita. Arquivos não são BLOBs. Metadados, ordem e estado ficam no banco; arquivos ficam protegidos no disco. Conteúdo técnico existe somente nos dados importados e na API, fora dos componentes mobile.

Blocos aceitam tipo arbitrário, título, texto e JSON de metadados. A importação usa parágrafo, lista numerada, critérios, erros, importante e dica. Tipos futuros de imagem, galeria e vídeo podem referenciar IDs de mídia nos metadados. O editor geral de blocos ainda será implementado.

`partners` armazena marcas; `banners` referencia o parceiro e contém locais, ordem e período de exibição. A migração está em `database/advertising.sql`. A configuração de anúncios fica em uma chave própria de `settings` e é servida por `/advertising`, respeitando a conta Premium. Detalhes em `parcerias-publicidade.md`.

Pagamentos: `payments` e `payment_events`, instalados por `database/payments.sql`. Expansões planejadas: `content_favorites` e `password_resets`. A cobrança exige gateway e preço configurados no servidor.

## Organização

```text
mobile/                código React Native, rotas e componentes
admin/src/             painel React + Vite
admin/dist/            painel compilado
api/config/            conexão e configuração local privada
api/controllers/       autenticação, biblioteca e administração
api/models/            acesso aos metadados de mídia
api/middleware/        autenticação e autorização
api/services/          entrega de arquivos por trechos
api/helpers/           JSON, validação e rate limit
api/storage/           credenciais e arquivos internos privados
database/              esquema e dados importados
uploads/               imagens, vídeos e miniaturas protegidos
scripts/               instalação e importação CLI
tests/                 integração da API e navegador
preview/               prévia web compilada do app
docs/                  arquitetura, API e revisão do material
```

## Pagamento Asaas

App autenticado → `/billing/checkout` → `AsaasProvider` cria checkout de compra única → webhook autenticado → cobrança consultada no Asaas e valor conferido → evento persistido com chave única → compra paga dá acesso Premium no backend. Estorno completo e chargeback removem o acesso daquela compra, preservando o Premium manual. Status informado pelo cliente nunca confirma pagamento. Detalhes e configuração: [asaas.md](asaas.md).

Textos e vantagens vêm de `settings`; preço e credenciais ficam no bloco privado `asaas` de `api/config/local.php`. Nenhum preço foi inventado e a cobrança permanece desativada sem configuração. A entrada do app exige cadastro ou login antes da home.

## Segurança e performance

PDO e parâmetros preparados; JSON validado; papéis separados; tokens aleatórios com hash; rate limit local com trava de arquivo; validação MIME real; imagens limitadas por quantidade de pixels; nomes seguros; arquivos externos somente HTTPS; conteúdo renderizado como texto para evitar execução de HTML. CORS restrito por configuração. Material Premium não acompanha respostas públicas; arquivos usam assinatura com expiração de uma hora, usuário e modalidade incorporados, com revalidação de acesso na entrega.

Paginação de 24 mídias; miniaturas de até 640 px na importação; imagens originais abertas sob demanda; vídeo montado somente ao abrir; controles nativos e HTTP Range. Nova edição de mídia aparece ao recarregar a biblioteca. Cache offline de conteúdos e miniaturas de novos uploads de vídeo ficam para evolução.

Esta etapa foi verificada no navegador, incluindo dimensão de celular. A validação de reprodução e navegação em Android real permanece pendente; a compilação Android fica a cargo do usuário.

Referência de implementação do player: [Expo Video, SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/video/). Navegação: [Expo Router](https://docs.expo.dev/router/introduction/).
