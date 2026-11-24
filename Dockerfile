# Imagem do qaops-tarefas para rodar na VM.
# Node 22 porque o banco usa o modulo nativo node:sqlite (Node >= 22.5).
FROM node:22-alpine

WORKDIR /app

# Instala so as dependencias de producao, exatamente as do package-lock.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

# O banco SQLite fica em /app/data, montado como volume no docker-compose
# para nao se perder quando o container e recriado.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
