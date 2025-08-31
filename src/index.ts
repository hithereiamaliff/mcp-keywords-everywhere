import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios";

// Configuration schema for smithery.yaml
export const configSchema = z.object({
  KEYWORDS_EVERYWHERE_API_KEY: z.string().describe("API key for Keywords Everywhere")
});

// Constants
const BASE_URL = "https://api.keywordseverywhere.com/v1";

export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  const server = new McpServer({
    name: "mcp-keywords-everywhere",
    version: "1.1.0",
  });

  // Helper function for API calls
  async function makeApiCall(endpoint: string, data: any = null, retryCount = 0) {
    try {
      const url = `${BASE_URL}/${endpoint}`;
      console.error(`Calling Keywords Everywhere API: ${endpoint}`);
      
      const config = {
        method: data ? 'post' : 'get',
        url,
        headers: {
          "Authorization": `Bearer ${process.env.KEYWORDS_EVERYWHERE_API_KEY}`,
          "Accept": "application/json"
        }
      } as any;
      
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
    } catch (error: any) {
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
        (customError as any).statusCode = statusCode;
        (customError as any).originalError = error;
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

  // Format response for different types of data
  function formatResponse(toolName: string, data: any) {
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
          return data.data.map((item: any) => {
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
          return data.map((item: any, index: number) => {
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
          return data.map((item: any, index: number) => {
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

  // Register tools
  // Tool: get_credits
  server.registerTool(
    "get_credits",
    {
      title: "Get Credits",
      description: "Get your account's credit balance",
      inputSchema: {}
    },
    async () => {
      try {
        const result = await makeApiCall("account/credits");
        const formattedResult = formatResponse("get_credits", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_countries
  server.registerTool(
    "get_countries",
    {
      title: "Get Countries",
      description: "Get list of supported countries",
      inputSchema: {}
    },
    async () => {
      try {
        const result = await makeApiCall("countries");
        const formattedResult = formatResponse("get_countries", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_currencies
  server.registerTool(
    "get_currencies",
    {
      title: "Get Currencies",
      description: "Get list of supported currencies",
      inputSchema: {}
    },
    async () => {
      try {
        const result = await makeApiCall("currencies");
        const formattedResult = formatResponse("get_currencies", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_keyword_data
  server.registerTool(
    "get_keyword_data",
    {
      title: "Get Keyword Data",
      description: "Get Volume, CPC and competition for a set of keywords",
      inputSchema: {
        keywords: z.array(z.string()).describe("List of keywords to analyze"),
        country: z.string().optional().describe("Country code (empty string for Global, 'us' for United States, etc.)"),
        currency: z.string().optional().describe("Currency code (e.g., 'myr' for Malaysian Ringgit)")
      }
    },
    async (request) => {
      try {
        // Keywords Everywhere API expects "kw[]" format for each keyword
        const params = new URLSearchParams();
        
        // Add each keyword individually to match API expectations
        if (Array.isArray(request.keywords)) {
          request.keywords.forEach(keyword => {
            params.append("kw[]", keyword);
          });
        }
        
        // Add other parameters
        params.append("country", request.country || "");  // Default to global if not specified
        params.append("currency", request.currency || "myr");  // Default to Malaysian Ringgit
        params.append("dataSource", "cli");  // Use Google Keyword Planner & Clickstream data
        
        const result = await makeApiCall("get_keyword_data", params);
        const formattedResult = formatResponse("get_keyword_data", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_related_keywords
  server.registerTool(
    "get_related_keywords",
    {
      title: "Get Related Keywords",
      description: "Get related keywords based on a seed keyword",
      inputSchema: {
        keyword: z.string().describe("Seed keyword to find related terms for"),
        num: z.number().optional().describe("Number of results to return (max 1000)")
      }
    },
    async (request) => {
      try {
        const data = {
          keyword: request.keyword,
          num: request.num || 10
        };
        const result = await makeApiCall("get_related_keywords", data);
        const formattedResult = formatResponse("get_related_keywords", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_pasf_keywords
  server.registerTool(
    "get_pasf_keywords",
    {
      title: "Get PASF Keywords",
      description: "Get 'People Also Search For' keywords based on a seed keyword",
      inputSchema: {
        keyword: z.string().describe("Seed keyword to find PASF terms for"),
        num: z.number().optional().describe("Number of results to return (max 1000)")
      }
    },
    async (request) => {
      try {
        const data = {
          keyword: request.keyword,
          num: request.num || 10
        };
        const result = await makeApiCall("get_pasf_keywords", data);
        const formattedResult = formatResponse("get_pasf_keywords", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_domain_keywords
  server.registerTool(
    "get_domain_keywords",
    {
      title: "Get Domain Keywords",
      description: "Get keywords that a domain ranks for",
      inputSchema: {
        domain: z.string().describe("Domain to analyze (e.g., example.com)"),
        country: z.string().optional().describe("Country code (empty string for Global, 'us' for United States, etc.)"),
        num: z.number().optional().describe("Number of results to return (max 1000)")
      }
    },
    async (request) => {
      try {
        const data = {
          domain: request.domain,
          country: request.country || "",
          num: request.num || 10
        };
        const result = await makeApiCall("get_domain_keywords", data);
        const formattedResult = formatResponse("get_domain_keywords", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_url_keywords
  server.registerTool(
    "get_url_keywords",
    {
      title: "Get URL Keywords",
      description: "Get keywords that a URL ranks for",
      inputSchema: {
        url: z.string().describe("URL to analyze"),
        country: z.string().optional().describe("Country code (empty string for Global, 'us' for United States, etc.)"),
        num: z.number().optional().describe("Number of results to return (max 1000)")
      }
    },
    async (request) => {
      try {
        const data = {
          url: request.url,
          country: request.country || "",
          num: request.num || 10
        };
        const result = await makeApiCall("get_url_keywords", data);
        const formattedResult = formatResponse("get_url_keywords", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_domain_traffic
  server.registerTool(
    "get_domain_traffic",
    {
      title: "Get Domain Traffic",
      description: "Get traffic metrics for a domain",
      inputSchema: {
        domain: z.string().describe("Domain to analyze (e.g., example.com)"),
        country: z.string().optional().describe("Country code (empty string for Global, 'us' for United States, etc.)")
      }
    },
    async (request) => {
      try {
        const data = {
          domain: request.domain,
          country: request.country || ""
        };
        const result = await makeApiCall("get_domain_traffic", data);
        const formattedResult = formatResponse("get_domain_traffic", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_url_traffic
  server.registerTool(
    "get_url_traffic",
    {
      title: "Get URL Traffic",
      description: "Get traffic metrics for a URL",
      inputSchema: {
        url: z.string().describe("URL to analyze"),
        country: z.string().optional().describe("Country code (empty string for Global, 'us' for United States, etc.)")
      }
    },
    async (request) => {
      try {
        const data = {
          url: request.url,
          country: request.country || ""
        };
        const result = await makeApiCall("get_url_traffic", data);
        const formattedResult = formatResponse("get_url_traffic", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_domain_backlinks
  server.registerTool(
    "get_domain_backlinks",
    {
      title: "Get Domain Backlinks",
      description: "Get backlinks for a domain",
      inputSchema: {
        domain: z.string().describe("Domain to analyze (e.g., example.com)"),
        num: z.number().optional().describe("Number of results to return (max 1000)")
      }
    },
    async (request) => {
      try {
        const data = {
          domain: request.domain,
          num: request.num || 10
        };
        const result = await makeApiCall("get_domain_backlinks", data);
        const formattedResult = formatResponse("get_domain_backlinks", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_unique_domain_backlinks
  server.registerTool(
    "get_unique_domain_backlinks",
    {
      title: "Get Unique Domain Backlinks",
      description: "Get unique domain backlinks",
      inputSchema: {
        domain: z.string().describe("Domain to analyze (e.g., example.com)"),
        num: z.number().optional().describe("Number of results to return (max 1000)")
      }
    },
    async (request) => {
      try {
        const data = {
          domain: request.domain,
          num: request.num || 10
        };
        const result = await makeApiCall("get_unique_domain_backlinks", data);
        const formattedResult = formatResponse("get_unique_domain_backlinks", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_page_backlinks
  server.registerTool(
    "get_page_backlinks",
    {
      title: "Get Page Backlinks",
      description: "Get backlinks for a specific URL",
      inputSchema: {
        url: z.string().describe("URL to analyze"),
        num: z.number().optional().describe("Number of results to return (max 1000)")
      }
    },
    async (request) => {
      try {
        const data = {
          url: request.url,
          num: request.num || 10
        };
        const result = await makeApiCall("get_page_backlinks", data);
        const formattedResult = formatResponse("get_page_backlinks", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  // Tool: get_unique_page_backlinks
  server.registerTool(
    "get_unique_page_backlinks",
    {
      title: "Get Unique Page Backlinks",
      description: "Get unique backlinks for a specific URL",
      inputSchema: {
        url: z.string().describe("URL to analyze"),
        num: z.number().optional().describe("Number of results to return (max 1000)")
      }
    },
    async (request) => {
      try {
        const data = {
          url: request.url,
          num: request.num || 10
        };
        const result = await makeApiCall("get_unique_page_backlinks", data);
        const formattedResult = formatResponse("get_unique_page_backlinks", result);
        return {
          content: [{
            type: "text" as const,
            text: formattedResult
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: " + (error instanceof Error ? error.message : String(error))
          }],
          isError: true
        };
      }
    }
  );

  return server.server;
}
