FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY src/ ./src/
RUN npm ci --ignore-scripts && npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
# MCP stdio server: run with `docker run -i --env-file .env <image>`
ENTRYPOINT ["node", "dist/license-api-server.js"]
