# Atualização dos textos conforme o PDF

Os 28 tópicos foram transcritos novamente e conferidos contra o PDF original de 27 páginas. A comparação integral verifica palavras, pontuação, números, ordem e associação dos tópicos. O relatório por tópico está em `conferencia-textos-pdf.md`.

Esta atualização preserva a redação do documento, inclusive eventuais erros de digitação do original. Exemplos como `ajuste o os detalhes`, `marcado`, `Pectus Escatavum` e `trinta à setenta graus` não foram corrigidos editorialmente. Não foram usadas fontes externas para substituir o texto fornecido.

As instruções do PDF sobre botões e a quantidade de imagens são especificações da interface, não texto clínico. Elas não aparecem nos parágrafos do app. O aviso educacional e o aviso geral de Quando complementar? são mantidos. A numeração da Rotação Medial e da Rotação Lateral permanece separada e fiel ao documento.

## Aplicar na hospedagem

1. No phpMyAdmin, selecione o banco que a API utiliza e exporte uma cópia antes da atualização.
2. Importe **database/manual-correction.sql**. Ele substitui os textos dos 28 conteúdos originais, corrige seus vínculos/títulos/páginas e atualiza o aviso educacional. Não altera clientes, senhas, permissões Premium das contas, anúncios, mídias ou arquivos.
3. Extraia **api/storage/atualizacao-conteudos-pdf.zip** em **public_html/app_mamografia**, mantendo as pastas `api/controllers` e `preview` e substituindo os arquivos existentes. Esse pacote contém a API de conteúdos e a versão web atualizadas; não inclui credenciais nem `local.php`.
4. Abra o site com **Ctrl+F5**. Confira Orientações, Perfil Médio-Lateral, Perfil Látero-Medial, as duas rotações e os tópicos de Quando complementar?.

Apenas enviar arquivos não atualiza os textos armazenados no banco. A importação do SQL é necessária. Não execute `schema.sql` nem reimporte o banco inteiro para esta correção. O pacote não altera a instalação do painel de gestão; o pacote completo `atualizacao-painel.zip` também foi atualizado para incluir o SQL desta correção.

Localmente a correção já foi aplicada. Um backup dos textos anteriores foi salvo em `api/storage/manual-backup-*.json`, fora do acesso público. Para regenerar a transcrição: `python scripts/prepare-manual-correction.py`; para aplicá-la localmente: `php scripts/apply-manual-correction.php`. O importador inicial também usa a transcrição verificada e mantém a formatação extraída do PDF.

## Verificação de fidelidade

`tests/manual_fidelity.py` extrai o texto diretamente do PDF por um caminho independente do importador e compara o fluxo integral ao servido pela API. Também verifica cada tópico, o hash do PDF, os destaques, os marcadores, a sequência de etapas e as diferenças entre ML/LM. Apenas espaços de diagramação são normalizados para a quebra de linha se adaptar à tela.

`tests/manual_browser.py` compara os parágrafos efetivamente exibidos pelo navegador com os da API nos 28 tópicos. Confere navegação entre tópicos, retorno e resposta lenta, além das listas e rotações. Capturas em `test-results/manual-*.png`.

A tela usa o ID da rota como fonte do tópico e só exibe o texto quando ele pertence a esse mesmo ID. Isso evita mostrar um texto anterior sob o título de outro posicionamento durante a navegação.

## Ajustes de leitura e idioma

As etapas aparecem numeradas, uma abaixo da outra, com a numeração original. Critérios de qualidade e erros comuns aparecem em itens separados, mantendo as palavras e a pontuação. A formatação também funciona com respostas antigas da API, sem os metadados de parágrafos. A linha “Fonte: Manual de Posicionamentos · páginas …” foi retirada da tela; os dados de origem continuam armazenados para conferência.

A versão web declara português do Brasil (`pt-BR`) e inclui as marcações `translate="no"` e `notranslate`. Isso orienta os tradutores automáticos a preservar os termos do manual e os títulos “Início” e “Erros comuns”. O modelo HTML está em `mobile/public/index.html`, para que os ajustes sejam mantidos nas próximas exportações.

Para aplicar somente esses ajustes visuais, substitua a pasta `preview` na hospedagem pela versão deste pacote e recarregue o navegador. Eles não exigem importar SQL novamente. Se a correção anterior dos textos do PDF ainda não foi aplicada ao banco, siga também os passos de importação acima.

## Galeria de imagens

As imagens da biblioteca, dos tópicos e dos favoritos aparecem em miniaturas quadradas, com três por linha no celular e mais colunas em telas maiores. Tocar na miniatura abre diretamente a imagem ampliada, com zoom, navegação entre fotos e opção de salvar nos favoritos. Os vídeos mantêm seus cartões e o acesso Premium continua sendo verificado antes de abrir a mídia.

Essa alteração está na pasta `preview` dos pacotes atualizados e não exige importar SQL. Após substituir a pasta na hospedagem, recarregue o navegador.

## Tela inicial compacta

A home usa o cabeçalho da marca e a frase “Seu guia de posicionamento, sempre por perto.”, seguidos dos dois atalhos de vídeos e imagens lado a lado. O banner rosa foi removido por completo. Os cinco módulos aparecem em linhas de menor altura, com o nome, a indicação Gratuito/Premium e a seta de acesso. Os textos do manual continuam iguais.

Para aplicar essa alteração visual, substitua somente a pasta `preview` na hospedagem e recarregue o navegador. Não exige importar SQL novamente.

## Biblioteca e favoritos

O banner “Aprenda com cada detalhe” e os três contadores foram retirados da biblioteca. A busca e os filtros aparecem logo após o cabeçalho. Nos favoritos, a estrela decorativa e a frase “Seu aprendizado, do seu jeito” foram removidas; a orientação e o botão para entrar na conta permanecem disponíveis.

Esses ajustes também são aplicados substituindo a pasta `preview`, sem nova importação de SQL.
