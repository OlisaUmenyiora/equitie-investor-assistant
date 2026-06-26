// Map the Chat Completions tool definitions to the Realtime API's flat tool shape,
// so both surfaces expose the identical set of deterministic tools (single source of
// truth stays tool-defs.ts).
import { toolDefs } from "./tool-defs";

export interface RealtimeTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const realtimeTools: RealtimeTool[] = toolDefs
  .filter((t) => t.type === "function")
  .map((t) => ({
    type: "function",
    name: t.function.name,
    description: t.function.description ?? "",
    parameters: (t.function.parameters ?? {
      type: "object",
      properties: {},
    }) as Record<string, unknown>,
  }));
