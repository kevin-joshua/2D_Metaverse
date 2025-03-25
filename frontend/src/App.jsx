import { useEffect, useState, useCallback, useRef } from "react";
import { WebRTCManager } from './utils/webRTCManager.js';
import mapImage from "./assets/map.png";
import avatar1 from "./assets/avatar1.png"
import avatar2 from "./assets/avatar2.png"

import "./index.css";

// Map configuration - adjust these based on your actual map image
const MAP_WIDTH = 800;
const MAP_HEIGHT = 650;
const MAP_OFFSET_X = 400; // Horizontal offset from container
const MAP_OFFSET_Y = 30; // Vertical offset from container
const PLAYER_RADIUS = 15;

export default function GameMap() {
  const [players, setPlayers] = useState({});
  const [myId, setMyId] = useState(null);
  const [status, setStatus] = useState("Connecting...");
  const [playerCount, setPlayerCount] = useState(0);
  const wsRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const reconnectTimeoutRef = useRef(null);
  const avatarCounter = useRef(1);
  const webRTCManager = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [localStream, setLocalStream] = useState(null);

  const getNextAvatar = useCallback(() => {
    // For sequential pattern: 1, 2, 2, 1, 2, 2...
    const pattern = [1, 2, 2];
    const avatar = pattern[avatarCounter.current % pattern.length];
    avatarCounter.current++;
    return avatar;

    // For random selection (uncomment below):
    // return Math.random() < 0.5 ? 1 : 2;
  }, []);



  const renderPlayer = (player) => {
    const avatar = player.id === myId ? 
      avatar1 : // Force own avatar to always be avatar1
      player.avatar === 1 ? avatar1 : avatar2;

    return (
      <img
        key={player.id}
        src={avatar}
        alt={`Player ${player.id}`}
        className={`player ${player.id === myId ? "my-player" : ""}`}
        style={{
          left: player.x,
          top: player.y,
          transform: "translate(-50%, -50%)",
          width: `${PLAYER_RADIUS * 3}px`,
          height: `${PLAYER_RADIUS * 3}px`,
          position: "absolute",
          pointerEvents: "none"
        }}
      />
    );
  };




  // Clamp position to map boundaries
  const clampToMap = useCallback((x, y) => ({
    x: Math.max(MAP_OFFSET_X + PLAYER_RADIUS, 
               Math.min(x, MAP_OFFSET_X + MAP_WIDTH - PLAYER_RADIUS)),
    y: Math.max(MAP_OFFSET_Y + PLAYER_RADIUS,
               Math.min(y, MAP_OFFSET_Y + MAP_HEIGHT - PLAYER_RADIUS))
  }), []);

  // WebSocket connection
  // In App.jsx
const connectWebSocket = useCallback(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8000`;
  
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
  
    // Connection opened
    ws.onopen = () => {
      setStatus("Connected!");
      clearTimeout(reconnectTimeoutRef.current);
      
      // Initialize WebRTC after successful connection
      webRTCManager.current = new WebRTCManager(ws, myId || 'temp-id');
      webRTCManager.current.initializeLocalStream()
        .then(stream => setLocalStream(stream))
        .catch(console.error);
    };
  
    // Handle messages
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
      
      // Handle proximity and WebRTC signals
      if (message.type === 'proximity') {
        message.inRange 
          ? webRTCManager.current?.initiateCall(message.peerId)
          : webRTCManager.current?.closeConnection(message.peerId);
      }
      else if (['offer', 'answer', 'ice-candidate'].includes(message.type)) {
        webRTCManager.current?.handleSignalingMessage(message);
      }
    };
  
    // Handle closure
    ws.onclose = () => {
      if (!reconnectTimeoutRef.current) {
        setStatus("Disconnected. Reconnecting...");
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      }
    };
  
    // Handle errors
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("Connection error!");
    };
  }, [myId]);
  
  // Improved useEffect with cleanup
  useEffect(() => {
    let isMounted = true;
    
    const connect = () => {
      if (isMounted) {
        connectWebSocket();
      }
    };
  
    connect();
  
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
      
      if (wsRef.current) {
        // Only close if connection is established
        if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(wsRef.current.readyState)) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
  
      // Cleanup WebRTC
      if (webRTCManager.current) {
        webRTCManager.current.peers.forEach(pc => pc.close());
        webRTCManager.current = null;
      }
    };
  }, [connectWebSocket]);
  // Message handler with boundary checks
  const handleMessage = useCallback((message) => {
    const clampPlayerPositions = (players) => {
      return Object.fromEntries(
        Object.entries(players).map(([id, player]) => {
          const clamped = clampToMap(player.x, player.y);
          return [id, { ...player, ...clamped }];
        })
      );
    };

    switch (message.type) {
      
      case 'init':
        setMyId(message.id);
        setPlayers(clampPlayerPositions(message.players));
        break;

        case 'newPlayer':
            setPlayers(prev => ({
              ...prev,
              [message.player.id]: {
                ...message.player,
                ...clampToMap(message.player.x, message.player.y)
              }
            }));
            break;
      
      case 'playerMove':
        setPlayers(prev => {
          const clamped = clampToMap(message.x, message.y);
          return {
            ...prev,
            [message.id]: { 
              ...prev[message.id],
              x: clamped.x,
              y: clamped.y
            }
          };
        });
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
  }, [players, clampToMap, getNextAvatar]);

  // Movement handlers with boundary enforcement
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

    const clamped = clampToMap(x, y);
    setPlayers(prev => ({
      ...prev,
      [myId]: { ...prev[myId], x: clamped.x, y: clamped.y }
    }));
    sendMovement(clamped.x, clamped.y);
  }, [myId, players, clampToMap]);

  const handleClick = useCallback((e) => {
    if (!myId || !players[myId]) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = (e.clientX || e.touches[0].clientX) - rect.left;
    const rawY = (e.clientY || e.touches[0].clientY) - rect.top;

    const clamped = clampToMap(rawX, rawY);
    setPlayers(prev => ({
      ...prev,
      [myId]: { ...prev[myId], x: clamped.x, y: clamped.y }
    }));
    sendMovement(clamped.x, clamped.y);
  }, [myId, players, clampToMap]);

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

  useEffect(() => {
    connectWebSocket();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);


  useEffect(() => {
    const initWebRTC = () => {
      webRTCManager.current = new WebRTCManager(wsRef.current, myId);
      
      webRTCManager.current.initializeLocalStream()
        .then(stream => setLocalStream(stream))
        .catch(error => console.error('Media error:', error));
    };
  
    if (myId && wsRef.current) {
      initWebRTC();
    }
  }, [myId]);
  
  

   // Update remote streams
   useEffect(() => {
    const updateStreams = () => {
      setRemoteStreams(new Map(webRTCManager.current.remoteStreams));
    };
    
    const interval = setInterval(updateStreams, 1000);
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="app-container">
         {localStream && (
        <video 
          autoPlay 
          muted 
          ref={el => el && (el.srcObject = localStream)}
          style={{ width: '200px', position: 'fixed', bottom: 20, right: 20 }}
        />
      )}


{Array.from(remoteStreams).map(([peerId, stream]) => {
  // Get player position from your game state
  const playerPosition = players[peerId] || { x: 0, y: 0 };
  
  return (
    <video
      key={peerId}
      autoPlay
      ref={el => el && (el.srcObject = stream)}
      style={{ 
        width: '200px',
        position: 'absolute',
        left: `${playerPosition.x}px`,
        top: `${playerPosition.y - 40}px`,  // Offset above player
        transform: 'translateX(-50%)',
        zIndex: 1000
      }}
    />
  );
})}
 

      <div className="status">{status}</div>
      <div className="player-count">Players: {playerCount}</div>
      <img src={mapImage} alt="Game Map" className="game-map" 
           style={{ width: MAP_WIDTH, height: MAP_HEIGHT }} />

      <div
        className="clickable-area"
        onClick={handleClick}
        onTouchStart={handleClick}
        style={{
          position: 'absolute',
          top: MAP_OFFSET_Y,
          left: MAP_OFFSET_X,
          width: MAP_WIDTH,
          height: MAP_HEIGHT
        }}
      />

       {Object.values(players).map(renderPlayer)}
    </div>
  );
}