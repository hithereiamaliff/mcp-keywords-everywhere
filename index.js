#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import axios from "axios";
import { z } from "zod";
import dotenv from "dotenv";
import http from "http";
import fs from "fs";
import path from "path";

// Load environment variables from .env file
dotenv.config();

const BASE_URL = "https://api.keywordseverywhere.com/v1";
const DEFAULT_API_KEY = process.env.KEYWORDS_EVERYWHERE_API_KEY;

// Store per-request API key (set from URL query param or header)
let requestApiKey = null;

function getApiKey() {
  // User-provided key takes priority, fallback to default
  return requestApiKey || DEFAULT_API_KEY;
}

if (!DEFAULT_API_KEY) {
  console.warn("Warning: KEYWORDS_EVERYWHERE_API_KEY not set. Users must provide their own API key via URL query param.");
}

// ============================================================================
// Analytics Tracking with File Persistence
// ============================================================================
const ANALYTICS_FILE = process.env.ANALYTICS_FILE || '/app/data/keywords-everywhere-analytics.json';

const defaultAnalytics = {
  serverStartTime: new Date().toISOString(),
  totalRequests: 0,
  totalToolCalls: 0,
  requestsByMethod: {},
  requestsByEndpoint: {},
  toolCalls: {},
  recentToolCalls: [],
  clientsByIp: {},
  clientsByUserAgent: {},
  clientsByApp: {},
  hourlyRequests: {},
};

const MAX_RECENT_CALLS = 100;

// Load analytics from file or use defaults
function loadAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = fs.readFileSync(ANALYTICS_FILE, 'utf-8');
      const loaded = JSON.parse(data);
      console.error(`📊 Loaded analytics from ${ANALYTICS_FILE}`);
      // Ensure clientsByApp exists (for backwards compatibility)
      if (!loaded.clientsByApp) {
        loaded.clientsByApp = {};
      }
      return loaded;
    }
  } catch (error) {
    console.warn('⚠️ Could not load analytics file, starting fresh:', error.message);
  }
  return { ...defaultAnalytics };
}

// Save analytics to file
function saveAnalytics() {
  try {
    const dir = path.dirname(ANALYTICS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
    console.error(`📊 Saved analytics to ${ANALYTICS_FILE}`);
  } catch (error) {
    console.warn('⚠️ Could not save analytics file:', error.message);
  }
}

// Auto-save analytics every 5 minutes
setInterval(saveAnalytics, 5 * 60 * 1000);

// Save on process exit
process.on('SIGTERM', () => {
  console.error('📊 Saving analytics before shutdown...');
  saveAnalytics();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('📊 Saving analytics before shutdown...');
  saveAnalytics();
  process.exit(0);
});

const analytics = loadAnalytics();

// Parse app name from user agent
function parseAppFromUserAgent(userAgent) {
  if (!userAgent || userAgent === 'unknown') return 'Unknown';
  
  const ua = userAgent.toLowerCase();
  
  // Claude Desktop
  if (ua.includes('claude') || ua.includes('anthropic')) return 'Claude Desktop';
  // Cursor
  if (ua.includes('cursor')) return 'Cursor';
  // Windsurf
  if (ua.includes('windsurf') || ua.includes('codeium')) return 'Windsurf';
  // VS Code
  if (ua.includes('vscode') || ua.includes('visual studio code')) return 'VS Code';
  // Continue
  if (ua.includes('continue')) return 'Continue';
  // MCP Inspector
  if (ua.includes('mcp-inspector') || ua.includes('inspector')) return 'MCP Inspector';
  // Node.js (likely programmatic)
  if (ua.includes('node')) return 'Node.js';
  // Python
  if (ua.includes('python')) return 'Python';
  // curl
  if (ua.includes('curl')) return 'curl';
  // Postman
  if (ua.includes('postman')) return 'Postman';
  // Browser-based
  if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox')) return 'Browser';
  
  // Extract first part of user agent as app name
  const firstPart = userAgent.split('/')[0] || userAgent.split(' ')[0];
  return firstPart.substring(0, 20) || 'Unknown';
}

function trackRequest(req, endpoint) {
  analytics.totalRequests++;
  
  // Track by method
  const method = req.method;
  analytics.requestsByMethod[method] = (analytics.requestsByMethod[method] || 0) + 1;
  
  // Track by endpoint
  analytics.requestsByEndpoint[endpoint] = (analytics.requestsByEndpoint[endpoint] || 0) + 1;
  
  // Track by client IP
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  analytics.clientsByIp[clientIp] = (analytics.clientsByIp[clientIp] || 0) + 1;
  
  // Track by user agent
  const userAgent = req.headers['user-agent'] || 'unknown';
  const shortAgent = userAgent.substring(0, 50);
  analytics.clientsByUserAgent[shortAgent] = (analytics.clientsByUserAgent[shortAgent] || 0) + 1;
  
  // Track by app (parsed from user agent)
  const appName = parseAppFromUserAgent(userAgent);
  analytics.clientsByApp[appName] = (analytics.clientsByApp[appName] || 0) + 1;
  
  // Track hourly
  const hour = new Date().toISOString().substring(0, 13); // YYYY-MM-DDTHH
  analytics.hourlyRequests[hour] = (analytics.hourlyRequests[hour] || 0) + 1;
}

function trackToolCall(toolName, req) {
  analytics.totalToolCalls++;
  analytics.toolCalls[toolName] = (analytics.toolCalls[toolName] || 0) + 1;
  
  const toolCall = {
    tool: toolName,
    timestamp: new Date().toISOString(),
    clientIp: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: (req.headers['user-agent'] || 'unknown').substring(0, 50),
  };
  
  analytics.recentToolCalls.unshift(toolCall);
  if (analytics.recentToolCalls.length > MAX_RECENT_CALLS) {
    analytics.recentToolCalls.pop();
  }
}

function getUptime() {
  const start = new Date(analytics.serverStartTime).getTime();
  const now = Date.now();
  const diff = now - start;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No API key available. Please provide your Keywords Everywhere API key via URL query param (?apiKey=YOUR_KEY) or contact the server administrator.');
  }
  
  try {
    const url = `${BASE_URL}/${endpoint}`;
    console.error(`Calling Keywords Everywhere API: ${endpoint}`);
    
    const config = {
      method: data ? 'post' : 'get',
      url,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
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
      // Allow all origins for testing purposes
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
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
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      trackRequest(req, '/health');
      res.status(200).json({ 
        status: 'healthy',
        server: 'Keywords Everywhere MCP',
        version: '1.2.0',
        transport: 'streamable-http',
        uptime: getUptime(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Analytics endpoint - summary
    app.get('/analytics', (req, res) => {
      trackRequest(req, '/analytics');
      
      // Sort tool calls by count
      const sortedTools = Object.entries(analytics.toolCalls)
        .sort(([, a], [, b]) => b - a)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
      
      // Sort clients by count
      const sortedClients = Object.entries(analytics.clientsByIp)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
      
      // Get last 24 hours of hourly data
      const last24Hours = Object.entries(analytics.hourlyRequests)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 24)
        .reverse()
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
      
      res.json({
        server: 'Keywords Everywhere MCP',
        uptime: getUptime(),
        serverStartTime: analytics.serverStartTime,
        summary: {
          totalRequests: analytics.totalRequests,
          totalToolCalls: analytics.totalToolCalls,
          uniqueClients: Object.keys(analytics.clientsByIp).length,
        },
        breakdown: {
          byMethod: analytics.requestsByMethod,
          byEndpoint: analytics.requestsByEndpoint,
          byTool: sortedTools,
        },
        clients: {
          byIp: sortedClients,
          byUserAgent: analytics.clientsByUserAgent,
          byApp: analytics.clientsByApp || {},
        },
        hourlyRequests: last24Hours,
        recentToolCalls: analytics.recentToolCalls.slice(0, 20),
      });
    });
    
    // Analytics endpoint - detailed tool stats
    app.get('/analytics/tools', (req, res) => {
      trackRequest(req, '/analytics/tools');
      
      const sortedTools = Object.entries(analytics.toolCalls)
        .sort(([, a], [, b]) => b - a)
        .map(([tool, count]) => ({
          tool,
          count,
          percentage: analytics.totalToolCalls > 0 
            ? ((count / analytics.totalToolCalls) * 100).toFixed(1) + '%'
            : '0%',
        }));
      
      res.json({
        totalToolCalls: analytics.totalToolCalls,
        tools: sortedTools,
        recentCalls: analytics.recentToolCalls,
      });
    });
    
    // Analytics dashboard - visual HTML page
    app.get('/analytics/dashboard', (req, res) => {
      trackRequest(req, '/analytics/dashboard');
      
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Keywords Everywhere MCP - Analytics Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e4e4e7;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      backdrop-filter: blur(10px);
    }
    header h1 {
      font-size: 2rem;
      background: linear-gradient(90deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    header p { color: #a1a1aa; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
      transition: transform 0.2s;
    }
    .stat-card:hover { transform: translateY(-4px); }
    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(90deg, #34d399, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-label { color: #a1a1aa; margin-top: 8px; font-size: 0.9rem; }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .chart-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .chart-card h3 {
      margin-bottom: 16px;
      color: #e4e4e7;
      font-size: 1.1rem;
    }
    .chart-container { position: relative; height: 300px; }
    .recent-calls {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .recent-calls h3 { margin-bottom: 16px; }
    .call-list { max-height: 400px; overflow-y: auto; }
    .call-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .call-tool {
      font-weight: 600;
      color: #60a5fa;
      font-family: monospace;
    }
    .call-time { color: #71717a; font-size: 0.85rem; }
    .call-client { color: #a1a1aa; font-size: 0.8rem; }
    .ip-list { max-height: 300px; overflow-y: auto; }
    .ip-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: rgba(255,255,255,0.03);
      border-radius: 6px;
      margin-bottom: 6px;
    }
    .ip-addr { font-family: monospace; color: #60a5fa; }
    .ip-count { color: #71717a; font-size: 0.85rem; }
    .refresh-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 50px;
      cursor: pointer;
      font-weight: 600;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
      transition: transform 0.2s;
    }
    .refresh-btn:hover { transform: scale(1.05); }
    .uptime-badge {
      display: inline-block;
      background: rgba(52, 211, 153, 0.2);
      color: #34d399;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      margin-top: 8px;
    }
    @media (max-width: 768px) {
      .charts-grid { grid-template-columns: 1fr; }
      .stat-value { font-size: 2rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔍 Keywords Everywhere MCP Analytics</h1>
      <p>Real-time usage statistics for the MCP server</p>
      <span class="uptime-badge" id="uptime">Loading...</span>
    </header>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value" id="totalRequests">-</div>
        <div class="stat-label">Total Requests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="totalToolCalls">-</div>
        <div class="stat-label">Tool Calls</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="uniqueClients">-</div>
        <div class="stat-label">Unique Clients</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="topTool">-</div>
        <div class="stat-label">Most Used Tool</div>
      </div>
    </div>
    
    <div class="charts-grid">
      <div class="chart-card">
        <h3>📊 Tool Usage Distribution</h3>
        <div class="chart-container">
          <canvas id="toolsChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h3>📈 Hourly Requests (Last 24h)</h3>
        <div class="chart-container">
          <canvas id="hourlyChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h3>📱 Clients by App</h3>
        <div class="chart-container">
          <canvas id="appsChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h3>🌐 Top Client IPs</h3>
        <div class="ip-list" id="topIps">Loading...</div>
      </div>
    </div>
    
    <div class="recent-calls">
      <h3>🕐 Recent Tool Calls</h3>
      <div class="call-list" id="recentCalls">Loading...</div>
    </div>
  </div>
  
  <button class="refresh-btn" onclick="loadData()">🔄 Refresh</button>
  
  <script>
    let toolsChart, hourlyChart, appsChart;
    
    async function loadData() {
      try {
        // Use relative path to work with nginx proxy
        const basePath = window.location.pathname.replace('/analytics/dashboard', '');
        const res = await fetch(basePath + '/analytics');
        const data = await res.json();
        
        document.getElementById('uptime').textContent = '⏱️ Uptime: ' + data.uptime;
        document.getElementById('totalRequests').textContent = data.summary.totalRequests.toLocaleString();
        document.getElementById('totalToolCalls').textContent = data.summary.totalToolCalls.toLocaleString();
        document.getElementById('uniqueClients').textContent = data.summary.uniqueClients.toLocaleString();
        
        const tools = Object.entries(data.breakdown.byTool);
        if (tools.length > 0) {
          document.getElementById('topTool').textContent = tools[0][0].replace('get_', '');
        }
        
        // Tools chart
        const toolLabels = tools.slice(0, 8).map(([k]) => k.replace('get_', ''));
        const toolValues = tools.slice(0, 8).map(([, v]) => v);
        
        if (toolsChart) toolsChart.destroy();
        toolsChart = new Chart(document.getElementById('toolsChart'), {
          type: 'doughnut',
          data: {
            labels: toolLabels,
            datasets: [{
              data: toolValues,
              backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#84cc16']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#a1a1aa' } } }
          }
        });
        
        // Hourly chart
        const hourlyData = Object.entries(data.hourlyRequests);
        const hourLabels = hourlyData.map(([k]) => k.substring(11) + ':00');
        const hourValues = hourlyData.map(([, v]) => v);
        
        if (hourlyChart) hourlyChart.destroy();
        hourlyChart = new Chart(document.getElementById('hourlyChart'), {
          type: 'line',
          data: {
            labels: hourLabels,
            datasets: [{
              label: 'Requests',
              data: hourValues,
              borderColor: '#60a5fa',
              backgroundColor: 'rgba(96, 165, 250, 0.1)',
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
              y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            plugins: { legend: { display: false } }
          }
        });
        
        // Apps chart
        const apps = Object.entries(data.clients.byApp || {}).sort(([,a], [,b]) => b - a);
        const appLabels = apps.slice(0, 8).map(([k]) => k);
        const appValues = apps.slice(0, 8).map(([, v]) => v);
        
        if (appsChart) appsChart.destroy();
        appsChart = new Chart(document.getElementById('appsChart'), {
          type: 'bar',
          data: {
            labels: appLabels,
            datasets: [{
              data: appValues,
              backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#f43f5e', '#84cc16']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
              y: { ticks: { color: '#a1a1aa' }, grid: { display: false } }
            }
          }
        });
        
        // Top IPs list
        const ips = Object.entries(data.clients.byIp || {}).slice(0, 10);
        const ipsHtml = ips.map(([ip, count]) => \`
          <div class="ip-item">
            <span class="ip-addr">\${ip}</span>
            <span class="ip-count">\${count} requests</span>
          </div>
        \`).join('');
        document.getElementById('topIps').innerHTML = ipsHtml || '<p style="color:#71717a">No clients yet</p>';
        
        // Recent calls
        const callsHtml = data.recentToolCalls.map(call => \`
          <div class="call-item">
            <div>
              <span class="call-tool">\${call.tool}</span>
              <span class="call-client">\${call.userAgent}</span>
            </div>
            <span class="call-time">\${new Date(call.timestamp).toLocaleTimeString()}</span>
          </div>
        \`).join('');
        document.getElementById('recentCalls').innerHTML = callsHtml || '<p style="color:#71717a">No tool calls yet</p>';
        
      } catch (err) {
        console.error('Failed to load analytics:', err);
      }
    }
    
    loadData();
    setInterval(loadData, 30000);
  </script>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });
    
    // Add a health check endpoint (also on /mcp GET for compatibility)
    app.get('/mcp', (req, res) => {
      trackRequest(req, '/mcp');
      res.status(200).json({ status: 'ok', message: 'MCP server is running' });
    });
    
    // Handle DELETE requests for session termination
    app.delete('/mcp', (req, res) => {
      trackRequest(req, '/mcp');
      
      const sessionId = req.headers['mcp-session-id'];
      
      if (!sessionId) {
        return res.status(400).json({
          error: {
            code: -32002,
            message: 'Session ID required'
          }
        });
      }
      
      if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        console.error(`Session terminated: ${sessionId}`);
        return res.status(200).json({
          status: 'ok',
          message: 'Session terminated successfully'
        });
      } else {
        return res.status(404).json({
          error: {
            code: -32000,
            message: 'Session not found'
          }
        });
      }
    });
    
    // Implement the MCP endpoint for Streamable HTTP transport
    app.post('/mcp', async (req, res) => {
      // Track request for analytics
      trackRequest(req, '/mcp');
      
      // Set a longer timeout for the response
      req.setTimeout(30000);
      res.setTimeout(30000);
      
      // Extract API key from query param or header (user's key takes priority over default)
      const userApiKey = req.query.apiKey || req.headers['x-api-key'];
      if (userApiKey) {
        requestApiKey = userApiKey;
        console.error('Using user-provided API key');
      } else {
        requestApiKey = null; // Reset to use default
      }
      
      // Log the incoming request
      console.error('Received MCP request:', {
        headers: req.headers,
        body: req.body,
        method: req.method,
        path: req.path,
        hasUserApiKey: !!userApiKey
      });
      
      try {
        // Check protocol version if provided
        const protocolVersion = req.headers['mcp-protocol-version'];
        // Accept any protocol version that starts with 2025- for compatibility
        if (protocolVersion && !protocolVersion.startsWith('2025-')) {
          console.error(`Unsupported protocol version: ${protocolVersion}`);
          return res.status(400).json({
            jsonrpc: '2.0',
            id: req.body.id,
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
              const response = await processMcpRequest(request, server, req);
              console.error('Sending MCP response:', {
                sessionId,
                response: JSON.stringify(response, null, 2)
              });
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
            const response = await processMcpRequest(mcpRequest, server, req);
            
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
async function processMcpRequest(request, server, expressReq = null) {
  // Only handle requests with IDs (not notifications)
  // Note: id can be 0, so we check for undefined/null specifically
  if (request.id === undefined || request.id === null) {
    return null;
  }
  
  // Forward the request to the MCP server
  // This is a simplified implementation - in a real-world scenario,
  // you would need to properly integrate with the MCP server's request handling
  
  // For now, we'll just handle the request manually
  if (request.method === 'initialize') {
    console.error('Processing initialize request:', request.id);
    
    // Get the tools information in the exact format expected by Smithery
    const toolsList = Object.keys(TOOLS).map(name => {
      const tool = TOOLS[name];
      return {
        name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema?.properties || {},
          required: tool.inputSchema?.required || []
        }
      };
    });
    
    console.error(`Returning ${toolsList.length} tools for initialize request`);
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'mcp-keywords-everywhere',
          version: '1.1.0'
        }
      }
    };
  } else if (request.method === 'tools/list') {
    console.error('Processing tools/list request:', request.id);
    
    const toolsList = Object.keys(TOOLS).map(name => {
      const tool = TOOLS[name];
      return {
        name,
        description: tool.description,
        inputSchema: {
          type: "object",
          properties: tool.inputSchema?.properties || {},
          required: tool.inputSchema?.required || []
        }
      };
    });
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: toolsList
      }
    };
  } else if (request.method === 'tools/call') {
    const { name: toolName, arguments: toolArgs } = request.params;
    
    // Track tool call for analytics
    if (expressReq) {
      trackToolCall(toolName, expressReq);
    }
    
    try {
      console.error(`Processing tools/call for: ${toolName}`, toolArgs);
      
      const toolDef = TOOLS[toolName];
      if (!toolDef) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Tool not found: ${toolName}`
          }
        };
      }
      
      const handler = handlers[toolName];
      if (!handler) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Handler not found for tool: ${toolName}`
          }
        };
      }
      
      const result = await handler(toolArgs || {});
      const formattedResult = formatResponse(toolName, result);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{ type: "text", text: formattedResult }]
        }
      };
    } catch (error) {
      console.error(`Error in tools/call ${toolName}:`, error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        }
      };
    }
  } else if (request.method === 'invoke') {
    const { tool, params } = request.params;
    
    try {
      console.error(`Processing invoke request for tool: ${tool}`, params);
      
      // Find the tool in our TOOLS object
      const toolDef = TOOLS[tool];
      if (!toolDef) {
        console.error(`Tool not found: ${tool}`);
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Tool not found: ${tool}`
          }
        };
      }
      
      // Call the handler with the params
      const handler = handlers[tool];
      if (!handler) {
        console.error(`Handler not found for tool: ${tool}`);
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Handler not found for tool: ${tool}`
          }
        };
      }
      
      // Execute the tool handler
      const result = await handler(params);
      const formattedResult = formatResponse(tool, result);
      
      console.error(`Tool ${tool} executed successfully`);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [{ type: "text", text: formattedResult }],
          isError: false
        }
      };
    } catch (error) {
      console.error(`Error invoking tool ${tool}:`, error);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error)
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