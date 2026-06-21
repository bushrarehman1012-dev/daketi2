import { useState, useCallback, useRef, useEffect } from 'react';
import socket from '../socket.js';

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useVoiceChat(myId) {
  const [active,  setActive]  = useState(false);
  const [error,   setError]   = useState('');
  const [talking, setTalking] = useState(false); // true while mic is open

  const stream  = useRef(null);
  const peers   = useRef({});   // peerId → RTCPeerConnection
  const audios  = useRef({});   // peerId → <audio>
  const analyser = useRef(null);
  const animFrame = useRef(null);

  // Cleanup a single peer
  const dropPeer = useCallback(id => {
    peers.current[id]?.close();
    delete peers.current[id];
    if (audios.current[id]) { audios.current[id].remove(); delete audios.current[id]; }
  }, []);

  // Create or return existing RTCPeerConnection for a remote peer
  const getPeer = useCallback((peerId) => {
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
        document.body.appendChild(el);
        audios.current[peerId] = el;
      }
      el.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) dropPeer(peerId);
    };
    return pc;
  }, [dropPeer]);

  // Handle incoming WebRTC signals
  useEffect(() => {
    async function onSignal({ fromId, type, data }) {
      if (!active && type !== 'peer_joined') return;
      if (type === 'peer_joined') {
        // Existing participants receive this — initiate offer to new joiner
        if (!active) return;
        const pc = getPeer(data.peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_signal', { targetId: data.peerId, type: 'offer', data: offer });
      } else if (type === 'offer') {
        const pc = getPeer(fromId);
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_signal', { targetId: fromId, type: 'answer', data: answer });
      } else if (type === 'answer') {
        await peers.current[fromId]?.setRemoteDescription(new RTCSessionDescription(data));
      } else if (type === 'ice') {
        try { await peers.current[fromId]?.addIceCandidate(new RTCIceCandidate(data)); } catch (_) {}
      }
    }
    socket.on('webrtc_signal', onSignal);
    return () => socket.off('webrtc_signal', onSignal);
  }, [active, getPeer]);

  // Volume indicator using AnalyserNode
  function startVolumeDetect(mediaStream) {
    try {
      const ctx  = new AudioContext();
      const src  = ctx.createMediaStreamSource(mediaStream);
      const node = ctx.createAnalyser();
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

  const start = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.current = s;
      setActive(true);
      setError('');
      startVolumeDetect(s);
      socket.emit('voice_join');
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Mic access denied' : 'Could not open mic');
    }
  }, []);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    Object.keys(peers.current).forEach(dropPeer);
    cancelAnimationFrame(animFrame.current);
    setActive(false);
    setTalking(false);
    socket.emit('voice_leave');
  }, [dropPeer]);

  const toggle = useCallback(() => { active ? stop() : start(); }, [active, start, stop]);

  return { active, talking, error, toggle };
}
