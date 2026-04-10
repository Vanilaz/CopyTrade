FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY Server/package*.json ./

# Install dependencies
RUN npm ci --production

# Copy server files
COPY Server/ ./
COPY Config/ ../Config/

# Create data directory
RUN mkdir -p data

# Expose ports
EXPOSE 5555 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:${PORT:-8080}/health || exit 1

CMD ["node", "server.js"]
