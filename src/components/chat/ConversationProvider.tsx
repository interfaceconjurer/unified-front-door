"use client";

import { createContext, useContext, useState } from "react";
import { ConversationStore } from "@/lib/chat/conversation";

const ConversationContext = createContext<ConversationStore | null>(null);

/** Lives with the workspace so a creation canvas can prepare the new project's
 * welcome before publishing the project and changing the selected workspace. */
export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => new ConversationStore());
  return <ConversationContext.Provider value={store}>{children}</ConversationContext.Provider>;
}

export function useConversationStore() {
  const store = useContext(ConversationContext);
  if (!store) throw new Error("useConversationStore must be used within a ConversationProvider");
  return store;
}
