declare class WebSocketPair {
    0: WebSocket;
    1: WebSocket;
  }
  
  interface ResponseInit {
    status?: number;
    headers?: HeadersInit;
    webSocket?: WebSocket; // Add this to fix the webSocket property error
  }
  