// AI explanation of a finished analysis. Runs on Netlify; the browser never sees an API key.
// Credentials come from Netlify AI Gateway (automatic) or an ANTHROPIC_API_KEY set in Netlify.
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You explain biostatistics results to MBBS interns and postgraduate students in Community Medicine who are writing theses.
Use only the numbers provided. Never invent values, and never contradict the tables.
Write in plain, simple English. Use **bold** for the 3 headings below, and no other markdown.
**What was tested** (1 sentence)
**What the result means** (2-3 sentences, including the effect size and 95% CI where given, and whether it is clinically meaningful)
**How to write it in your thesis** (1-2 sentences in formal results style, plus one caution about assumptions or limitations if relevant)`;

const MAX_INPUT = 14000;

export default async (req: Request) => {
  if (!Netlify.env.get("ANTHROPIC_API_KEY") && !Netlify.env.get("ANTHROPIC_BASE_URL")) {
    return Response.json({ error: "AI explanation is not switched on for this site yet." }, { status: 503 });
  }
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const summary = body?.summary;
  if (!summary || typeof summary !== "object") return Response.json({ error: "Nothing to explain." }, { status: 400 });
  const text = JSON.stringify(summary);
  if (text.length > MAX_INPUT) return Response.json({ error: "This result is too large to explain." }, { status: 413 });

  const client = new Anthropic();
  const models = [Netlify.env.get("AI_MODEL"), "claude-haiku-4-5", "claude-sonnet-4-5"].filter(Boolean) as string[];
  let lastError = "";
  for (const model of models) {
    try {
      const msg = await client.messages.create({
        model, max_tokens: 700, system: SYSTEM,
        messages: [{ role: "user", content: `Explain this result:\n${text}` }],
      });
      const out = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      if (out) return Response.json({ text: out, model });
      lastError = "Empty reply.";
    } catch (e: any) {
      lastError = e?.message || String(e);
      if (e?.status === 404 || (e?.status === 400 && /model/i.test(lastError))) continue; // try next model
      break;
    }
  }
  return Response.json({ error: `AI service error: ${lastError.slice(0, 200)}` }, { status: 502 });
};

export const config = {
  path: "/api/interpret",
  method: "POST",
  rateLimit: { windowLimit: 15, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
