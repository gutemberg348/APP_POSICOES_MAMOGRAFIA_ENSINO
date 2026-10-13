# Parcerias e publicidade

O painel **Parcerias e anúncios** administra marcas, campanhas e configurações Google. Não foram cadastradas marcas fictícias como parceiros reais. Sem campanha ativa, o app mantém o convite e o diretório, sem reservar um retângulo vazio para anúncio.

## Cadastrar e publicar

1. Em **Parceiros**, informe nome, apresentação, site HTTPS, logo, ordem e status.
2. Em **Campanhas**, selecione o parceiro, título, descrição, link HTTPS e texto do botão. O banner é opcional; sem ele, há um card de texto.
3. Escolha um ou mais locais: Início, Biblioteca, Final do conteúdo ou Área de parceiros. A biblioteca insere publicidade depois das primeiras seis mídias; o conteúdo técnico recebe o espaço somente ao final.
4. Informe datas opcionais de início e término, com dias inclusivos em UTC. A data vazia não limita aquele lado do período.
5. Confira a prévia, defina o status como Ativo e salve. Recarregue o app para consultar a atualização.

Campanhas exigem parceiro ativo e período vigente. A ordem crescente controla a primeira campanha; havendo outras no mesmo espaço, setas permitem alternar sem avanço automático. Pausar ou arquivar um parceiro retira todas as suas campanhas da consulta pública. Arquivar preserva os arquivos; não há exclusão física pelo painel.

Uploads aceitam JPG, PNG e WebP, até 5 MB e 16 megapixels. O servidor verifica o conteúdo, recodifica para WebP e limita o maior lado a 1600 px. Sugestão de arte: 1200 × 480 px. As URLs das imagens de publicidade são públicas; não envie material confidencial nessas imagens.

**Google Ads & ajustes** permite desligar parcerias, ocultar campanhas e banners Google para Premium e definir o contato comercial. O contato habilita **Seja parceiro**, que abre o aplicativo de e-mail. O diretório permanece disponível para Premium mesmo quando anúncios estão ocultos.

## Google AdMob no Android

A dependência `react-native-google-mobile-ads` e seu plugin Expo estão instalados. O componente nativo inicializa o SDK após consultar o consentimento UMP e respeita `canRequestAds`; banners solicitam anúncios não personalizados. As opções de privacidade aparecem quando o SDK informa que são necessárias.

- Configure **ADMOB_ANDROID_APP_ID** em `mobile/.env` antes de gerar o Android. É o ID com `~`, por exemplo `ca-app-pub-…~…`.
- Cadastre o **ID do bloco de banner**, com `/`, no painel. Ele pode ser trocado sem recompilar o app.
- Ative AdMob no painel e mantenha **Modo de teste** durante a validação. Esse modo usa `TestIds.BANNER` oficial.
- Sem a variável de ambiente, o plugin usa o aplicativo de teste oficial do Google. A interface nativa bloqueia a solicitação de anúncios reais enquanto o build não tiver o ID de produção.
- Configure as mensagens de privacidade na conta AdMob. O módulo nativo exige um build próprio; Expo Go e a prévia web não executam AdMob.

Não foram implementados interstitials nem vídeos recompensados nesta etapa. O formato entregue é banner, posicionado entre seções de estudo.

## Google AdSense na web

O componente web recebe o ID do editor (`ca-pub-…`) e o ID numérico do bloco pelo painel. O script só é solicitado quando a opção está ativa, o endereço é HTTPS público e a pessoa permite seu carregamento na página. Localhost e endereços privados não solicitam anúncios. Sem preenchimento/configuração, nenhum bloco Google aparece.

A publicação real depende de domínio aprovado e configurações de privacidade na conta Google. O botão de permissão da interface não substitui a configuração de mensagens exigida pelo Google. Não há código HTML arbitrário no painel: somente os identificadores validados.

Os IDs reais e o contato comercial não foram fornecidos. AdMob e AdSense permanecem desligados por padrão. Não foi gerado APK/AAB, e a reprodução de anúncios Google em Android real ou domínio aprovado ainda precisa de validação.

## Instalação e verificação

`php scripts/migrate-advertising.php` cria somente as novas tabelas e pode ser repetido. A instalação geral também as inclui. Não há nova compilação Android para atualizar parceiros, campanhas ou unidades de anúncio; somente o ID de aplicativo AdMob pertence ao build.

```powershell
python -X utf8 tests/advertising_tests.py
python -X utf8 tests/advertising_browser.py
```

Os testes cadastram fixtures, validam upload/agenda/permissões e restauram configurações. O teste de navegador cobre cadastro, prévia, exibição, pausa e responsividade. Capturas com a indicação “CAMPANHA DE TESTE” são apenas evidências da revisão.

Referências: [Google: AdSense e AdMob](https://support.google.com/admob/answer/9234653?hl=pt-BR), [instalação Expo](https://docs.page/invertase/react-native-google-mobile-ads/installation/expo), [banners](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/banner), [consentimento UMP](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent), [AdSense](https://support.google.com/adsense/answer/9274019?hl=pt-BR).
