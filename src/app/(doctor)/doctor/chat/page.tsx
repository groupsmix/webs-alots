"use client";

import { Send, MessageCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCurrentUser, type ClinicUser } from "@/lib/data/client";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export default function DoctorChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [user, setUser] = useState<ClinicUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getCurrentUser()
      .then((u) => {
        if (!controller.signal.aborted) setUser(u);
      })
      .catch(() => {
        // ignored — component unmounted or fetch failed
      });
    return () => { controller.abort(); };
  }, []);

  const doctorId = user?.id ?? "";
  const doctorName = user?.name ?? "Doctor";
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() || !user) return;

    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: doctorId,
      senderName: doctorName,
      senderRole: "doctor",
      recipientId: "",
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
      read: true,
    };

    setMessages((prev) => [...prev, msg]);
    setNewMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const unreadCount = messages.filter((m) => m.senderRole === "receptionist" && !m.read).length;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Chat" }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6" />
          Internal Chat
        </h1>
        {unreadCount > 0 && (
          <Badge variant="destructive">{unreadCount} unread</Badge>
        )}
      </div>

      <Card className="max-w-3xl mx-auto">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">RS</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">Receptionist Sara</CardTitle>
              <p className="text-xs text-muted-foreground">Reception Desk</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px] p-4">
            <div className="space-y-4">
              {messages.map((msg) => {
                const isDoctor = msg.senderRole === "doctor";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isDoctor ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className={`text-[10px] ${isDoctor ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {isDoctor ? "Dr" : "RS"}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[70%] ${isDoctor ? "text-right" : ""}`}>
                      <div
                        className={`rounded-lg px-3 py-2 text-sm ${
                          isDoctor
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.message}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatTime(msg.timestamp)}
                        {!msg.read && !isDoctor && (
                          <span className="ml-2 text-blue-500 font-medium">New</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={!newMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
