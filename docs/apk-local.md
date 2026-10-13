# APK local no Windows

Na pasta `mobile`, execute:

```powershell
npm run build:apk
```

O comando gera/sincroniza `android` usando Expo Prebuild, executa `:app:assembleRelease` pelo Gradle instalado no projeto e copia o resultado para **mobile/builds/dominando-mamografia.apk**. O JavaScript vai dentro do APK; não é necessário manter o Metro aberto nem conectar um celular para compilar. No primeiro build, Gradle e dependências nativas podem ser baixados.

Para verificar Java, SDK e configuração Expo sem gerar Android nem APK:

```powershell
npm run build:apk:check
```

O PC precisa de Node.js 22.13+, JDK 17+ em `JAVA_HOME`, Android SDK Platform 36 e Build-Tools 36.0.0. O script procura o SDK em `ANDROID_HOME`, `ANDROID_SDK_ROOT` ou no local padrão do Android Studio, e usa o JDK do Android Studio se `JAVA_HOME` não estiver definido.

A API padrão deste comando é `https://testes-techcode.shop/app_mamografia/api/index.php`. Para trocar, coloque `EXPO_PUBLIC_API_URL` em `mobile/.env.local` ou defina a variável no terminal antes do comando. O APK de distribuição exige uma URL pública HTTPS terminada em `/api/index.php`; o comando recusa localhost, endereço de emulador e IP da rede local. Antes de compilar, consulta `/health` e exige JSON com `status: ok`. A verificação `build:apk:check` também faz essa consulta, sem gerar APK.

Mesmo ao compilar diretamente pelo Gradle sem variável de ambiente, a versão release usa a API hospedada. O endereço `10.0.2.2` fica reservado ao desenvolvimento no emulador. Um teste bem-sucedido no PC não confirma a conexão em todas as redes de celulares.

```dotenv
EXPO_PUBLIC_API_URL=https://testes-techcode.shop/app_mamografia/api/index.php
```

O template Expo atual assina o APK release com a chave de desenvolvimento para instalação direta/testes. A assinatura própria para publicação na loja ainda deve ser configurada. Sem `ADMOB_ANDROID_APP_ID`, o projeto continua usando o aplicativo de teste oficial do Google já definido em `app.config.js`.

Não edite os arquivos Android gerados manualmente: mantenha alterações em `app.json`, `app.config.js` ou plugins Expo. Este comando aplica Prebuild com `--no-clean`, preservando o diretório existente. `android` e `builds` ficam ignorados pelo Git.

O plugin local `plugins/withAdsAndroidBackend.js` define `RNGMA_ANDROID_BACKEND=classic` no projeto gerado. Isso seleciona explicitamente o SDK de anúncios padrão e evita a falha `Cannot get property 'googleMobileAdsJson'` do módulo 17.2.0 quando a configuração usa apenas o plugin Expo. O ID do aplicativo AdMob continua configurado pelo plugin oficial em `app.config.js`. O comando inclui `--stacktrace` para mostrar a causa completa se outra etapa falhar.

O build local usa dois workers no Gradle e no Metro para reduzir o consumo de RAM. O Gradle recebe heap de 2 GB e limite de 1 GB para as classes Java (Metaspace), evitando o limite de 512 MB observado no primeiro build. A configuração de workers do Metro se aplica apenas ao comando de APK.

No Windows, `plugins/withShortCmakePath.js` coloca a pasta temporária de CMake do aplicativo em `.cxx` na raiz deste repositório. O caminho menor permite que CMake reduza os nomes dos objetos abaixo do limite do Ninja, evitando `Filename longer than 260 characters`. O código e o projeto Android permanecem no lugar. Essa pasta é gerada e ignorada pelo Git.

Referências: [Expo Prebuild](https://docs.expo.dev/guides/adopting-prebuild/) e [build release local](https://docs.expo.dev/guides/local-app-production/).

## Verificação em 07/10/2026

`npm run build:apk` concluiu localmente com `BUILD SUCCESSFUL`, gerando `mobile/builds/dominando-mamografia.apk` (107,7 MB). A assinatura v2 foi validada por `apksigner`. O APK íntegro contém o JavaScript, a URL da API hospedada e bibliotecas para arm64-v8a, armeabi-v7a, x86 e x86_64. `aapt` confirmou o pacote `com.dominando.mamografia`, versão 1.0.0 e SDK mínimo 24. Lint, TypeScript e análise dos scripts/plugins passaram. O cache `.cxx` responde 403 no Apache local. Não foi realizada instalação ou teste de execução em aparelho nesta verificação.
