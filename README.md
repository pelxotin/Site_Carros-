# AutoPrime - Marketplace de Carros

Site estático para marketplace de carros com integração à API FIPE.

## Estrutura

- `index.html` - Página principal
- `styles.css` - Estilos do site
- `script.js` - Lógica JavaScript e integração com API

## Deploy no Vercel

Este projeto pode ser deployado diretamente no Vercel sem configuração adicional.

### Opção 1: Via Interface Web (Mais Fácil)

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com GitHub, GitLab ou Bitbucket
3. Clique em "Add New Project"
4. Importe seu repositório ou faça upload dos arquivos
5. O Vercel detectará automaticamente que é um site estático
6. Clique em "Deploy"

### Opção 2: Via CLI

1. Instale o Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. No diretório do projeto, execute:
   ```bash
   vercel
   ```

3. Siga as instruções no terminal
4. Para fazer deploy em produção:
   ```bash
   vercel --prod
   ```

## Notas

- O site usa a API FIPE que pode ter rate limiting
- Cache é usado para melhorar performance
- Funciona como SPA (Single Page Application)

