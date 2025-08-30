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

## Installation

### Installing via Smithery

To install mcp-keywords-everywhere for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@hithereiamaliff/mcp-keywords-everywhere):

```bash
npx -y @smithery/cli install @hithereiamaliff/mcp-keywords-everywhere --client claude
```

### Prerequisites

- Node.js 16.0.0 or higher
- A Keywords Everywhere API key (get one from [Keywords Everywhere](https://keywordseverywhere.com/))

### Quick Installation (NPX)

The easiest way to use this MCP server is with npx:

```bash
npx mcp-keywords-everywhere
```

### Global Installation

```bash
npm install -g mcp-keywords-everywhere
```

### Smithery Installation

You can also use this MCP server through Smithery:

1. Connect to the server using the Smithery URL:
   ```
   server.smithery.ai/@hithereiamaliff/mcp-keywords-everywhere
   ```

2. Smithery works with any streamable HTTP transport compatible client including:
   - Claude Desktop
   - Claude Code
   - Gemini CLI
   - Raycast
   - Cursor
   - VS Code
   - And many more

For more information, visit [Smithery](https://smithery.ai/server/@hithereiamaliff/mcp-keywords-everywhere).

## Configuration

### For Claude Desktop

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

### For Other MCP Clients

If you're using other MCP clients, you can run the server directly:

```bash
KEYWORDS_EVERYWHERE_API_KEY=your_api_key_here npx mcp-keywords-everywhere
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

## Changelog

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
