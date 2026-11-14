# Microvida 3D — Saúde, vírus, bactérias e vacinas

Simulador 3D interativo de Ciências para o **7º ano · 4º bimestre** (Currículo Paulista), cobrindo as Aulas 1 a 17: saúde e SUS, vírus, bactérias, doenças, pandemias, sistema imune, vacinas, saneamento básico e indicadores de saúde. Habilidades **EF07CI09, EF07CI10 e EF07CI11**.

## O que tem
- **Explorar:** 8 modelos 3D clicáveis — vírus envelopado, bacteriófago, bactéria (bacilo), formas das bactérias, escala microscópica real (célula × hemácia × bactéria × vírus), células de defesa, corpo com órgãos linfoides e o mosquito *Aedes aegypti*. Cada estrutura tem ficha com função, curiosidade, saúde e prevenção e leitura em voz alta. Partes com liga/desliga e transparência, **corte** para ver o interior, rótulos, giro automático, foto e tela cheia.
- **Simular:** 7 simulações em 3D — replicação viral; bactérias e antibióticos (resistência); resposta imune e vacina (memória imunológica); propagação e imunidade de rebanho; cidade e saneamento básico; fabricação de vacinas; indicadores de saúde.
- **Habilidades:** as 3 habilidades e as 17 aulas, cada uma com atalho para o recurso 3D.
- **Quiz:** banco de 38 questões (10 sorteadas por rodada).
- **Desafio:** encontre a estrutura no modelo 3D.
- **Saiba mais:** como usar, glossário e referências.

## Publicar no GitHub Pages
1. Crie um repositório (ex.: `microvida-3d`) e envie **todo o conteúdo desta pasta** (o `index.html` deve ficar na raiz).
2. Em **Settings → Pages**, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. O endereço será `https://SEU-USUARIO.github.io/microvida-3d/`.

Também funciona abrindo o `index.html` direto no navegador, sem instalação.

## Técnica
HTML, CSS e JavaScript puros, com [three.js](https://threejs.org/) r147 (licença MIT) incluído em `js/vendor/`. Todos os modelos são construídos por código (procedurais), sem arquivos 3D externos.

- `js/dados.js` — fichas, aulas, habilidades, quiz, desafio, glossário
- `js/modelos.js` — modelos 3D
- `js/simulacoes.js` — simulações
- `js/app.js` — palco 3D, painel e abas
