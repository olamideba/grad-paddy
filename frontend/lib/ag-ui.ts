import { HttpAgent } from "@ag-ui/client";
import type { Message } from "@ag-ui/core";
import { auth } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type { Message };
export { EventType } from "@ag-ui/core";
export type {
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  ToolCallStartEvent,
  ToolCallEndEvent,
  StepStartedEvent,
  StepFinishedEvent,
  RunStartedEvent,
  RunFinishedEvent,
  RunErrorEvent,
  BaseEvent,
} from "@ag-ui/core";

export async function createChatAgent(
  messages: Message[],
  threadId: string,
): Promise<HttpAgent> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();

  return new HttpAgent({
    url: `${BASE}/chat`,
    headers: { Authorization: `Bearer ${token}` },
    threadId,
    initialMessages: messages,
    initialState: {},
  });
}
