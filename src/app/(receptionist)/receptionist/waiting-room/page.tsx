"use client";

import { WaitingRoomManager } from "@/components/receptionist/waiting-room-manager";

export default function WaitingRoomPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Waiting Room</h1>
      <WaitingRoomManager />
    </div>
  );
}
