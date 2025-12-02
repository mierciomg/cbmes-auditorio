# Imagem base
FROM node:20-alpine

# Diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia apenas arquivos de dependência primeiro (para cache)
COPY package*.json ./

# Instala dependências (produção)
RUN npm ci --omit=dev

# Copia o restante do código
COPY . .

# Garante que a pasta de uploads existe
RUN mkdir -p /usr/src/app/src/uploads

# Define ambiente padrão (pode ser sobrescrito)
ENV NODE_ENV=production

# Expõe a porta da aplicação
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "src/app.js"]
