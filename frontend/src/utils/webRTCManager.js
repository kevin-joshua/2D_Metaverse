import { toast } from 'react-toastify';

export class WebRTCManager {
  constructor(webSocket, localPlayerId) {
    this.peers = new Map();
    this.webSocket = webSocket;
    this.localPlayerId = localPlayerId;
    this.localStream = null;
    this.remoteStreams = new Map();
    this.connectionStates = new Map();
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { 
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];
  }

  async initializeLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: true
      });

      // Ensure tracks are ready
      this.localStream.getTracks().forEach(track => {
        track.onended = () => {
          console.log(`${track.kind} track ended`);
        };
      });

      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      // User-friendly error handling
      if (error.name === 'NotAllowedError') {
        toast.error('Camera/Microphone access denied. Please check your permissions.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera or microphone found. Please connect a device.');
      } else {
        toast.error('Failed to access media devices.');
      }

      throw error;
    }
  }

  async createPeerConnection(peerId) {
    if (this.peers.has(peerId)) {
      console.log(`Peer connection to ${peerId} already exists`);
      return this.peers.get(peerId);
    }

    try {
      const pc = new RTCPeerConnection({ 
        iceServers: this.iceServers,
        iceCandidatePoolSize: 10 
      });

      // Add local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.localStream);
        });
      }

      // ICE Candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.webSocket.send(JSON.stringify({
            type: 'ice-candidate',
            target: peerId,
            sender: this.localPlayerId,
            candidate: event.candidate
          }));
        }
      };

      // Connection state tracking
      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}: ${pc.connectionState}`);
        this.connectionStates.set(peerId, pc.connectionState);

        switch (pc.connectionState) {
          case 'connected':
            toast.success(`Connected to player ${peerId}`);
            break;
          case 'failed':
            toast.error(`Connection to player ${peerId} failed`);
            this.closeConnection(peerId);
            break;
          case 'disconnected':
            toast.warning(`Disconnected from player ${peerId}`);
            break;
        }
      };

      // Remote stream handling
      pc.ontrack = (event) => {
        console.log(`Received remote track from ${peerId}`);
        const remoteStream = event.streams[0];
        this.remoteStreams.set(peerId, remoteStream);
      };

      this.peers.set(peerId, pc);
      return pc;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      toast.error(`Failed to create connection with player ${peerId}`);
      throw error;
    }
  }

  async initiateCall(peerId) {
    if (this.connectionStates.get(peerId) === 'connecting') return;

    try {
      this.connectionStates.set(peerId, 'connecting');
      const pc = await this.createPeerConnection(peerId);

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      // Send offer via WebSocket
      this.webSocket.send(JSON.stringify({
        type: 'offer',
        target: peerId,
        sender: this.localPlayerId,
        offer: offer
      }));
    } catch (error) {
      console.error('Call initiation failed:', error);
      this.connectionStates.delete(peerId);
      toast.error(`Failed to initiate call with player ${peerId}`);
    }
  }

  async handleOffer({ offer, sender }) {
    try {
      const pc = await this.createPeerConnection(sender);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      this.webSocket.send(JSON.stringify({
        type: 'answer',
        target: sender,
        sender: this.localPlayerId,
        answer: answer
      }));
    } catch (error) {
      console.error('Error handling offer:', error);
      toast.error(`Failed to handle offer from player ${sender}`);
    }
  }

  async handleAnswer({ answer, sender }) {
    try {
      const pc = this.peers.get(sender);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      toast.error(`Failed to process answer from player ${sender}`);
    }
  }

  async handleIceCandidate({ candidate, sender }) {
    try {
      const pc = this.peers.get(sender);
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  closeConnection(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
      this.remoteStreams.delete(peerId);
      this.connectionStates.delete(peerId);
      
      toast.info(`Closed connection with player ${peerId}`);
    }
  }

  // Clean up all connections
  cleanup() {
    this.peers.forEach((pc, peerId) => this.closeConnection(peerId));
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}