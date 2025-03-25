import { useEffect, useState, useCallback, useRef } from "react";
import mapImage from "../assets/map.png";
import "../index.css";

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const PLAYER_RADIUS = 15;

export default function GameMap() {
  const [players, setPlayers] = useState({});
  const [myId, setMyId] = useState(null);
  const [status, setStatus] = useState("Connecting...");
  const [playerCount, setPlayerCount] = useState(0);
  const wsRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const reconnectTimeoutRef = useRef(null);

  // WebSocket management
  const connectWebSocket = useCallback(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8080`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setStatus("Connected!");
      clearTimeout(reconnectTimeoutRef.current);
    };

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    wsRef.current.onclose = () => {
      setStatus("Disconnected. Reconnecting...");
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("Connection error!");
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Message handling
  const handleMessage = useCallback((message) => {
    switch (message.type) {
      case 'init':
        setMyId(message.id);
        setPlayers(message.players);
        break;
      
      case 'newPlayer':
        setPlayers(prev => ({ ...prev, [message.player.id]: message.player }));
        break;
      
      case 'playerMove':
        setPlayers(prev => ({
          ...prev,
          [message.id]: { ...prev[message.id], x: message.x, y: message.y }
        }));
        break;
      
      case 'playerDisconnect':
        setPlayers(prev => {
          const updated = { ...prev };
          delete updated[message.id];
          return updated;
        });
        break;
    }
    setPlayerCount(Object.keys(players).length);
  }, [players]);

  // Movement handlers
  const handleKeyDown = useCallback((e) => {
    if (!myId || !players[myId]) return;

    const step = 10;
    let { x, y } = players[myId];

    switch (e.key) {
      case 'ArrowUp': y -= step; break;
      case 'ArrowDown': y += step; break;
      case 'ArrowLeft': x -= step; break;
      case 'ArrowRight': x += step; break;
      default: return;
    }

    // Apply boundaries
    x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, x));
    y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, y));

    // Optimistic update
    setPlayers(prev => ({
      ...prev,
      [myId]: { ...prev[myId], x, y }
    }));

    // Send movement
    sendMovement(x, y);
  }, [myId, players]);

  const handleClick = useCallback((e) => {
    if (!myId || !players[myId]) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    const boundedX = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, x));
    const boundedY = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, y));

    // Optimistic update
    setPlayers(prev => ({
      ...prev,
      [myId]: { ...prev[myId], x: boundedX, y: boundedY }
    }));

    sendMovement(boundedX, boundedY);
  }, [myId, players]);

  const sendMovement = useCallback((x, y) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'move',
        x,
        y
      }));
      lastPosRef.current = { x, y };
    }
  }, []);

  // Event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="game-container">
      <div className="status">{status}</div>
      <div className="player-count">Players: {playerCount}</div>
      <img src={mapImage} alt="Game Map" className="game-map" />

      {/* Clickable area */}
      <div
        className="clickable-area"
        onClick={handleClick}
        onTouchStart={handleClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />

      {/* Players */}
      {Object.values(players).map(player => (
        <div
          key={player.id}
          className={`player ${player.id === myId ? 'my-player' : ''}`}
          style={{
            left: player.x,
            top: player.y,
            backgroundColor: player.color,
            width: PLAYER_RADIUS * 2,
            height: PLAYER_RADIUS * 2,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {player.id}
        </div>
      ))}
    </div>
  );
}