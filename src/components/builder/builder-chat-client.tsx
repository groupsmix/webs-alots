"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import type { BuilderModel } from "@/lib/builder/models";

// CF-BUNDLE-02: Lazy-load the BuilderChat client component.
// builder-chat.tsx imports useChat from @ai-sdk/react and
// TextStreamChatTransport from "ai" — both of which used to be statically
// resolved during the server build pass. With ssr: false they ship in
// their own client chunk and are excluded from the Worker bundle.
const BuilderChat = dynamic(
  () => import("./builder-chat").then((m) => ({ default: m.BuilderChat })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

export function BuilderChatClient({
  userId,
  models,
}: {
  userId: string;
  models: BuilderModel[];
}) {
  return <BuilderChat userId={userId} models={models} />;
}
