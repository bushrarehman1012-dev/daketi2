import { useState, useCallback, useRef, useEffect } from 'react';
import socket from '../socket.js';

// STUN: helps peers discover their public IP.
// TURN: relays audio when a direct connection is blocked by NAT/firewall.
// Without TURN, voice only works on the same LAN (same WiFi).
// openrelay.metered.ca is a free public TURN relay for open-source projects.
const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80',                username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',               username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

export function useVoiceChat(myId) {
  const [active,       setActive]       = useState(false);
  const [micMuted,     setMicMuted]     = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [error,        setError]        = useState('');
  const [talking,      setTalking]      = useState(false);

  const stream          = useRef(null);
  const peers           = useRef({});
  const audios          = useRef({});
  const analyser        = useRef(null);
  const animFrame       = useRef(null);
  const speakerMutedRef = useRef(false);
  const activeRef       = useRef(false);
  const joiningRef      = useRef(false); // guard against rapid join/leave race

  const dropPeer = useCallback(id => {
    peers.current[id]?.close();
    delete peers.current[id];
    if (audios.current[id]) { audios.current[id].remove(); delete audios.current[id]; }
  }, []);

  const getPeer = useCallback(peerId => {
    if (peers.current[peerId]) return peers.current[peerId];
    const pc = new RTCPeerConnection({ iceServers: ICE });
    peers.current[peerId] = pc;

    stream.current?.getTracks().forEach(t => pc.addTrack(t, stream.current));

    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('webrtc_signal', { targetId: peerId, type: 'ice', data: e.candidate });
    };
    pc.ontrack = e => {
      let el = audios.current[peerId];
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true;
        el.playsInline = true; // required on iOS Safari
        el.muted = speakerMutedRef.current;
        document.body.appendChild(el);
        audios.current[peerId] = el;
      }
      el.srcObject = e.streams[0];
      // Explicitly call play() — autoplay attribute alone is blocked on Chrome/Safari
      el.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) dropPeer(peerId);
    };
    return pc;
  }, [dropPeer]);

  useEffect(() => {
    async function onSignal({ fromId, type, data }) {
      try {
        if (!activeRef.current && type !== 'peer_joined') return;
        if (type === 'peer_joined') {
          if (!activeRef.current) return;
          const pc = getPeer(data.peerId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_signal', { targetId: data.peerId, type: 'offer', data: offer });
        } else if (type === 'offer') {
          const pc = getPeer(fromId);
          // Pass plain object directly — new RTCSessionDescription() is deprecated
          await pc.setRemoteDescription(data);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc_signal', { targetId: fromId, type: 'answer', data: answer });
        } else if (type === 'answer') {
          await peers.current[fromId]?.setRemoteDescription(data);
        } else if (type === 'ice') {
          await peers.current[fromId]?.addIceCandidate(data);
        }
      } catch (e) {
        // WebRTC negotiation failed — drop the peer so a re-join can reattempt
        if (fromId) dropPeer(fromId);
      }
    }
    socket.on('webrtc_signal', onSignal);
    return () => socket.off('webrtc_signal', onSignal);
  }, [getPeer, dropPeer]);

  function startVolumeDetect(mediaStream) {
    try {
      const ac  = new AudioContext();
      const src = ac.createMediaStreamSource(mediaStream);
      const node = ac.createAnalyser();
      node.fftSize = 256;
      src.connect(node);
      analyser.current = node;
      const buf = new Uint8Array(node.frequencyBinCount);
      function tick() {
        node.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setTalking(avg > 10);
        animFrame.current = requestAnimationFrame(tick);
      }
      tick();
    } catch (_) {}
  }

  const join = useCallback(async () => {
    if (joiningRef.current || activeRef.current) return; // prevent double-join
    joiningRef.current = true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.current = s;
      activeRef.current = true;
      setActive(true);
      setMicMuted(false);
      setError('');
      startVolumeDetect(s);
      socket.emit('voice_join');
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Mic access denied' : 'Could not open mic');
    } finally {
      joiningRef.current = false;
    }
  }, []);

  const leave = useCallback(() => {
    if (!activeRef.current) return;
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    Object.keys(peers.current).forEach(id => dropPeer(id));
    cancelAnimationFrame(animFrame.current);
    activeRef.current = false;
    setActive(false);
    setMicMuted(false);
    setTalking(false);
    socket.emit('voice_leave');
  }, [dropPeer]);

  const toggleMic = useCallback(() => {
    if (!stream.current) return;
    stream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicMuted(m => {
      if (!m) setTalking(false);
      return !m;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setSpeakerMuted(prev => {
      const next = !prev;
      speakerMutedRef.current = next;
      Object.values(audios.current).forEach(el => { el.muted = next; });
      return next;
    });
  }, []);

  return { active, micMuted, speakerMuted, talking, error, join, leave, toggleMic, toggleSpeaker };
}
