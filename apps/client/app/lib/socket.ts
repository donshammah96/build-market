/**
 * Socket.IO Client Utility
 * Manages WebSocket connection to the messaging service
 */

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Initialize and return the socket connection
 * @param token - JWT token for authentication
 * @returns Socket instance
 */
export function getSocket(token?: string): Socket | null {
  if (!token) {
    console.warn("No token provided for socket connection");
    return null;
  }

  // Return existing connection if already initialized
  if (socket && socket.connected) {
    return socket;
  }

  // Create new connection
  const MESSAGING_SERVICE_URL =
    process.env.NEXT_PUBLIC_MESSAGING_SERVICE_URL || "http://localhost:3010";

  socket = io(MESSAGING_SERVICE_URL, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    transports: ["websocket", "polling"],
  });

  // Connection event handlers
  socket.on("connect", () => {
    console.log("✓ Socket connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("✗ Socket disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
  });

  socket.on("authenticated", (data) => {
    console.log("✓ Socket authenticated:", data);
  });

  return socket;
}

/**
 * Disconnect the socket
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("Socket disconnected manually");
  }
}

/**
 * Check if socket is connected
 */
export function isSocketConnected(): boolean {
  return socket?.connected || false;
}

/**
 * Get the current socket instance (if exists)
 */
export function getCurrentSocket(): Socket | null {
  return socket;
}
