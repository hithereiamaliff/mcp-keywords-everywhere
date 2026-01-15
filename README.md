# Keywords Everywhere MCP Server

[![smithery badge](https://smithery.ai/badge/@hithereiamaliff/mcp-keywords-everywhere)](https://smithery.ai/server/@hithereiamaliff/mcp-keywords-everywhere)

A Model Context Protocol (MCP) server that provides access to the Keywords Everywhere API for SEO research and keyword analysis. This server enables AI assistants like Claude to perform keyword research, analyze search volumes, get competition data, and access various SEO metrics.

Do note that this is **NOT** an official MCP server by Keywords Everywhere.

## Features

- **Keyword Data Analysis**: Get search volume, CPC, and competition data for keywords
- **Related Keywords**: Find related keywords and "People Also Search For" suggestions
- **Domain Analysis**: Analyze what keywords a domain or URL ranks for
- **Traffic Metrics**: Get traffic estimates and costs for domains and URLs
- **Backlink Analysis**: Retrieve backlink data for domains and pages
- **Account Management**: Check your Keywords Everywhere credit balance
- **Multi-Country Support**: Analyze keywords across different countries and currencies

## Quick Start (Hosted Server)

The easiest way to use this MCP server is via the hosted endpoint. No installation required!

### Server URL
```
https://mcp.techmavie.digital/keywords-everywhere/mcp
```

### Analytics Dashboard
```
https://mcp.techmavie.digital/keywords-everywhere/analytics/dashboard
```

### Using Your Own API Key

You can use your own Keywords Everywhere API key by appending it to the URL:
```
https://mcp.techmavie.digital/keywords-everywhere/mcp?apiKey=YOUR_API_KEY
```

Or via header: `X-API-Key: YOUR_API_KEY`

### Compatible Clients

This server works with any Streamable HTTP transport compatible client:
- Claude Desktop/Mobile App
- Claude Code
- Cursor
- VS Code
- Windsurf
- And many more

## Installation (Self-Hosted)

If you prefer to run your own instance:

### Prerequisites

- Node.js 18.0.0 or higher
- A Keywords Everywhere API key (get one from [Keywords Everywhere](https://keywordseverywhere.com/))

### NPX (Quick Start)

```bash
KEYWORDS_EVERYWHERE_API_KEY=your_api_key npx mcp-keywords-everywhere
```

### Global Installation

```bash
npm install -g mcp-keywords-everywhere
```

## Configuration

### For Claude Desktop (Hosted Server - Recommended)

Simply add the server URL in Claude Desktop's MCP settings:
```
https://mcp.techmavie.digital/keywords-everywhere/mcp
```

To use your own API key:
```
https://mcp.techmavie.digital/keywords-everywhere/mcp?apiKey=YOUR_API_KEY
```

### For Claude Desktop (Self-Hosted)

Add the following to your Claude Desktop configuration file:

**Location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "keywords-everywhere": {
      "command": "npx",
      "args": ["-y", "mcp-keywords-everywhere"],
      "env": {
        "KEYWORDS_EVERYWHERE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

### Account Management
- `get_credits` - Check your account's credit balance
- `get_countries` - Get list of supported countries
- `get_currencies` - Get list of supported currencies

### Keyword Research
- `get_keyword_data` - Get volume, CPC, and competition data for keywords
- `get_related_keywords` - Find related keywords based on a seed keyword
- `get_pasf_keywords` - Get "People Also Search For" keywords

### Domain Analysis
- `get_domain_keywords` - Get keywords that a domain ranks for
- `get_url_keywords` - Get keywords that a specific URL ranks for
- `get_domain_traffic` - Get traffic metrics for a domain
- `get_url_traffic` - Get traffic metrics for a URL

### Backlink Analysis
- `get_domain_backlinks` - Get backlinks for a domain
- `get_unique_domain_backlinks` - Get unique domain backlinks
- `get_page_backlinks` - Get backlinks for a specific page
- `get_unique_page_backlinks` - Get unique backlinks for a page

## Usage Examples

### Basic Keyword Research
```
"Get keyword data for 'SEO tools' and 'keyword research' for Malaysia"
```

### Domain Analysis
```
"What keywords does example.com rank for?"
```

### Traffic Analysis
```
"Get traffic metrics for https://example.com"
```

### Backlink Research
```
"Show me the top 20 backlinks for example.com"
```

## API Key Setup

1. Sign up at [Keywords Everywhere](https://keywordseverywhere.com/)
2. Purchase credits for API access
3. Get your API key from the dashboard
4. Add the API key to your environment variables or MCP configuration

## Error Handling

The server includes comprehensive error handling:

- **Authentication errors**: Clear messages for invalid API keys
- **Credit exhaustion**: Helpful messages when credits run out
- **Rate limiting**: Automatic retry with exponential backoff
- **Bad requests**: Detailed error messages with suggestions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/hithereiamaliff/mcp-keywords-everywhere/issues)
- **Keywords Everywhere API**: [Official documentation](https://api.keywordseverywhere.com/docs/#/)

## Development and Deployment

### Prerequisites

- Node.js 18+ installed
- Keywords Everywhere API key
- Docker (for VPS deployment)

### Project Structure

```
mcp-keywords-everywhere/
├── index.js              # Main server file
├── package.json          # Dependencies and scripts
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose configuration
├── deploy/               # Deployment files
│   ├── nginx-mcp.conf    # Nginx configuration
│   └── DEPLOYMENT.md     # Deployment guide
└── README.md             # Documentation
```

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### VPS Deployment

This server is deployed on a VPS with Docker and Nginx reverse proxy. See [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) for detailed deployment instructions.

```bash
# Build and run with Docker
docker compose up -d --build

# Check logs
docker logs mcp-keywords-everywhere -f
```

### GitHub Actions Auto-Deploy

Push to `main` branch triggers automatic deployment to VPS via GitHub Actions.

## Transport Support

This MCP server uses the Streamable HTTP Transport, which is the recommended transport for production use, offering improved scalability, concurrency, and latency compared to STDIO transport.

## Key Benefits

- **No Installation Required**: Use the hosted server URL directly
- **Bring Your Own API Key**: Users can provide their own Keywords Everywhere API key
- **Better Performance**: HTTP transport offers improved scalability and latency
- **Auto-Deploy**: Push to GitHub and changes are automatically deployed

## Changelog

### 1.2.0
- Added hosted server at mcp.techmavie.digital
- Added support for user-provided API keys via URL query param
- Fixed MCP protocol compliance for Claude Desktop
- Added Docker and VPS deployment support
- Added GitHub Actions auto-deploy
- Added analytics dashboard with real-time usage statistics

### 1.1.0
- Migrated from STDIO to Streamable HTTP transport
- Added support for both transport types
- Improved session management
- Enhanced error handling

### 1.0.0
- Initial release
- Support for all major Keywords Everywhere API endpoints
- Comprehensive error handling and retry logic
- MCP protocol compliance
- Cross-platform compatibility

## Related

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Keywords Everywhere](https://keywordseverywhere.com/)
- [Claude Desktop](https://claude.ai/)