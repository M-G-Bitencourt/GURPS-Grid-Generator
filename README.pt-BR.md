![HTML5](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![Zero dependências](https://img.shields.io/badge/depend%C3%AAncias-0-brightgreen)

# GURPS Grid Generator

[English](README.md) | **Português (BR)**

Um editor de mapas táticos de grade hexagonal para GURPS e outros RPGs de mesa,
totalmente offline. Crie e salve mapas, pinte terreno, desenhe paredes e gerencie
tokens multi-hex — tudo em uma única página que roda direto no navegador, sem
nenhuma dependência.

## Recursos

- **Pintura de terreno**: clique e arraste para pintar ou apagar cores dos hexágonos (clique direito apaga).
- **Paredes**: arraste sobre as bordas dos hexágonos para adicionar ou remover.
- **Tokens**: 9 formatos, de 1 hexágono até colossal de 19, com nome, cor e direção.
- **Validação multi-hex**: tokens não podem se sobrepor ao criar, mover ou rotacionar.
- **Seleção e edição**: clique em um token para selecioná-lo e edite nome/cor/formato no painel.
- **Teclado**: `R` rotaciona, setas movem, `Delete` remove, `Ctrl+Z`/`Ctrl+Shift+Z` desfaz/refaz.
- **Zoom e navegação**: scroll do mouse para zoom, botão central ou modo Câmera para mover.
- **Coordenadas**: rótulos `q,r` opcionais em cada hexágono.
- **Salvar/Carregar**: arquivos JSON versionados e validados (veja abaixo).
- **Autosave**: a sessão é mantida no `localStorage` e restaurada na próxima visita.
- **Idiomas**: alterne entre português (Brasil) e inglês no painel.
- **Toque**: funciona com eventos de ponteiro em tablets e telas sensíveis ao toque.

## Como usar

Não é preciso build nem servidor:

1. Baixe ou clone este repositório.
2. Abra o `index.html` em qualquer navegador moderno.

Tudo roda localmente; nenhum dado sai da sua máquina.

## Controles

| Ação                    | Entrada                                           |
| ----------------------- | ------------------------------------------------- |
| Adicionar token         | Clique em um hexágono vazio (modo Tokens)         |
| Mover token             | Arraste o token (modo Tokens)                     |
| Remover token           | Clique direito, ou selecione e pressione `Delete` |
| Rotacionar token        | Pressione `R` sobre/com o token selecionado       |
| Mover token selecionado | Teclas de seta                                    |
| Pintar / apagar terreno | Clique e arraste (clique direito apaga)           |
| Desenhar paredes        | Arraste sobre as bordas (modo Paredes)            |
| Mover a câmera          | Botão central do mouse, ou arraste no modo Câmera |
| Zoom                    | Scroll do mouse                                   |
| Desfazer / refazer      | `Ctrl+Z` / `Ctrl+Shift+Z` (ou `Ctrl+Y`)           |
| Desmarcar / centralizar | `Esc` / botão Centralizar                         |

## Formato de salvamento

Os mapas são arquivos JSON simples. O formato é versionado e validado ao
carregar; entradas malformadas são descartadas em vez de quebrar o aplicativo.

```json
{
    "version": 1,
    "mapName": "example_map",
    "camera": { "x": 60, "y": 40 },
    "entities": {
        "0,0": {
            "name": "Hero",
            "color": "#3399ff",
            "shape": [{ "q": 0, "r": 0 }],
            "facing": 0
        }
    },
    "walls": ["0,0|1,-1"],
    "hexColors": { "1,0": "#a3d9a5" }
}
```

Um arquivo de exemplo está disponível em [`examples/example_map.json`](examples/example_map.json).

## Desenvolvimento

Requisitos: Node.js 20+.

```sh
npm install       # instala as ferramentas de desenvolvimento (ESLint, Prettier, Vitest)
npm run lint      # análise estática
npm run format    # aplica formatação de código
npm test          # testes unitários
npm run check     # lint + checagem de formatação + testes
```

O aplicativo em si não tem dependências de execução — as ferramentas são usadas
apenas em desenvolvimento e na CI.

## Criação de mapas

![grid_paint](./assets/grid_paint2.gif)

## Grande variedade de tokens

![token creation](./assets/token_creation2.gif)

## Criação e movimentação simples

![token movement](./assets/token_move2.gif)

## Licença

[MIT](LICENSE)
