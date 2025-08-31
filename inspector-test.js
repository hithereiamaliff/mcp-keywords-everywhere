import axios from 'axios';

async function testWithInspector() {
  try {
    console.log('Testing MCP server with Inspector...');
    
    // Step 1: Initialize the server
    console.log('\nSending initialize request...');
    const initResponse = await axios.post('http://localhost:3000/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18'
      }
    });
    
    console.log('Initialize Response:', JSON.stringify(initResponse.data, null, 2));
    console.log('Session ID:', initResponse.headers['mcp-session-id']);
    
    // Step 2: List available tools
    if (initResponse.data && initResponse.data.result && initResponse.data.result.tools) {
      console.log('\nAvailable tools:');
      initResponse.data.result.tools.forEach(tool => {
        console.log(`- ${tool.name}: ${tool.description}`);
      });
    }
    
    // Step 3: Test a tool invocation if initialization was successful
    if (initResponse.data && initResponse.data.result) {
      const sessionId = initResponse.headers['mcp-session-id'];
      
      console.log('\nTesting tool invocation (get_credits)...');
      const toolResponse = await axios.post('http://localhost:3000/mcp', {
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
        }
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

testWithInspector();
