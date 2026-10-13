# Cadastro e recuperação de senha

A home abre para visitantes. Os atalhos de módulos, mídias, favoritos, parceiros e perfil mostram um convite com “Criar minha conta gratuita” e “Já tenho uma conta”. Fechar o convite mantém a home. A recuperação fica no login, em “Esqueci minha senha”.

## Atualizar a hospedagem

1. Execute `database/password-reset.sql` no banco existente pelo phpMyAdmin. O script é aditivo e pode ser repetido.
2. Envie a pasta `api/`, **incluindo `vendor/` e `.htaccess`**, preservando suas configurações e os arquivos existentes em `storage/`.
3. Envie `preview/` para atualizar a versão web.
4. Gere o APK localmente em `mobile/` com `npm run build:apk` quando quiser atualizar o aplicativo.

Não execute `scripts/setup.php` em uma instalação existente para aplicar esta atualização. Para o banco local existe `php scripts/install-password-reset.php`.

## Configurar o e-mail

O bloco `mail` foi acrescentado ao `api/config/local.php`. Preencha com os dados fornecidos pelo seu provedor:

```php
'mail' => [
    'enabled' => true,
    'host' => 'smtp.seu-provedor.com',
    'port' => 587,
    'encryption' => 'tls', // Para porta 465, use 'ssl'.
    'username' => 'contato@seu-dominio.com',
    'password' => 'SENHA_SMTP_OU_SENHA_DE_APLICATIVO',
    'from' => 'contato@seu-dominio.com',
    'from_name' => 'Dominando a Mamografia',
],
```

O remetente deve ser autorizado pelo provedor. O código usa PHPMailer com SMTP autenticado e verificação TLS. Credenciais são apenas da API; não vão para o APK. A dependência está instalada em `api/vendor/`, com versão travada em `api/composer.lock`; para reinstalar, use `composer install --no-dev` dentro de `api/`.

Enquanto `enabled` estiver `false` ou os campos necessários estiverem vazios, a tela explica que o envio ainda está indisponível. O envio real precisa ser conferido com uma conta sua após preencher os dados.

## Funcionamento

- `POST /auth/forgot-password`: recebe `email`. Resposta genérica para contas existentes ou inexistentes. Atende clientes ativos, com limite por IP e intervalo de 60 segundos entre códigos por cliente.
- `POST /auth/reset-password`: recebe `email`, `code` e `password`. Código numérico de oito dígitos, 15 minutos de validade, até cinco tentativas e uso único. O banco guarda apenas o HMAC do código.
- Uma nova senha encerra as sessões anteriores. O cliente entra novamente. Premium e conteúdo da conta são preservados.
- Os testes usam contas temporárias e entrega de e-mail simulada; não enviam mensagens externas.
