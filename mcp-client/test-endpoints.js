// Test script to verify NVIDIA endpoint and WebSocket server
import axios from "axios";
import dotenv from "dotenv";
import WebSocket from "ws";
import { interpretMessage } from "./model/router.js";

dotenv.config();

const WS_SERVER_URL = "ws://localhost:8080";
const HTTP_SERVER_URL = "http://localhost:8080";

// Test 1: Test NVIDIA API directly through router
async function testRouter() {
  console.log("\n🧪 Test 1: Testing NVIDIA API through router function");
  console.log("=" .repeat(60));
  
  try {
    const testMessage = "Get logs with status active";
    console.log(`\n📤 Sending message: "${testMessage}"`);
    
    const result = await interpretMessage(testMessage);
    console.log("\n✅ Router response:", JSON.stringify(result, null, 2));
    
    if (result.tool && result.args) {
      console.log("\n✅ Router test PASSED - Successfully routed message");
      return true;
    } else {
      console.log("\n❌ Router test FAILED - Invalid response format");
      return false;
    }
  } catch (error) {
    console.error("\n❌ Router test FAILED:", error.message);
    console.error("Error details:", error);
    return false;
  }
}

// Test 2: Test HTTP server
async function testHTTPServer() {
  console.log("\n🧪 Test 2: Testing HTTP server");
  console.log("=" .repeat(60));
  
  try {
    const response = await axios.get(HTTP_SERVER_URL, {
      timeout: 5000
    });
    
    console.log(`\n✅ HTTP Server Response (${response.status}):`, response.data);
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error("\n❌ HTTP Server test FAILED - Server is not running");
      console.error("Please start the server with: node server.js");
    } else {
      console.error("\n❌ HTTP Server test FAILED:", error.message);
    }
    return false;
  }
}

// Test 3: Test WebSocket server
function testWebSocketServer() {
  return new Promise((resolve) => {
    console.log("\n🧪 Test 3: Testing WebSocket server");
    console.log("=" .repeat(60));
    
    const ws = new WebSocket(WS_SERVER_URL);
    let messageReceived = false;
    let testPassed = false;
    
    ws.on("open", () => {
      console.log("\n✅ WebSocket connection established");
      
      const testMessage = {
        message: "Hello, echo this message back"
      };
      
      console.log(`\n📤 Sending message:`, testMessage);
      ws.send(JSON.stringify(testMessage));
      
      // Set timeout for response
      setTimeout(() => {
        if (!messageReceived) {
          console.error("\n❌ WebSocket test FAILED - No response received within 5 seconds");
          ws.close();
          resolve(false);
        }
      }, 5000);
    });
    
    ws.on("message", (data) => {
      messageReceived = true;
      try {
        const response = JSON.parse(data.toString());
        console.log("\n✅ WebSocket Response:", JSON.stringify(response, null, 2));
        
        if (response.reply || response.error) {
          console.log("\n✅ WebSocket test PASSED - Received valid response");
          testPassed = true;
        } else {
          console.log("\n❌ WebSocket test FAILED - Invalid response format");
          testPassed = false;
        }
      } catch (error) {
        console.error("\n❌ WebSocket test FAILED - Failed to parse response:", error.message);
        testPassed = false;
      }
      
      ws.close();
      resolve(testPassed);
    });
    
    ws.on("error", (error) => {
      console.error("\n❌ WebSocket test FAILED - Connection error:", error.message);
      if (error.code === 'ECONNREFUSED') {
        console.error("Please start the server with: node server.js");
      }
      resolve(false);
    });
    
    ws.on("close", () => {
      if (!messageReceived) {
        console.log("\n⚠️ WebSocket connection closed before receiving response");
      }
    });
  });
}

// Test 4: Test multiple WebSocket messages
function testMultipleWebSocketMessages() {
  return new Promise((resolve) => {
    console.log("\n🧪 Test 4: Testing multiple WebSocket messages");
    console.log("=" .repeat(60));
    
    const ws = new WebSocket(WS_SERVER_URL);
    const messages = [
      "Get logs with status error",
      "Get resource with id 123",
      "Echo this test message"
    ];
    let messageIndex = 0;
    let responsesReceived = 0;
    const expectedResponses = messages.length;
    
    ws.on("open", () => {
      console.log("\n✅ WebSocket connection established");
      console.log(`\n📤 Sending ${messages.length} messages...`);
      
      // Send all messages
      messages.forEach((msg, index) => {
        setTimeout(() => {
          console.log(`\n📤 [${index + 1}/${messages.length}] Sending: "${msg}"`);
          ws.send(JSON.stringify({ message: msg }));
        }, index * 1000); // Stagger messages by 1 second
      });
      
      // Set timeout
      setTimeout(() => {
        if (responsesReceived < expectedResponses) {
          console.error(`\n❌ Multiple messages test FAILED - Only received ${responsesReceived}/${expectedResponses} responses`);
          ws.close();
          resolve(false);
        }
      }, 10000);
    });
    
    ws.on("message", (data) => {
      responsesReceived++;
      try {
        const response = JSON.parse(data.toString());
        console.log(`\n✅ [${responsesReceived}/${expectedResponses}] Response:`, JSON.stringify(response, null, 2));
        
        if (responsesReceived === expectedResponses) {
          console.log("\n✅ Multiple messages test PASSED - All responses received");
          ws.close();
          resolve(true);
        }
      } catch (error) {
        console.error("\n❌ Failed to parse response:", error.message);
      }
    });
    
    ws.on("error", (error) => {
      console.error("\n❌ Multiple messages test FAILED:", error.message);
      resolve(false);
    });
  });
}

// Run all tests
async function runAllTests() {
  console.log("\n🚀 Starting Endpoint Tests");
  console.log("=" .repeat(60));
  
  const results = {
    router: false,
    httpServer: false,
    webSocket: false,
    multipleMessages: false
  };
  
  // Test 1: Router (doesn't require server)
  results.router = await testRouter();
  
  // Test 2: HTTP Server
  results.httpServer = await testHTTPServer();
  
  // Test 3: WebSocket (requires server)
  if (results.httpServer) {
    results.webSocket = await testWebSocketServer();
    
    // Test 4: Multiple messages (requires server)
    if (results.webSocket) {
      results.multipleMessages = await testMultipleWebSocketMessages();
    }
  } else {
    console.log("\n⚠️ Skipping WebSocket tests - HTTP server is not running");
  }
  
  // Summary
  console.log("\n" + "=" .repeat(60));
  console.log("📊 Test Summary");
  console.log("=" .repeat(60));
  console.log(`Router Test:           ${results.router ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`HTTP Server Test:      ${results.httpServer ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`WebSocket Test:        ${results.webSocket ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`Multiple Messages:     ${results.multipleMessages ? "✅ PASSED" : "❌ FAILED"}`);
  console.log("=" .repeat(60));
  
  const allPassed = Object.values(results).every(r => r === true || r === false && !results.httpServer);
  console.log(`\n${allPassed ? "✅" : "⚠️"} Overall: ${allPassed ? "All tests passed!" : "Some tests failed or were skipped"}`);
  
  process.exit(allPassed && results.httpServer ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  console.error("\n❌ Fatal error running tests:", error);
  process.exit(1);
});

