export type ComposerDraftState = { drafts: Record<string, string>; problem: string };
/** Refuse additional content explicitly; an existing unsent draft is never evicted. */
export function editComposerDraft(current: ComposerDraftState, sessionKey: string, text: string): ComposerDraftState {
  if (text.length > 8000) return { ...current, problem: "A message can contain up to 8,000 characters. Your current draft is preserved." };
  if (text && !current.drafts[sessionKey] && Object.values(current.drafts).filter(Boolean).length >= 16) return { ...current, problem: "You have 16 unsent drafts. Send or clear one before drafting in another conversation. Your drafts are preserved." };
  const drafts = { ...current.drafts };
  if (text) drafts[sessionKey] = text; else delete drafts[sessionKey];
  return { drafts, problem: "" };
}
