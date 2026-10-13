# Asaas e entrada por conta

Asaas é usado nas compras da **web**. No Android, o Premium usa **Google Play Billing**, com preço configurado na Play Console; veja [a configuração Google Play](google-play.md). Asaas sandbox não testa compras da Play Store.

O app exige cadastro ou login antes da home. A sessão é restaurada ao abrir; conta inválida volta ao login e falha de rede oferece nova tentativa. Login e cadastro levam à home. O conteúdo educacional não foi alterado.

A integração possui **um único plano Premium de pagamento único**, por Pix ou cartão, sem mensalidade ou renovação automática. Defina o preço no admin em **Configurações → Site e aplicativo → Plano Premium → Preço do Premium (R$)** e clique em **Salvar configurações**. Zero deixa a compra indisponível. O preço fica na tabela `settings`, na chave `premium_price_cents`, e tem prioridade sobre o valor antigo de `local.php`. Checkouts já abertos mantêm o valor original; os próximos usam o novo preço.

## Instalação no servidor

1. Suba os arquivos `api/` e `preview/` do pacote, preservando `api/config/local.php` e os uploads.
2. No phpMyAdmin, selecione o banco existente e importe **somente `database/payments.sql`**. No PC, pode executar `C:\xampp\php\php.exe scripts/install-payments.php`. Não reimporte a correção do manual para esta atualização.
3. Acrescente ao array de `api/config/local.php` o bloco `asaas` de `api/config/example.php`. Configure a chave API e um token de webhook de pelo menos 32 caracteres nesse arquivo privado ou pelas variáveis de ambiente `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`. Nunca coloque essas chaves no app ou em `EXPO_PUBLIC_*`.
4. Defina o preço pelo admin e `return_url` no servidor com a URL HTTPS do seu site, terminando em `/preview/profile`. Use inicialmente `environment => 'sandbox'`. Após a validação com sua conta de testes, configure credenciais de produção e `environment => 'production'`; ative com `enabled => true`. Preço zero ou configuração incompleta não permite cobrança. As credenciais continuam privadas no servidor.
5. No painel Asaas, configure um webhook POST para `https://SEU-DOMINIO/app_mamografia/api/index.php?route=/webhooks/asaas`, com o mesmo `webhook_token` como `authToken`, envio `SEQUENTIALLY` e eventos `CHECKOUT_CREATED`, `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`, `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED` e `PAYMENT_CHARGEBACK_DISPUTE`. Sandbox e produção exigem configurações independentes.
6. Atualizar a hospedagem não muda o formulário de entrada de um app Android já instalado. Faça seu build local quando for atualizar o Android, seguindo também a configuração Google Play acima.

O checkout hospedado coleta os dados de pagamento no Asaas. Valor e usuário são definidos na API; valores enviados pelo app não são aceitos. A API reutiliza um checkout pendente para impedir cobranças duplicadas.

## Confirmação e operação

O retorno do navegador não confirma o pagamento. O webhook autenticado confirma a cobrança consultando o Asaas pelo checkout, confere o valor, registra o ID do pagamento e processa o evento em transação com chave única. Ao voltar do checkout, o app atualiza o perfil; o modal também oferece **Já paguei, verificar**. O usuário pode abrir **Conhecer Premium** no Perfil.

Os acessos de pagamentos ficam em `payments`; o campo `users.is_premium` continua sendo a autorização manual do painel. Estorno completo ou chargeback remove o acesso daquela compra; autorizações manuais e outras compras pagas continuam válidas. Estorno parcial e resultado posterior de disputa precisam de análise manual no Asaas. Mudar de sandbox para produção desconsidera acessos de compras de teste.

Se a criação sofrer timeout, o checkout pode existir no Asaas. O pedido fica `CREATING` e não gera uma segunda cobrança automaticamente: localize o checkout pelo `externalReference` (coluna `payments.reference`), confira no Asaas e concilie o ID/link. Marque `FAILED` apenas após verificar que nenhum checkout foi criado. Erros temporários na confirmação respondem 503, permitindo reenvio do webhook. Acompanhe os logs de webhook no Asaas.

## Verificação

`tests/billing_tests.php` usa transporte simulado e fixtures removidas ao concluir. Verifica preço, checkout reutilizado, confirmação, eventos repetidos/atrasados, estorno e preservação do Premium manual. Não cria cobranças externas. A compra real em sandbox/produção e o retorno no celular exigem a conta Asaas configurada.

Referências: [criar checkout](https://docs.asaas.com/reference/criar-novo-checkout), [dados do pagador](https://docs.asaas.com/docs/como-informar-os-dados-do-cliente), [webhooks de checkout](https://docs.asaas.com/docs/eventos-para-checkout), [consultar cobranças por checkout](https://docs.asaas.com/reference/listar-cobrancas), [eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas).
