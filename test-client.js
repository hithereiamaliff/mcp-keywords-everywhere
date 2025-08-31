import axios from 'axios';

// Configuration
const LOCAL_SERVER = 'http://localhost:3000/mcp';
const SMITHERY_SERVER = 'https://mcp-keywords-everywhere.smithery.dev/mcp';

async function testMcpServer() {
  // Determine which server to test based on command line argument
  const serverUrl = process.argv[2] === 'local' ? LOCAL_SERVER : SMITHERY_SERVER;
  console.log(`Testing MCP server at ${serverUrl}`);
  
  try {
    // Step 1: Initialize the server
    console.log('\nSending initialize request...');
    const initResponse = await axios.post(serverUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18'
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log('Initialize Response:', JSON.stringify(initResponse.data, null, 2));
    console.log('Session ID:', initResponse.headers['mcp-session-id']);
    
    // Step 2: Test a tool invocation if initialization was successful
    if (initResponse.data && initResponse.data.result) {
      const sessionId = initResponse.headers['mcp-session-id'];
      
      console.log('\nTesting tool invocation (get_credits)...');
      const toolResponse = await axios.post(serverUrl, {
        jsonrpc: '2.0',
        id: 2,
        method: 'invoke',
        params: {
          tool: 'get_credits',
          params: {}
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': sessionId,
          'MCP-Protocol-Version': '2025-06-18'
        },
        timeout: 30000 // 30 second timeout
      });
      
      console.log('Tool Response:', JSON.stringify(toolResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing MCP server:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received. Request details:', error.request._currentUrl);
    }
  }
}

// Display usage information
if (process.argv.length < 3) {
  console.log('Usage: node test-client.js [local|smithery]');
  console.log('  local    - Test local server at http://localhost:3000/mcp');
  console.log('  smithery - Test deployed server at https://keywords-everywhere.smithery.dev/mcp');
  process.exit(1);
}

testMcpServer();
