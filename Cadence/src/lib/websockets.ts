import { Session } from "@/models/Session";

// WebSocket message types
type WSMessage =
  | { type: 'auth'; data: { token: string } }
  | { type: 'ping' }
  | { type: 'cadence:sync'; data: unknown }
  | { type: 'cadence:session:start'; data: { project?: string; focusDuration?: number; shortBreakDuration?: number; longBreakDuration?: number } }
  | { type: 'cadence:session:pause' }
  | { type: 'cadence:session:resume' }
  | { type: 'cadence:session:stop' }
  | { type: 'cadence:session:skip' }
  | { type: 'cadence:session:complete' }
  | { type: 'cadence:session:request' }
  | { type: 'cadence:session:update-project'; data: { project: string } }
  | { type: 'cadence:session:transition-to-break'; data: { breakType: 'short' | 'long'; autoStart: boolean } };

// WebSocket response types
type WSResponse =
  | { type: 'auth:success'; userId: string; connections: number; session: any }
  | { type: 'auth:error'; message: string }
  | { type: 'pong'; timestamp: number }
  | { type: 'cadence:session:update'; data: any }
  | { type: 'cadence:session:response'; data: any }
  | { type: 'cadence:session:ack'; success: boolean; data: any }
  | { type: 'cadence:session:error'; message: string }
  | { type: 'cadence:session:completed'; data: { timerState: string; totalTime: number; timeStarted: string; timeEnded: string; project: string } }
  | { type: 'error'; message: string };

// Event listeners
type EventListener<T = any> = (data: T) => void;

// Default WebSocket URL
const DEFAULT_WS_URL = 'wss://api.groundedmomentum.com/ws';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimeout: number | null = null;
  private isIntentionallyClosed = false;
  private authenticated = false;
  private pingInterval: number | null = null;
  private eventListeners: Map<string, Set<EventListener>> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  // Connect to WebSocket server
  connect(token: string): Promise<{ userId: string; connections: number; session: any }> {
    return new Promise((resolve, reject) => {
      this.token = token;
      this.isIntentionallyClosed = false;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Send authentication message
          this.send({ type: 'auth', data: { token } });

          // Set up one-time auth listener
          const authHandler = (data: any) => {
            if (data.userId) {
              this.authenticated = true;
              this.startPingInterval();
              this.off('auth:success', authHandler);
              this.off('auth:error', errorHandler);
              resolve({
                userId: data.userId,
                connections: data.connections,
                session: data.session
              });
            }
          };

          const errorHandler = (data: any) => {
            this.authenticated = false;
            this.off('auth:success', authHandler);
            this.off('auth:error', errorHandler);
            reject(new Error(data.message || 'Authentication failed'));
          };

          this.on('auth:success', authHandler);
          this.on('auth:error', errorHandler);

          // Timeout after 5 seconds
          setTimeout(() => {
            if (!this.authenticated) {
              this.off('auth:success', authHandler);
              this.off('auth:error', errorHandler);
              reject(new Error('Authentication timeout'));
            }
          }, 5000);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSResponse = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.authenticated = false;
          this.stopPingInterval();
          
          this.emit('disconnect', { code: event.code, reason: event.reason });

          if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Disconnect from WebSocket server
  disconnect() {
    this.isIntentionallyClosed = true;
    this.stopPingInterval();
    
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.authenticated = false;
  }

  // Check if connected and authenticated
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.authenticated;
  }

  // Send a message
  private send(message: WSMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }

  // Handle incoming messages
  private handleMessage(message: WSResponse) {
    this.emit(message.type, 'data' in message ? message.data : message);
  }

  // Event listener methods
  on(event: string, listener: EventListener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: EventListener) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  // Reconnection logic
  private scheduleReconnect() {
    if (this.reconnectTimeout !== null) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // Max 30 seconds

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.token && !this.isIntentionallyClosed) {
        this.connect(this.token).catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  // Ping/pong for keep-alive
  private startPingInterval() {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000) as unknown as number; // Ping every 30 seconds
  }

  private stopPingInterval() {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Session management methods
  startSession(data: { project?: string; focusDuration?: number; shortBreakDuration?: number; longBreakDuration?: number }) {
    this.send({ type: 'cadence:session:start', data });
  }

  pauseSession() {
    this.send({ type: 'cadence:session:pause' });
  }

  resumeSession() {
    this.send({ type: 'cadence:session:resume' });
  }

  stopSession() {
    this.send({ type: 'cadence:session:stop' });
  }

  skipBreak() {
    this.send({ type: 'cadence:session:skip' });
  }

  completeSession() {
    this.send({ type: 'cadence:session:complete' });
  }

  requestSession() {
    this.send({ type: 'cadence:session:request' });
  }

  updateSessionProject(project: string) {
    this.send({ type: 'cadence:session:update-project', data: { project } });
  }

  transitionToBreak(breakType: 'short' | 'long', autoStart: boolean) {
    this.send({ type: 'cadence:session:transition-to-break', data: { breakType, autoStart } });
  }

  syncData(data: unknown) {
    this.send({ type: 'cadence:sync', data });
  }

  // Typed event listeners for common events
  onSessionUpdate(listener: (session: any) => void) {
    this.on('cadence:session:update', listener);
  }

  onSessionCompleted(listener: (data: { timerState: string; totalTime: number; timeStarted: string; timeEnded: string; project: string }) => void) {
    this.on('cadence:session:completed', listener);
  }

  onSessionError(listener: (error: { message: string }) => void) {
    this.on('cadence:session:error', listener);
  }

  onDisconnect(listener: (data: { code: number; reason: string }) => void) {
    this.on('disconnect', listener);
  }

  onError(listener: (error: any) => void) {
    this.on('error', listener);
  }
}

// Create a singleton instance
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(url?: string): WebSocketClient {
  if (!wsClient) {
    wsClient = new WebSocketClient(url || DEFAULT_WS_URL);
  }
  return wsClient;
}

export function resetWebSocketClient() {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}
