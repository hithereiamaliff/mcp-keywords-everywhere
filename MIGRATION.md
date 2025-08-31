# MCP Server Migration: STDIO to TypeScript Smithery CLI

This document details the migration of the Keywords Everywhere MCP server from STDIO transport to TypeScript Smithery CLI with HTTP transport as required by Smithery's sunset notice.

## Migration Overview

Smithery announced the discontinuation of support for STDIO transport on remotely hosted MCP servers by September 7, 2025. This migration updates the server to use the recommended TypeScript Smithery CLI approach with HTTP transport, which offers improved scalability, concurrency, and latency.

The TypeScript Smithery CLI approach is the recommended migration path for TypeScript projects, providing built-in development tools, automatic deployment, and containerization with minimal configuration.

## Prerequisites

- Node.js 18+ installed
- GitHub repository for deployment
- Keywords Everywhere API key

## Changes Made

### 1. Server Code Updates

- Migrated from JavaScript to TypeScript
- Converted to use the Smithery CLI architecture
- Created a proper `createServer` export function
- Implemented proper TypeScript types for all functions
- Moved server code to `src/index.ts`
- Enhanced error handling and response formatting

### 2. Configuration Updates

- Updated `smithery.yaml` configuration file for TypeScript runtime
- Added configuration schema for API key management
- Simplified server configuration with Smithery CLI defaults
- Created `tsconfig.json` for TypeScript configuration

### 3. Package.json Updates

- Added `module` field pointing to `./src/index.ts`
- Added required scripts:
  - `"build": "npx @smithery/cli build"`
  - `"dev": "npx @smithery/cli dev"`
- Added devDependencies:
  - `@smithery/cli`: For Smithery CLI development and deployment
  - `tsx`: For TypeScript execution

### 4. Environment Variables

- `KEYWORDS_EVERYWHERE_API_KEY`: API key for Keywords Everywhere (required)

## Project Structure

The project structure has been updated to follow Smithery CLI best practices:

```
mcp-keywords-everywhere/
├── src/
│   └── index.ts          # Main server file with createServer export
├── package.json          # Updated with Smithery CLI scripts
├── smithery.yaml         # Smithery runtime configuration
├── tsconfig.json         # TypeScript configuration
└── README.md             # Documentation
```

## Testing

The server can be tested locally using the Smithery CLI:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

This will start a development server with hot reloading and provide a link to the Smithery playground for testing.

## Deployment

The server can be deployed to Smithery using the following steps:

1. Build the server:
   ```bash
   npm run build
   ```

2. Push changes to your GitHub repository

3. Wait a few minutes for auto-deploy, or manually trigger deployment from your Smithery server dashboard

## Key Benefits

- **Simplified Development**: Built-in development tools with hot reloading
- **Automatic Deployment**: Push to GitHub and Smithery handles the rest
- **No Dockerfile Needed**: Smithery CLI handles containerization
- **Type Safety**: Full TypeScript support with proper type checking
- **Better Performance**: HTTP transport offers improved scalability and latency

## Future Considerations

- Add unit tests for all tool handlers
- Implement more robust error handling
- Add authentication for HTTP transport
- Optimize response formatting for different data types
