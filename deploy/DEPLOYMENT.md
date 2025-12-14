# VPS Deployment Guide for Keywords Everywhere MCP

This guide explains how to deploy the Keywords Everywhere MCP server on your VPS at `mcp.techmavie.digital/keywords-everywhere`.

## Prerequisites

- VPS with Ubuntu/Debian (IP: 202.61.238.12)
- Docker and Docker Compose installed
- Nginx installed
- Domain `mcp.techmavie.digital` pointing to your VPS IP
- SSL certificate (via Certbot/Let's Encrypt)
- Keywords Everywhere API key

## Architecture

```
Client (Claude, Cursor, etc.)
    ↓ HTTPS
https://mcp.techmavie.digital/keywords-everywhere/mcp
    ↓
Nginx (SSL termination + reverse proxy)
    ↓ HTTP
Docker Container (port 3001 → 3000)
    ↓
Keywords Everywhere API
```

## Deployment Steps

### 1. SSH into your VPS

```bash
ssh root@202.61.238.12
```

### 2. Create directory for the MCP server

```bash
mkdir -p /opt/mcp-servers/keywords-everywhere
cd /opt/mcp-servers/keywords-everywhere
```

### 3. Clone the repository

```bash
git clone https://github.com/hithereiamaliff/mcp-keywords-everywhere.git .
```

### 4. Create environment file

```bash
cp .env.example .env
nano .env
```

Add your Keywords Everywhere API key:
```env
KEYWORDS_EVERYWHERE_API_KEY=your_api_key_here
```

### 5. Build and start the Docker container

```bash
docker compose up -d --build
```

### 6. Verify the container is running

```bash
docker compose ps
docker compose logs -f
```

### 7. Test the health endpoint

```bash
curl http://localhost:3001/mcp
```

### 8. Configure Nginx

Add the location block from `deploy/nginx-mcp.conf` to your existing nginx config for `mcp.techmavie.digital`:

```bash
# Edit your existing nginx config
sudo nano /etc/nginx/sites-available/mcp.techmavie.digital

# Add the location block from deploy/nginx-mcp.conf inside the server block

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 9. Test the MCP endpoint

```bash
# Test health endpoint through nginx
curl https://mcp.techmavie.digital/keywords-everywhere/mcp

# Test MCP endpoint
curl -X POST https://mcp.techmavie.digital/keywords-everywhere/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

## Client Configuration

### For Claude Desktop / Cursor / Windsurf

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "keywords-everywhere": {
      "transport": "streamable-http",
      "url": "https://mcp.techmavie.digital/keywords-everywhere/mcp"
    }
  }
}
```

### For MCP Inspector

```bash
npx @modelcontextprotocol/inspector
# Select "Streamable HTTP"
# Enter URL: https://mcp.techmavie.digital/keywords-everywhere/mcp
```

## Management Commands

### View logs

```bash
cd /opt/mcp-servers/keywords-everywhere
docker compose logs -f
```

### Restart the server

```bash
docker compose restart
```

### Update to latest version

```bash
git pull origin main
docker compose up -d --build
```

### Stop the server

```bash
docker compose down
```

## GitHub Actions Auto-Deploy

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-vps.yml`) that automatically deploys to your VPS when you push to the `main` branch.

### Required GitHub Secrets

Set these in your repository settings (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | Your VPS IP address (e.g., 202.61.238.12) |
| `VPS_USERNAME` | SSH username (e.g., root) |
| `VPS_SSH_KEY` | Your private SSH key |
| `VPS_PORT` | SSH port (usually 22) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port (internal) |
| `HOST` | 0.0.0.0 | Bind address |
| `TRANSPORT_TYPE` | http | Transport type (http or stdio) |
| `KEYWORDS_EVERYWHERE_API_KEY` | (required) | Your Keywords Everywhere API key |

## Troubleshooting

### Container not starting

```bash
docker compose logs mcp-keywords-everywhere
```

### Nginx 502 Bad Gateway

- Check if container is running: `docker compose ps`
- Check container logs: `docker compose logs`
- Verify port binding: `docker port mcp-keywords-everywhere`

### API key issues

Make sure your `.env` file contains a valid `KEYWORDS_EVERYWHERE_API_KEY`.

### Test MCP connection

```bash
# List tools
curl -X POST https://mcp.techmavie.digital/keywords-everywhere/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

## Security Notes

- The MCP server runs behind nginx with SSL
- API key is stored in `.env` file (not committed to git)
- CORS is configured to allow all origins (required for MCP clients)
- Rate limiting can be added at nginx level if needed
