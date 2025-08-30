#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import axios from "axios";
import { z } from "zod";
import dotenv from "dotenv";
import http from "http";

// Load environment variables from .env file
dotenv.config();

const BASE_URL = "https://api.keywordseverywhere.com/v1";
const API_KEY = process.env.KEYWORDS_EVERYWHERE_API_KEY;

if (!API_KEY) {
  console.error("Error: KEYWORDS_EVERYWHERE_API_KEY environment variable is required");
  process.exit(1);
}

const TOOLS = {
  // Account
  get_credits: {
    name: "get_credits",
    description: "Get your account's credit balance",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },

  // Countries and Currencies
  get_countries: {
    name: "get_countries",
    description: "Get list of supported countries",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },

  get_currencies: {
    name: "get_currencies",
    description: "Get list of supported currencies",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },

  // Keyword Data
  get_keyword_data: {
    name: "get_keyword_data",
    description: "Get Volume, CPC and competition for a set of keywords",
    inputSchema: {
      type: "object",
      properties: {
        keywords: { 
          type: "array",
          items: { type: "string" },
          description: "List of keywords to analyze"
        },
        country: { 
          type: "string", 
          description: "Country code (empty string for Global, 'us' for United States, etc.)",
          default: ""
        },
        currency: {
          type: "string",
          description: "Currency code (e.g., 'myr' for Malaysian Ringgit)",
          default: "myr"
        }
      },
      required: ["keywords"]
    }
  },

  // Related Keywords
  get_related_keywords: {
    name: "get_related_keywords",
    description: "Get related keywords based on a seed keyword",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Seed keyword to find related terms for"
        },
        num: {
          type: "integer",
          description: "Number of results to return (max 1000)",
          default: 10
        }
      },
      required: ["keyword"]
    }
  },

  // People Also Search For
  get_pasf_keywords: {
    name: "get_pasf_keywords",
    description: "Get 'People Also Search For' keywords based on a seed keyword",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Seed keyword to find PASF terms for"
        },
        num: {
          type: "integer",
          description: "Number of results to return (max 1000)",
          default: 10
        }
      },
      required: ["keyword"]
    }
  },

  // Domain Keywords
  get_domain_keywords: {
    name: "get_domain_keywords",
    description: "Get keywords that a domain ranks for",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to analyze (e.g., example.com)"
        },
        country: {
          type: "string",
          description: "Country code (empty string for Global, 'us' for United States, etc.)",
          default: ""
        },
        num: {
          type: "integer",
          description: "Number of results to return (max 1000)",
          default: 10
        }
      },
      required: ["domain"]
    }
  },

  // URL Keywords
  get_url_keywords: {
    name: "get_url_keywords",
    description: "Get keywords that a URL ranks for",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to analyze"
        },
        country: {
          type: "string",
          description: "Country code (empty string for Global, 'us' for United States, etc.)",
          default: ""
        },
        num: {
          type: "integer",
          description: "Number of results to return (max 1000)",
          default: 10
        }
      },
      required: ["url"]
    }
  },

  // Traffic Metrics
  get_domain_traffic: {
    name: "get_domain_traffic",
    description: "Get traffic metrics for a domain",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to analyze (e.g., example.com)"
        },
        country: {
          type: "string",
          description: "Country code (empty string for Global, 'us' for United States, etc.)",
          default: ""
        }
      },
      required: ["domain"]
    }
  },

  get_url_traffic: {
    name: "get_url_traffic",
    description: "Get traffic metrics for a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to analyze"
        },
        country: {
          type: "string",
          description: "Country code (empty string for Global, 'us' for United States, etc.)",
          default: ""
        }
      },
      required: ["url"]
    }
  },

  // Backlinks
  get_domain_backlinks: {
    name: "get_domain_backlinks",
    description: "Get backlinks for a domain",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to analyze (e.g., example.com)"
        },
        num: {
          type: "integer",
          description: "Number of results to return (max 1000)",
          default: 10
        }
      },
      required: ["domain"]
    }
  },

  get_unique_domain_backlinks: {
    name: "get_unique_domain_backlinks",
    description: "Get unique domain backlinks",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain to analyze (e.g., example.com)"
        },
        num: {
          type: "integer",
          description: "Number of results to return (max 1000)",
          default: 10
        }
      },
      required: ["domain"]
    }
  },

  get_page_backlinks: {
    name: "get_page_backlinks",
    description: "Get backlinks for a specific URL",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to analyze"
        },
        num: {
          type: "integer",
          description: "Number of results to return (max 1000)",
          default: 10
        }
      },
      required: ["url"]
    }
  },

  get_unique_page_backlinks: {
    name: "get_unique_page_backlinks",
    description: "Get unique backlinks for a specific URL",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to analyze"
        },
        num: {
          type: "integer",
          description: "Number of results to return (max 1000)",
          default: 10
        }
      },
      required: ["url"]
    }
  }
};

const server = new McpServer({
  name: "mcp-keywords-everywhere", 
  version: "1.0.0"
});

// Helper function for API calls
async function makeApiCall(endpoint, data = null, retryCount = 0) {
  try {
    const url = `${BASE_URL}/${endpoint}`;
    console.error(`Calling Keywords Everywhere API: ${endpoint}`);
    
    const config = {
      method: data ? 'post' : 'get',
      url,
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/json"
      }
    };
    
    // Handle different types of data
    if (data instanceof URLSearchParams) {
      config.data = data;
      config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.error(`API Response Status: ${response.status}`);
    
    return response.data;
  } catch (error) {
    // Extract detailed error information
    const statusCode = error.response?.status;
    const errorMessage = error.response?.data?.message || error.response?.data || error.message;
    
    // Log detailed error information
    console.error(`Error calling Keywords Everywhere API (${endpoint}):`, {
      statusCode,
      errorMessage,
      endpoint,
      data
    });
    
    // Handle specific error codes
    if (statusCode === 400) {
      // For 400 Bad Request errors, provide more helpful error messages
      let enhancedMessage = `Bad Request (400): ${errorMessage}`;
      
      // Add specific guidance based on common 400 errors
      if (errorMessage.includes("credit") || errorMessage.includes("credits")) {
        enhancedMessage += ". You may need to add more credits to your Keywords Everywhere account.";
      } else if (errorMessage.includes("subscription") || errorMessage.includes("plan")) {
        enhancedMessage += ". This may be due to a subscription plan limitation. Please check your current plan.";
      } else if (errorMessage.includes("limit") || errorMessage.includes("rate")) {
        enhancedMessage += ". You may have hit a rate limit. Try again later.";
      }
      
      const customError = new Error(enhancedMessage);
      customError.statusCode = statusCode;
      customError.originalError = error;
      throw customError;
    } else if (statusCode === 401) {
      throw new Error(`Authentication failed (401): Please check your API key`);
    } else if (statusCode === 429) {
      // Rate limiting - implement retry with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.error(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeApiCall(endpoint, data, retryCount + 1);
      } else {
        throw new Error(`Rate limit exceeded (429): Too many requests. Please try again later.`);
      }
    } else {
      // For other errors, pass through with some additional context
      throw new Error(`API Error (${statusCode || 'unknown'}): ${errorMessage}`);
    }
  }
}

// API endpoint handlers
const handlers = {
  // Account
  get_credits: async () => makeApiCall("account/credits"),
  
  // Countries and Currencies
  get_countries: async () => makeApiCall("countries"),
  get_currencies: async () => makeApiCall("currencies"),
  
  // Keyword Data
  get_keyword_data: async (args) => {
    // Keywords Everywhere API expects "kw[]" format for each keyword
    const params = new URLSearchParams();
    
    // Add each keyword individually to match API expectations
    if (Array.isArray(args.keywords)) {
      args.keywords.forEach(keyword => {
        params.append("kw[]", keyword);
      });
    }
    
    // Add other parameters
    params.append("country", args.country || "");  // Default to global if not specified
    params.append("currency", args.currency || "myr");  // Default to Malaysian Ringgit
    params.append("dataSource", "cli");  // Use Google Keyword Planner & Clickstream data
    
    return makeApiCall("get_keyword_data", params);
  },

  // Related Keywords
  get_related_keywords: async (args) => {
    const data = {
      keyword: args.keyword,
      num: args.num || 10
    };
    return makeApiCall("get_related_keywords", data);
  },

  // PASF Keywords
  get_pasf_keywords: async (args) => {
    const data = {
      keyword: args.keyword,
      num: args.num || 10
    };
    return makeApiCall("get_pasf_keywords", data);
  },

  // Domain Keywords
  get_domain_keywords: async (args) => {
    const data = {
      domain: args.domain,
      country: args.country || "",
      num: args.num || 10
    };
    return makeApiCall("get_domain_keywords", data);
  },

  // URL Keywords
  get_url_keywords: async (args) => {
    const data = {
      url: args.url,
      country: args.country || "",
      num: args.num || 10
    };
    return makeApiCall("get_url_keywords", data);
  },

  // Traffic Metrics
  get_domain_traffic: async (args) => {
    const data = {
      domain: args.domain,
      country: args.country || ""
    };
    return makeApiCall("get_domain_traffic", data);
  },

  get_url_traffic: async (args) => {
    const data = {
      url: args.url,
      country: args.country || ""
    };
    return makeApiCall("get_url_traffic", data);
  },

  // Backlinks
  get_domain_backlinks: async (args) => {
    const data = {
      domain: args.domain,
      num: args.num || 10
    };
    return makeApiCall("get_domain_backlinks", data);
  },

  get_unique_domain_backlinks: async (args) => {
    const data = {
      domain: args.domain,
      num: args.num || 10
    };
    return makeApiCall("get_unique_domain_backlinks", data);
  },

  get_page_backlinks: async (args) => {
    const data = {
      url: args.url,
      num: args.num || 10
    };
    return makeApiCall("get_page_backlinks", data);
  },

  get_unique_page_backlinks: async (args) => {
    const data = {
      url: args.url,
      num: args.num || 10
    };
    return makeApiCall("get_unique_page_backlinks", data);
  }
};

// Format response for different types of data
function formatResponse(toolName, data) {
  switch (toolName) {
    case 'get_credits':
      return `Credit Balance: ${data[0]}`;
    
    case 'get_countries':
      if (Array.isArray(data)) {
        return data.map(country => `${country.code}: ${country.name}`).join('\n');
      }
      return JSON.stringify(data, null, 2);
    
    case 'get_currencies':
      if (Array.isArray(data)) {
        return data.map(currency => `${currency.code}: ${currency.name}`).join('\n');
      }
      return JSON.stringify(data, null, 2);
    
    case 'get_keyword_data':
      if (data.data && Array.isArray(data.data)) {
        return data.data.map(item => {
          return `${item.keyword}:
- Search Volume: ${item.vol || 0}
- CPC: ${item.cpc?.currency ? item.cpc.currency : 'RM'}${item.cpc?.value || '0.00'}
- Competition: ${item.competition || 0}
- Trend: ${item.trend && item.trend.length > 0 ? JSON.stringify(item.trend) : '[]'}`;
        }).join("\n\n");
      }
      // Fallback for unexpected response structure
      return JSON.stringify(data, null, 2);
    
    case 'get_related_keywords':
    case 'get_pasf_keywords':
    case 'get_domain_keywords':
    case 'get_url_keywords':
      if (Array.isArray(data)) {
        return data.map((item, index) => {
          return `${index + 1}. ${item.keyword}
   - Search Volume: ${item.vol || 0}
   - CPC: ${item.cpc?.currency ? item.cpc.currency : 'RM'}${item.cpc?.value || '0.00'}
   - Competition: ${item.competition || 0}`;
        }).join("\n\n");
      }
      return JSON.stringify(data, null, 2);
    
    case 'get_domain_traffic':
    case 'get_url_traffic':
      if (data && typeof data === 'object') {
        return `Traffic Metrics:
- Total Keywords: ${data.totalKeywords || 0}
- Total Traffic: ${data.totalTraffic || 0}
- Traffic Cost: RM${data.trafficCost || 0}`;
      }
      return JSON.stringify(data, null, 2);
    
    case 'get_domain_backlinks':
    case 'get_unique_domain_backlinks':
    case 'get_page_backlinks':
    case 'get_unique_page_backlinks':
      if (Array.isArray(data)) {
        return data.map((item, index) => {
          return `${index + 1}. ${item.url}
   - Domain Authority: ${item.da || 0}
   - Page Authority: ${item.pa || 0}
   - Spam Score: ${item.spamScore || 0}`;
        }).join("\n\n");
      }
      return JSON.stringify(data, null, 2);
    
    default:
      return JSON.stringify(data, null, 2);
  }
}

// Helper to convert JSON schema to Zod schema
function jsonSchemaToZod(schema) {
  const properties = {};
  
  if (schema && schema.properties) {
    Object.entries(schema.properties).forEach(([key, prop]) => {
      if (prop.type === "string") {
        properties[key] = z.string().describe(prop.description || "");
      } else if (prop.type === "integer" || prop.type === "number") {
        properties[key] = z.number().describe(prop.description || "");
      } else if (prop.type === "array") {
        properties[key] = z.array(z.string()).describe(prop.description || "");
      } else if (prop.type === "object") {
        properties[key] = z.object({}).describe(prop.description || "");
      } else {
        properties[key] = z.any().describe(prop.description || "");
      }
    });
  }
  
  return properties;
}

// Register each tool with the server
Object.entries(TOOLS).forEach(([name, tool]) => {
  server.tool(
    name,
    jsonSchemaToZod(tool.inputSchema),
    async (args) => {
      try {
        const result = await handlers[name](args);
        const formattedResult = formatResponse(name, result);
        return { 
          content: [{ type: "text", text: formattedResult }], 
          isError: false 
        };
      } catch (error) {
        return { 
          content: [{ type: "text", text: "Error: " + (error instanceof Error ? error.message : String(error)) }], 
          isError: true 
        };
      }
    }
  );
});

async function runServer() {
  // Determine transport type based on environment variable or command line argument
  const transportType = process.env.TRANSPORT_TYPE || 'http';
  
  if (transportType === 'stdio') {
    // Use STDIO transport for backward compatibility
    console.error('Starting with STDIO transport');
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    // Use HTTP transport (default) - manually implemented since SDK doesn't support it yet
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || 'localhost';
    
    console.error(`Starting with HTTP transport on ${host}:${port}`);
    
    // Create Express app for HTTP server
    const app = express();
    const httpServer = http.createServer(app);
    
    // Add CORS and other middleware
    app.use((req, res, next) => {
      // Basic security: validate origin header
      const origin = req.headers.origin;
      if (origin) {
        // You can implement more strict origin validation if needed
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version');
      next();
    });
    
    // Parse JSON bodies
    app.use(express.json());
    
    // Session management
    const sessions = new Map();
    
    // Handle preflight requests
    app.options('/mcp', (req, res) => {
      res.status(200).end();
    });
    
    // Add a health check endpoint
    app.get('/mcp', (req, res) => {
      res.status(200).json({ status: 'ok', message: 'MCP server is running' });
    });
    
    // Implement the MCP endpoint for Streamable HTTP transport
    app.post('/mcp', async (req, res) => {
      // Set a longer timeout for the response
      req.setTimeout(30000);
      res.setTimeout(30000);
      
      try {
        // Check protocol version if provided
        const protocolVersion = req.headers['mcp-protocol-version'];
        if (protocolVersion && protocolVersion !== '2025-03-26') {
          return res.status(400).json({
            error: {
              code: -32600,
              message: `Unsupported protocol version: ${protocolVersion}`
            }
          });
        }
        
        // Get or create session
        let sessionId = req.headers['mcp-session-id'];
        let session;
        
        if (sessionId && sessions.has(sessionId)) {
          session = sessions.get(sessionId);
        } else if (!sessionId && req.body.method === 'initialize') {
          // Create new session for initialization requests
          sessionId = generateSessionId();
          session = { id: sessionId, createdAt: Date.now() };
          sessions.set(sessionId, session);
        } else if (sessionId) {
          // Invalid session ID
          return res.status(404).json({
            error: {
              code: -32000,
              message: 'Session not found'
            }
          });
        } else {
          // Missing session ID for non-initialization request
          return res.status(400).json({
            error: {
              code: -32002,
              message: 'Session ID required'
            }
          });
        }
        
        // Process the MCP request
        const mcpRequest = req.body;
        
        // Handle JSON-RPC batch requests
        if (Array.isArray(mcpRequest)) {
          // For simplicity, we'll process each request sequentially
          const responses = [];
          
          for (const request of mcpRequest) {
            try {
              const response = await processMcpRequest(request, server);
              if (response) {
                responses.push(response);
              }
            } catch (error) {
              responses.push({
                jsonrpc: '2.0',
                id: request.id,
                error: {
                  code: -32603,
                  message: error.message || 'Internal error'
                }
              });
            }
          }
          
          // If this is an initialization request, set the session ID header
          if (mcpRequest.some(req => req.method === 'initialize')) {
            res.setHeader('Mcp-Session-Id', sessionId);
          }
          
          // Return the batch response
          return res.json(responses);
        } else {
          // Handle single request
          try {
            const response = await processMcpRequest(mcpRequest, server);
            
            // If this is an initialization request, set the session ID header
            if (mcpRequest.method === 'initialize') {
              res.setHeader('Mcp-Session-Id', sessionId);
            }
            
            if (response) {
              return res.json(response);
            } else {
              return res.status(202).end();
            }
          } catch (error) {
            return res.status(500).json({
              jsonrpc: '2.0',
              id: mcpRequest.id,
              error: {
                code: -32603,
                message: error.message || 'Internal error'
              }
            });
          }
        }
      } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({
          error: {
            code: -32603,
            message: 'Internal server error'
          }
        });
      }
    });
    
    // Start the HTTP server
    await new Promise((resolve, reject) => {
      httpServer.listen(port, host, () => {
        console.error(`MCP server running at http://${host}:${port}/mcp`);
        resolve();
      });
      
      httpServer.on('error', (error) => {
        console.error('Failed to start HTTP server:', error);
        reject(error);
      });
    });
  }
}

// Helper function to generate a session ID
function generateSessionId() {
  return 'session_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper function to process MCP requests
async function processMcpRequest(request, server) {
  // Only handle requests with IDs (not notifications)
  if (!request.id) {
    return null;
  }
  
  // Forward the request to the MCP server
  // This is a simplified implementation - in a real-world scenario,
  // you would need to properly integrate with the MCP server's request handling
  
  // For now, we'll just handle the request manually
  if (request.method === 'initialize') {
    console.error('Processing initialize request:', request.id);
    
    // Get the tools information
    const toolsList = Object.keys(TOOLS).map(name => ({
      name,
      description: TOOLS[name].description,
      schema: TOOLS[name].schema
    }));
    
    console.error(`Returning ${toolsList.length} tools for initialize request`);
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        name: server.name,
        version: server.version,
        tools: toolsList
      }
    };
  } else if (request.method === 'invoke') {
    const { tool, params } = request.params;
    
    try {
      // Find the handler for this tool
      const handler = handlers[tool];
      if (!handler) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Tool not found: ${tool}`
          }
        };
      }
      
      // Execute the handler
      const result = await handler(params);
      const formattedResult = formatResponse(tool, result);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{ type: 'text', text: formattedResult }],
          isError: false
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        }
      };
    }
  } else {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32601,
        message: `Method not supported: ${request.method}`
      }
    };
  }
}

async function main() {
  try {
    console.error("Starting Keywords Everywhere MCP server...");
    await runServer();
  } catch (error) {
    console.error("Fatal error running server:", error);
    
    // Print more detailed error information
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    
    if (error.cause) {
      console.error("Caused by:", error.cause);
    }
    
    process.exit(1);
  }
}

main();