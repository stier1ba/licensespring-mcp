FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Install dependencies and build
RUN npm ci && npm run build

# Make the binary executable
RUN chmod +x dist/*.js

# Set the entrypoint
ENTRYPOINT ["node", "dist/license-api-server.js"]
