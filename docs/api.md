# API REST — etapa de mídias

Base local: `http://localhost/app_mamografia/api/index.php?route=/ENDPOINT`.
Com rewrite habilitado, também funciona `/api/ENDPOINT`. Todas as respostas são JSON, exceto arquivos. Requisições autenticadas usam `Authorization: Bearer TOKEN`. O token expira em 7 dias; logout remove seu hash do banco.

O usuário público inclui `premium_permanent`, `trial_active`, `trial_started_at` e `trial_ends_at` (datas UTC ISO 8601), `trial_days` (dias atualmente configurados) e `trial_available` (elegibilidade para iniciar). `is_premium` representa o acesso efetivo atual, incluindo teste não expirado. O admin configura `premium_trial_days` entre 0 e 365; zero desativa novas ativações. Cadastro/login não começam o prazo. `POST /premium/trial/start` ativa uma única vez por conta, usando os dias do servidor; campos de conta/duração enviados pelo cliente são ignorados. Cliques simultâneos ou repetidos não renovam o teste. Instale `database/premium-trial.sql`; detalhes em [período de teste](premium-trial.md).

| Método | Endpoint | Acesso / resultado |
|---|---|---|
| GET | /health | Confirma conexão com o banco |
| GET | /categories | Categorias ativas ordenadas |
| GET | /topics | Tópicos ativos com categoria |
| GET | /settings | Textos públicos do app e aviso educacional |
| GET | /stats | Contagens de mídias publicadas |
| GET | /media | Metadados paginados; URLs somente quando autorizado |
| GET | /media/{id} | Uma mídia ativa |
| GET | /contents/{id} | Conteúdo e blocos; Premium exige autorização |
| GET/HEAD | /files/{id} | Arquivo assinado; aceita Range, 206 e 416 |
| POST | /auth/register | Cadastro: name, email, password (8 a 72 caracteres/bytes) |
| POST | /auth/login | Login: email, password |
| POST | /auth/forgot-password | Solicita código por e-mail; resposta genérica, com limite de envio |
| POST | /auth/reset-password | Redefine senha: email, code, password; revoga as sessões anteriores |
| POST | /admin/login | Login administrativo: email, password |
| GET | /profile | Conta autenticada |
| POST | /premium/trial/start | Ativa o teste para a conta autenticada; retorna o usuário atualizado |
| POST | /auth/logout | Revoga token |
| GET | /billing/google-play/offer | Produto único Play e identificador opaco da conta; exige login |
| POST | /billing/google-play/verify | Verifica purchase_token com Google e restaura/confirma o Premium da conta |
| POST | /webhooks/google-play | Notificações Pub/Sub autenticadas por JWT OIDC Google |
| GET | /favorites | Mídias favoritas paginadas da conta |
| GET | /favorites/ids | IDs favoritos da conta |
| POST/DELETE | /favorites/{id} | Salva/remove mídia favorita |
| GET | /admin/media | Inclui mídias desativadas; administrador |
| POST | /admin/media | Upload multipart ou URL externa JSON; administrador |
| PUT | /admin/media/{id} | Edita metadados/vínculo; administrador |
| POST | /admin/media/{id} | Substitui arquivo, multipart; administrador |
| DELETE | /admin/media/{id} | Arquiva mídia da biblioteca; administrador |
| GET | /advertising | Parceiros ativos, campanhas vigentes e configuração pública; respeita Premium |
| GET/HEAD | /promotion-file?name={hash}.webp | Imagem pública de publicidade recodificada pelo servidor |
| GET | /admin/partners | Lista parceiros não arquivados; administrador |
| POST | /admin/partners | Cria parceiro, multipart com logo opcional; administrador |
| POST/PUT | /admin/partners/{id} | Edita cadastro/logo (multipart POST) ou campos JSON (PUT); administrador |
| DELETE | /admin/partners/{id} | Arquiva parceiro e deixa de exibir suas campanhas |
| GET | /admin/banners | Lista campanhas, inclusive pausadas; administrador |
| POST | /admin/banners | Cria campanha, multipart com imagem opcional; administrador |
| POST/PUT | /admin/banners/{id} | Edita campanha/imagem ou campos JSON; administrador |
| DELETE | /admin/banners/{id} | Arquiva campanha, preservando imagem |
| GET/PUT | /admin/advertising | Lê/salva configuração completa de publicidade; administrador |
| GET | /admin/dashboard?days=7/30/90 | Métricas reais do site, clientes, catálogo e atividade; administrador |
| GET | /admin/users | Clientes paginados: q, page, access=FREE/PREMIUM, status=0/1, role=USER/ADMIN/ALL |
| POST | /admin/users | Cadastro de cliente: name, email, password, is_premium=0/1 |
| GET | /admin/users/{id} | Ficha, favoritos e histórico; administrador |
| PUT | /admin/users/{id} | Dados/acesso de cliente: name, email, is_premium=0/1, status=0/1 |
| PUT | /admin/users/{id}/password | Redefine senha e revoga sessões; corpo password, sem senha atual |
| GET/PUT | /admin/settings | Textos, contatos, links públicos e coleta de visitas; administrador |
| GET/PUT | /admin/account | Conta do próprio administrador: name, email, password opcional |
| POST | /analytics/visit | Registra navegação web: visitor, event_id (UUID), screen, device |

Filtros de listagem: `page`, `limit` (1–100), `q`, `type` (`IMAGE`/`VIDEO`), `topic_id`, `category_id`, `access` (`FREE`/`PREMIUM`). A resposta possui `data`, `total`, `page`, `pages`.

Upload: `file`, `title`, `topic_id` opcional, `caption`, `alt_text`, `access_type`, `order_position`, `status` (0/1). Formatos JPG, PNG, WebP, MP4 e WebM. `VIDEO_URL` exige `type`, `external_url` HTTPS e os metadados. Não ocorre download da URL externa no backend.

URLs de arquivo: `expires`, `uid`, `mode` (`file`/`thumb`), `sig`. São geradas pelo servidor; o cliente renova ao abrir a mídia. Conteúdo bloqueado tem `locked=true`, `url=null` e `thumbnail_url=null`. A conta administrativa pode revisar arquivos de mídias desativadas; mídia arquivada nunca é entregue.

Erros: 401 sem autenticação, 403 sem permissão/Premium/assinatura inválida, 404 inexistente/inativo, 409 e-mail duplicado, 422 entrada/upload inválido, 429 limite de tentativas, 500 erro interno sem detalhes sensíveis. Atualização dos metadados e dos vínculos ocorre em transação.

Recuperação de senha, CMS geral e favoritos de conteúdos ainda não estão disponíveis.

Pagamento Asaas: `GET /billing/offer` (preço/disponibilidade), `POST /billing/checkout` (checkout reutilizável, preço e cliente definidos pelo servidor), `GET /billing/status` (última compra e perfil atualizado). Todos exigem token de usuário. `POST /webhooks/asaas` exige `asaas-access-token` igual ao segredo do webhook e processa eventos idempotentes. Instalação, compra única e limites de operação: [asaas.md](asaas.md).

Parceiros: `name`, `description`, `website` HTTPS, `logo` (arquivo opcional), `status` (0/1), `order_position` (0–9999). Campanhas: `partner_id`, `title`, `description`, `url` HTTPS, `cta`, `placements` (array JSON de HOME/MEDIA/CONTENT/PARTNERS), `start_on`/`end_on` (YYYY-MM-DD, inclusivos em UTC), `status`, `order_position`, `image` (arquivo opcional). Edições parciais preservam os campos ausentes. `remove_logo=1` ou `remove_image=1` retira a imagem do cadastro. Arquivos aceitam até 5 MB e 16 megapixels, com MIME real JPG/PNG/WebP, e são recodificados para WebP.

Configuração de publicidade: booleanos `partners_enabled`, `google_enabled`, `test_mode`, `hide_for_premium`, `adsense_enabled`; strings `admob_banner_id`, `adsense_client`, `adsense_slot`, `contact_email`; array `google_placements`. GET público aplica a política Premium no servidor e não envia campanhas desativadas, fora do período ou com parceiro inativo. `/settings` não duplica a configuração de publicidade.

Configurações do site: `app_name`, `footer_notice` (obrigatórios), `premium_title`, `premium_description`, `support_email`, `privacy_url`, `terms_url` e `analytics_enabled` (string `0`/`1`). Links exigem HTTPS. Alterações de clientes são restritas a contas USER; contas ADMIN usam `/admin/account` do próprio administrador. Trocas de senha não exigem senha anterior, mas todos os endpoints de gestão exigem token administrativo válido. Logs registram ator e cliente afetado, sem senha ou token. Coleta de visitas responde 202, deduplica `event_id`, ignora administradores e respeita a chave de ativação; não depende de login do visitante. Detalhes e implantação: `painel-gestao.md`.
