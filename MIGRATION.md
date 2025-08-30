# MCP Server Migration: STDIO to Streamable HTTP

This document details the migration of the Keywords Everywhere MCP server from STDIO transport to Streamable HTTP transport as required by Smithery's sunset notice.

## Migration Overview

Smithery announced the discontinuation of support for STDIO transport on remotely hosted MCP servers by September 7, 2025. This migration updates the server to use the recommended Streamable HTTP transport, which offers improved scalability, concurrency, and latency.

## Changes Made

### 1. Server Code Updates

- Added support for both STDIO and Streamable HTTP transports
- Implemented manual HTTP transport handling with Express.js
- Added session management for HTTP transport
- Added proper error handling and response formatting
- Maintained backward compatibility with STDIO transport

### 2. Configuration Updates

- Created `smithery.yaml` configuration file for Smithery deployment
- Updated environment variables to control transport type
- Added HTTP server configuration options (host, port)

### 3. Dependencies

Added the following dependencies:
- `express`: For HTTP server implementation
- `dotenv`: For environment variable management

### 4. Environment Variables

- `KEYWORDS_EVERYWHERE_API_KEY`: API key for Keywords Everywhere (required)
- `TRANSPORT_TYPE`: Transport type to use (`stdio` or `http`, defaults to `http`)
- `PORT`: HTTP server port (defaults to 3000)
- `HOST`: HTTP server host (defaults to localhost)

## Testing

The server has been tested locally with both transport types:
- STDIO transport: Works as before
- HTTP transport: Successfully handles initialization and tool invocation requests

## Deployment

The server can be deployed to Smithery using the provided `smithery.yaml` configuration file.

## Future Considerations

- Implement more robust session management
- Add authentication for HTTP transport
- Optimize response streaming for large responses
- Remove STDIO transport support once migration is complete
