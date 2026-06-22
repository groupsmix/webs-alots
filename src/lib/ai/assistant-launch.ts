/**
 * Lightweight bridge between the sidebar "Assistant IA" control and the
 * <AgentWidget> panel.
 *
 * The nav lives in the layout shell while the widget is mounted as a sibling
 * (<AgentWidgetMount>), so they are in separate React trees. Rather than thread
 * a shared provider across the server/client boundary, the nav dispatches a
 * window CustomEvent and the widget listens for it. This keeps the widget
 * self-contained and avoids making the whole layout depend on shared state.
 */

export const ASSISTANT_TOGGLE_EVENT = "oltigo:assistant-toggle";
export const ASSISTANT_OPEN_EVENT = "oltigo:assistant-open";

/** Toggle the assistant panel open/closed (used by the sidebar entry). */
export function toggleAssistant(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASSISTANT_TOGGLE_EVENT));
}

/** Force the assistant panel open. */
export function openAssistant(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT));
}
