# Premium pela Google Play

O Android usa Google Play Billing (`expo-iap`). A web continua usando Asaas. O Premium é uma compra única, não consumível: a mesma conta do app mantém o acesso após reinstalar ou trocar de celular. Não há assinatura ou renovação automática. Compras pendentes não liberam o Premium.

O cadastro/login obrigatório antes da home continua ativo. Os dias grátis de Premium são definidos no admin em **Configurações → Site e aplicativo → Plano Premium → Período de teste (dias)**. O teste começa somente quando o cliente toca em **Iniciar teste**, termina automaticamente e não gera cobrança. Veja [período de teste](premium-trial.md). Compras de teste da Play Console servem para validar os pagamentos e são independentes dessa configuração.

## Banco e servidor

1. No phpMyAdmin, selecione o banco existente e execute `database/google-play.sql`. Esse SQL só cria três tabelas; não atualiza textos, imagens, clientes ou pagamentos Asaas. Localmente: `C:\xampp\php\php.exe scripts/install-google-play.php`.
2. Suba a pasta `api/`, preservando `api/config/local.php` da hospedagem e `api/storage/`, e a pasta `preview/` completa. Se atualizar o painel, suba também `admin/dist/`.
3. Copie o bloco abaixo para o array retornado por `api/config/local.php`. O bloco Asaas pode permanecer para compras na web.

```php
'google_play' => [
    'enabled' => false, // Ative depois de configurar produto, credenciais e banco.
    'package_name' => 'com.dominando.mamografia',
    'product_id' => 'premium_vitalicio',
    'service_account_file' => __DIR__ . '/google-play-service-account.json',
    'allow_test_purchases' => true, // Testadores licenciados; false ao encerrar os testes.
    'notification_audience' => 'https://testes-techcode.shop/app_mamografia/api/index.php?route=/webhooks/google-play',
    'notification_service_account_email' => 'CONTA-DO-PUSH@SEU-PROJETO.iam.gserviceaccount.com',
],
```

4. No Google Cloud, habilite **Google Play Android Developer API** e crie uma conta de serviço. Convide o e-mail dessa conta em **Usuários e permissões** da Play Console, dando acesso ao aplicativo e às permissões de visualizar dados financeiros/pedidos e gerenciar pedidos, conforme a documentação do Google. A verificação e a confirmação de compras dependem dessas permissões.
5. Salve o JSON privado dessa conta em `api/config/google-play-service-account.json`, ou use um caminho absoluto fora da pasta pública em `service_account_file`. `api/.htaccess` já bloqueia o acesso HTTP às pastas `config/`, `services/` e `storage/`; a hospedagem precisa aplicar essa regra. Nunca coloque esse JSON em `mobile/`, no APK, no painel ou no preview.
6. Ative `enabled => true` quando o servidor estiver configurado. O app consulta o produto e o ID de conta pelo endpoint autenticado; não há chave Google no cliente.

## Produto na Play Console

- Use o aplicativo com pacote **`com.dominando.mamografia`**, o mesmo de `mobile/app.json`.
- Crie um **produto de compra única** com ID **`premium_vitalicio`** e uma opção de **compra**, sem aluguel, pré-venda ou quantidade múltipla. Ative o produto/opção e os países onde será vendido.
- Configure o preço na **Play Console**. O app mostra o preço localizado informado pela Google Play; o preço do admin é usado apenas nos checkouts Asaas da web.
- Se já tiver um produto com outro ID, use esse ID em `google_play.product_id` no servidor. O Android recebe o ID pela API.
- Cadastre testadores licenciados e disponibilize uma versão em uma faixa de teste. O usuário testa com a conta Google autorizada, além de entrar em sua conta do app.
- Para publicar um aplicativo novo, prepare um **Android App Bundle (`.aab`) assinado com sua chave de upload**, conforme a Play Console. O APK local de desenvolvimento assinado com a chave de debug não é o pacote de publicação. Nenhum APK/AAB é gerado automaticamente por esta integração.

## Notificações e estornos

Configure notificações em tempo real (RTDN) para compras únicas e estornos:

1. Crie um tópico Pub/Sub no Google Cloud e conceda publicação ao serviço Google Play `google-play-developer-notifications@system.gserviceaccount.com`.
2. Informe esse tópico nas configurações de RTDN do aplicativo na Play Console e habilite eventos de produtos de compra única.
3. Crie uma assinatura **push autenticada**, com endpoint:

   `https://testes-techcode.shop/app_mamografia/api/index.php?route=/webhooks/google-play`

4. Configure uma conta de serviço para autenticar o push. Copie seu e-mail exato para `notification_service_account_email`. Ela pode ser diferente da conta que consulta a Developer API.
5. Use a URL completa acima como **audience** do token OIDC e como `notification_audience`. Conceda ao agente de serviço Pub/Sub as permissões de criar tokens para a conta do push, conforme a documentação do Google.
6. Envie a notificação de teste da Play Console. O endpoint valida a assinatura RSA Google, emissor, audience, e-mail e expiração. Depois consulta a compra com Google; não confia em status enviados pelo app.

Uma compra confirmada é reconhecida (`acknowledge`) no servidor, sem consumir o produto. Notificações podem recuperar uma compra quando o app fecha ou perde conexão. Um estorno remove apenas o acesso dessa compra; um Premium concedido manualmente no admin é preservado. Eventos atrasados não reativam o token estornado.

Como conferência adicional, agende `php /CAMINHO/app_mamografia/scripts/sync-google-play.php` a cada 15 minutos no cron da hospedagem. Ele reconsulta até 100 compras pendentes/pagas por execução, começando pelas verificadas há mais tempo. Para um volume maior, ajuste a frequência. A sincronização não substitui a configuração de RTDN.

## Testes antes de publicar

Ative `allow_test_purchases => true` durante os testes licenciados. O fluxo nativo usa os meios de pagamento de teste disponibilizados pelo Google para o testador. Asaas sandbox não participa dessas compras.

Verifique no dispositivo, com a versão instalada da faixa de teste:

1. Cadastro/login antes da home e acesso aos conteúdos gratuitos.
2. Preço correto e diálogo oficial da Google Play ao tocar em Comprar.
3. Cancelamento e pagamento pendente sem liberação de Premium.
4. Compra aprovada com liberação de textos, imagens e vídeos Premium.
5. Reinstalação/restauração na mesma conta do app.
6. Outra conta do app sem acesso à compra anterior.
7. Estorno e remoção do acesso comprado, inclusive aos links de arquivos.
8. Compra confirmada quando o app perde conexão após o pagamento, recuperada por RTDN/restauração.

Ao encerrar os testes, use `allow_test_purchases => false`. Compras marcadas pelo Google como teste deixam de conceder Premium; compras reais e liberações manuais continuam válidas. Se precisar de acesso permanente para revisão, use uma conta de revisão com Premium concedido no admin.

O código foi verificado com Google simulado e assinaturas RSA locais. Uma compra real ou licenciada precisa ser validada na Play Console e em um dispositivo com Google Play; não foi executada por esta implementação.

## Endpoints

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/billing/google-play/offer` | Produto e identificador opaco da conta; exige login |
| POST | `/billing/google-play/verify` | `{ "purchase_token": "..." }`; confirmação e restauração no servidor |
| POST | `/webhooks/google-play` | Push Pub/Sub com token OIDC válido |

Referências oficiais: [política de pagamentos](https://support.google.com/googleplay/android-developer/answer/9858738), [configurar a Developer API](https://developers.google.com/android-publisher/getting_started), [validar e reconhecer compras](https://developer.android.com/google/play/billing/security), [RTDN](https://developer.android.com/google/play/billing/rtdn-reference), [autenticação Pub/Sub](https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions), [testes de Billing](https://developer.android.com/google/play/billing/test), [IAP no Expo](https://docs.expo.dev/guides/in-app-purchases/).
