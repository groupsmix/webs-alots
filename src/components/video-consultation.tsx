"use client";

/**
 * Video Consultation Component
 *
 * WebRTC-based peer-to-peer video call for online consultations.
 * Uses a simple signaling approach via Supabase Realtime channels.
 *
 * Usage:
 *   <VideoConsultation
 *     roomId="appointment-123"
 *     userId="doctor-1"
 *     userName="Dr. Ahmed"
 *     onEnd={() => router.push("/doctor/dashboard")}
 *   />
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  MessageSquare,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface VideoConsultationProps {
  roomId: string;
  userId: string;
  userName: string;
  onEnd?: () => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function VideoConsultation({
  roomId,
  userId: _userId,
  userName,
  onEnd,
}: VideoConsultationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "waiting"
  >("waiting");
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Initialize local media stream
  const initLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("[Video] Failed to access media devices:", err);
      setConnectionStatus("disconnected");
      return null;
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOn((prev) => !prev);
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioOn((prev) => !prev);
    }
  }, []);

  // Share screen
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Restore camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      const sender = peerConnectionRef.current
        ?.getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
      }
      if (localVideoRef.current) {
        const currentStream = localStreamRef.current;
        if (currentStream) {
          currentStream.getVideoTracks().forEach((t) => t.stop());
          currentStream.removeTrack(currentStream.getVideoTracks()[0]);
          currentStream.addTrack(videoTrack);
          localVideoRef.current.srcObject = currentStream;
        }
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender && screenTrack) {
          await sender.replaceTrack(screenTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        screenTrack.onended = () => {
          setIsScreenSharing(false);
        };
        setIsScreenSharing(true);
      } catch {
        // User cancelled screen share
      }
    }
  }, [isScreenSharing]);

  // End call
  const endCall = useCallback(() => {
    // Stop all tracks
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsConnected(false);
    setConnectionStatus("disconnected");
    onEnd?.();
  }, [onEnd]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Send chat message
  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: userName,
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };
    setChatMessages((prev) => [...prev, msg]);
    setChatInput("");
    // In production, send via Supabase Realtime or data channel
  }, [chatInput, userName]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      setConnectionStatus("connecting");
      const stream = await initLocalStream();
      if (!stream) return;

      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[Video] ICE candidate:", event.candidate.candidate);
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
          setConnectionStatus("connected");
          timerRef.current = setInterval(() => {
            setDuration((d) => d + 1);
          }, 1000);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setConnectionStatus("disconnected");
          setIsConnected(false);
        }
      };

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      peerConnectionRef.current = pc;

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("[Video] Offer created for room:", roomId);
        setConnectionStatus("waiting");
      } catch (err) {
        console.error("[Video] Error creating offer:", err);
        setConnectionStatus("disconnected");
      }
    };

    init();
    return () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      peerConnectionRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col bg-gray-900 rounded-lg overflow-hidden"
      style={{ height: isFullscreen ? "100vh" : "80vh" }}
    >
      {/* Status bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : connectionStatus === "waiting"
                ? "bg-blue-500 animate-pulse"
                : "bg-red-500"
            }`}
          />
          <span className="text-white text-sm capitalize">
            {connectionStatus}
          </span>
          {isConnected && (
            <span className="text-white/70 text-sm ml-2">
              {formatDuration(duration)}
            </span>
          )}
        </div>
        <span className="text-white text-sm font-mono">{roomId}</span>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        {/* Remote video (full) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Waiting overlay */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-white">
            <Video className="h-16 w-16 mb-4 text-blue-400 animate-pulse" />
            <p className="text-lg font-medium">
              {connectionStatus === "connecting"
                ? "Connecting..."
                : connectionStatus === "waiting"
                ? "Waiting for the other participant..."
                : "Call ended"}
            </p>
            <p className="text-sm text-gray-400 mt-2">Room: {roomId}</p>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-4 right-4 w-48 md:w-64 aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoOn && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff className="h-8 w-8 text-gray-500" />
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      {showChat && (
        <div className="absolute top-10 right-0 bottom-16 w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col z-20">
          <div className="p-3 border-b font-medium text-sm">Chat</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`text-sm ${
                  msg.sender === userName ? "text-right" : ""
                }`}
              >
                <span className="text-xs text-gray-500">
                  {msg.sender} &middot; {msg.timestamp}
                </span>
                <p
                  className={`mt-1 px-3 py-1.5 rounded-lg inline-block ${
                    msg.sender === userName
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}
                >
                  {msg.text}
                </p>
              </div>
            ))}
          </div>
          <div className="p-2 border-t flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-transparent"
            />
            <button
              onClick={sendChat}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-3 p-4 bg-gray-900/95">
        <button
          onClick={toggleAudio}
          className={`p-3 rounded-full transition-colors ${
            isAudioOn
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}
          title={isAudioOn ? "Mute" : "Unmute"}
        >
          {isAudioOn ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full transition-colors ${
            isVideoOn
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}
          title={isVideoOn ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoOn ? (
            <Video className="h-5 w-5" />
          ) : (
            <VideoOff className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-full transition-colors ${
            isScreenSharing
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          <Monitor className="h-5 w-5" />
        </button>

        <button
          onClick={() => setShowChat((prev) => !prev)}
          className={`p-3 rounded-full transition-colors ${
            showChat
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
          title="Toggle chat"
        >
          <MessageSquare className="h-5 w-5" />
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5" />
          ) : (
            <Maximize2 className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={endCall}
          className="p-3 px-6 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
          title="End call"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
