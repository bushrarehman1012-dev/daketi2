import { useState, useCallback, useRef, useEffect } from 'react';
import socket from '../socket.js';

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

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
  const speakerMutedRef = useRef(false); // stable ref for use inside getPeer callbacks

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
        el.muted = speakerMutedRef.current; // respect current speaker state for new connections
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

  useEffect(() => {
    async function onSignal({ fromId, type, data }) {
      if (!active && type !== 'peer_joined') return;
      if (type === 'peer_joined') {
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

  // Join voice — opens mic, connects to room
  const join = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.current = s;
      setActive(true);
      setMicMuted(false);
      setError('');
      startVolumeDetect(s);
      socket.emit('voice_join');
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Mic access denied' : 'Could not open mic');
    }
  }, []);

  // Leave voice — closes mic and all peer connections
  const leave = useCallback(() => {
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    Object.keys(peers.current).forEach(dropPeer);
    cancelAnimationFrame(animFrame.current);
    setActive(false);
    setMicMuted(false);
    setTalking(false);
    socket.emit('voice_leave');
  }, [dropPeer]);

  // Mute/unmute mic — disables audio tracks WITHOUT dropping peer connections
  // Other players keep hearing silence; you still hear them.
  const toggleMic = useCallback(() => {
    if (!stream.current) return;
    stream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicMuted(m => {
      if (!m) setTalking(false); // clear indicator when muting
      return !m;
    });
  }, []);

  // Mute/unmute speaker — mutes the <audio> elements for all peers
  // Your mic is unaffected; you can still talk without hearing others.
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
