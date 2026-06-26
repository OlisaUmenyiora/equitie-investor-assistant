import { runChat } from "../src/lib/openai/chat";
import type { ChatTurn } from "../src/lib/openai/chat";

async function ask(inv: string, q: string, history: ChatTurn[] = []) {
  const t = Date.now();
  const r = await runChat(inv, [...history, { role: "user", content: q }]);
  console.log(`\n[${inv}] Q: ${q}`);
  console.log("tools:", r.toolsUsed.join(", ") || "(none)");
  console.log("sources:", r.sources.slice(0, 10).join(", "));
  console.log("reply:", r.reply.slice(0, 700));
  console.log(`(${Date.now() - t}ms)`);
}
(async () => {
  await ask("INV001", "Give me a one-paragraph overview of my whole portfolio with my blended MOIC.");
  await ask("INV011", "What did I actually receive from any exits after carry?");
  await ask("INV001", "How's my Northpeak position doing?"); // disambiguation
  await ask("INV022", "What do I currently hold?"); // zero holdings
})();
