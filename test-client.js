import axios from 'axios';

async function testMcpServer() {
  try {
    console.log('Testing MCP server with initialize request...');
    
    const response = await axios.post('http://localhost:3000/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('Session ID:', response.headers['mcp-session-id']);
    
    // Test a tool invocation if initialization was successful
    if (response.data && response.data.result) {
      const sessionId = response.headers['mcp-session-id'];
      
      console.log('\nTesting tool invocation...');
      const toolResponse = await axios.post('http://localhost:3000/mcp', {
        jsonrpc: '2.0',
        id: 2,
        method: 'invoke',
        params: {
          tool: 'get_credit_balance',
          params: {}
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': sessionId
        }
      });
      
      console.log('Tool Response:', JSON.stringify(toolResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing MCP server:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testMcpServer();
