"use client"

import dynamic from "next/dynamic"

const FloatingChatWidget = dynamic(
  () => import("@/components/floating-chat-widget").then((mod) => ({ default: mod.FloatingChatWidget })),
  {
    ssr: false,
  },
)

export function ChatProvider() {
  return <FloatingChatWidget />
}
