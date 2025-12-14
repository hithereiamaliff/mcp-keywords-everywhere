# Keywords Everywhere MCP Server - Streamable HTTP
# For self-hosting on VPS with nginx reverse proxy

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001
RUN chown -R mcp:nodejs /app
USER mcp

# Expose port for HTTP server
EXPOSE 3000

# Environment variables (can be overridden at runtime)
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TRANSPORT_TYPE=http

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the HTTP server
CMD ["node", "index.js"]