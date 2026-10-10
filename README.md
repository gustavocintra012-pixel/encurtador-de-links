# Encurtador de links

Encurtador de links com contador de aberturas, feito com Node.js e Express. Você cola um endereço, recebe um link curto e acompanha quantas vezes ele foi aberto.

Projeto de estudo, parte do meu portfólio: https://gustavocintra012-pixel.github.io/meu-portfolio/

## Funcionalidades

- Cria um link curto com código aleatório de 6 caracteres
- Redireciona o link curto para o endereço original e soma 1 a cada abertura
- Mostra as aberturas de um link, só para quem tem o código secreto gerado na criação
- Página web simples para criar e consultar links

## Tecnologias

- Node.js e Express
- SQLite (biblioteca `better-sqlite3`)
- HTML, CSS e JavaScript puros no front
- `helmet` e `express-rate-limit` para segurança

## Como rodar

Precisa do Node.js instalado.

```bash
git clone https://github.com/gustavocintra012-pixel/encurtador-de-links.git
cd encurtador-de-links
npm install
node server.js
```

Abra `http://localhost:3000`. O arquivo do banco (`links.db`) é criado automaticamente na primeira execução.

## API

| Método | Rota | O que faz |
|---|---|---|
| POST | `/api/links` | Cria um link. Corpo: `{"url": "https://..."}`. Devolve `code`, `shortUrl` e `token` |
| GET | `/:code` | Redireciona para o endereço original e conta a abertura |
| GET | `/api/links/:code/stats` | Devolve as aberturas. Exige o cabeçalho `Authorization: Bearer <token>` |

Exemplo:

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## Decisões de segurança

- **Validação da URL:** só `http` e `https`, sem usuário e senha na URL, sem `localhost` nem redes privadas, com limite de 2048 caracteres
- **Consultas parametrizadas** no banco, contra SQL injection
- **Código secreto:** gerado com `crypto.randomBytes`, e o banco guarda só o hash (SHA-256), nunca o código original
- **Comparação em tempo constante** do hash, e mesma resposta para "link não existe" e "código errado"
- **Limite de requisições:** 20 criações e 100 chamadas à API a cada 15 minutos por visitante
- **Cabeçalhos de segurança** com `helmet`, limite de 10 KB no corpo das requisições e erros sem detalhes internos
- **Front-end:** dados do servidor entram na página como texto (`textContent`), nunca como HTML

## Limitações conhecidas

- O contador conta aberturas do link, não pessoas: robôs e prévias de links (como as do WhatsApp) também somam
- Sem contas de usuário, links personalizados nem data de expiração
- O banco é um arquivo local, então a hospedagem precisa manter o disco entre reinícios

## Próximos passos

- Publicar uma demonstração
- Testes automatizados
- Expiração de links