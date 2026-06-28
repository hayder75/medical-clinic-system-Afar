import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const SOCKET_URL = process.env.REACT_APP_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:3001'
    : `${window.location.protocol}//${window.location.hostname}:3001`
);

export default function useSocket(eventHandlers = {}) {
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  const handlersRef = useRef(eventHandlers);

  handlersRef.current = eventHandlers;

  useEffect(() => {
    if (!token || !user) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[WS] Connected');
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    socket.on('queue:visit-update', (data) => {
      if (handlersRef.current.onVisitUpdate) {
        handlersRef.current.onVisitUpdate(data);
      }
    });

    socket.on('queue:new-visit', (data) => {
      if (handlersRef.current.onNewVisit) {
        handlersRef.current.onNewVisit(data);
      }
    });

    socket.on('queue:results-ready', (data) => {
      if (handlersRef.current.onResultsReady) {
        handlersRef.current.onResultsReady(data);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user]);

  return socketRef;
}
