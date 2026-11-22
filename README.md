# chess-frontend

Frontend web do jogo de xadrez, implementado com React 19, TypeScript e Vite. A aplicação apresenta o tabuleiro e consome a API do [chess-backend](https://github.com/ES2-Chess-Game/chess-backend#readme).

## Requisitos e execução

É necessário ter Node.js e npm. O backend deve estar executando em `http://localhost:8080` para criar partidas e enviar lances.

Na raiz deste repositório, instale dependências e inicie o Vite:

```powershell
npm install
npm run dev
```

Abra `http://localhost:5173`. O backend configura CORS especificamente para essa origem. Consulte o [README do chess-backend](https://github.com/ES2-Chess-Game/chess-backend#readme) para iniciar a API.

## Como a interface funciona

1. Ao montar a tela, `App` solicita uma partida com `POST /api/partidas`.
2. O tabuleiro e o turno exibidos vêm da resposta do backend.
3. Selecione uma peça da cor da vez e depois uma casa de destino. A interface envia as coordenadas de origem e destino para `POST /api/partidas/{id}/lances`.
4. Se o backend aceitar o lance, a tela atualiza o estado da partida, alterna o turno e acrescenta a notação do movimento ao histórico local.
5. Use **Nova partida** para solicitar outra partida.

As duas cores são controladas pela mesma interface: não há jogada automática do computador no código atual. A lista de movimentos é mantida no estado do frontend e não é recuperada da API. Os horários exibidos no tabuleiro são valores fixos, não cronômetros.

## Arquitetura

- [`src/main.tsx`](src/main.tsx) monta a aplicação React dentro de `StrictMode`.
- [`src/App.tsx`](src/App.tsx) contém a tela, os tipos usados nas respostas, o estado da partida/seleção/movimentos/erro/carregamento e as chamadas `fetch`.
- [`src/App.css`](src/App.css) e [`src/index.css`](src/index.css) definem os estilos da tela e a base global.
- [`index.html`](index.html) fornece o elemento raiz e carrega a aplicação; [`vite.config.ts`](vite.config.ts) configura o plugin React do Vite.

O estado está concentrado no componente `App`; o código atual não possui roteamento ou uma camada de cliente HTTP separada. O endereço da API é constante no frontend: `http://localhost:8080/api/partidas`. A validação das regras é responsabilidade do backend; o frontend envia o lance e apresenta o resultado ou erro recebido.

## API consumida

| Operação | Método e caminho |
| --- | --- |
| Criar partida | `POST /api/partidas` |
| Enviar movimento | `POST /api/partidas/{id}/lances` |

O corpo enviado para um movimento contém `origemLinha`, `origemColuna`, `destinoLinha` e `destinoColuna`, todos numéricos. As coordenadas são índices de `0` a `7` da matriz do tabuleiro. O frontend não chama atualmente o endpoint `GET /api/partidas/{id}`.

## Scripts disponíveis

| Comando | Ação |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento Vite. |
| `npm run build` | Executa a verificação TypeScript (`tsc -b`) e gera a build Vite. |
| `npm run lint` | Executa Oxlint. |
| `npm run preview` | Serve localmente a build gerada. |

O `package.json` não define um script de testes.

Para o overview do projeto e os documentos gerais, consulte o [README do chess-docs](https://github.com/ES2-Chess-Game/chess-docs#readme).
