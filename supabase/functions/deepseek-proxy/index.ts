import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const CYCLE_DAYS: Record<string, number> = {
  日: 1,
  周: 7,
  月: 30,
  半年: 180,
  一年: 365,
};

function cycleDays(cycle: string): number {
  return CYCLE_DAYS[cycle] ?? 30;
}

function cycleTaskRange(cycle: string): [number, number] {
  const d = cycleDays(cycle);
  if (d <= 1) return [3, 4];
  if (d <= 7) return [4, 6];
  if (d <= 30) return [5, 8];
  if (d <= 180) return [8, 10];
  return [8, 10];
}

async function callDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty response from DeepSeek");
  return String(text).trim();
}

function buildTasksPrompt(planName: string, goal: string, cycle: string) {
  const days = cycleDays(cycle);
  const [minT, maxT] = cycleTaskRange(cycle);
  const systemPrompt =
    "你是一个专业的计划管理专家。根据用户的目标和周期，生成具体、可执行的任务列表。输出格式：每行一个任务，格式为'任务名称 | 预计时长(分钟) | 优先级(P0/P1/P2)'，优先级规则：P0-必须完成，P1-尽力完成，P2-可选";
  const userPrompt = `计划名称：${planName}\n目标：${goal}\n周期：${cycle}（共${days}天）\n请生成${minT}到${maxT}条适合每日执行的任务，任务应匹配${days}天的长期目标节奏，只输出任务列表，不要其他说明。`;
  return { systemPrompt, userPrompt, maxT };
}

function buildMotivationPrompt(
  completionRate: number,
  streakDays: number,
  planName: string,
) {
  const systemPrompt =
    "你是一个温暖的激励教练。根据用户的完成情况和连续达标天数，生成一句简短有力的激励话语。要求：不超过30个字，语气亲切，有代入感";
  const userPrompt = `计划名称：${planName}\n今日完成率：${completionRate}%\n连续达标天数：${streakDays}天\n请只输出一句激励语，不要引号和其他说明。`;
  return { systemPrompt, userPrompt };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const type = body?.type;
    const data = body?.data ?? {};

    if (type === "tasks") {
      const { planName, goal, cycle } = data;
      if (!planName && !goal) {
        return new Response(JSON.stringify({ error: "planName or goal required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { systemPrompt, userPrompt, maxT } = buildTasksPrompt(
        planName || goal,
        goal || planName,
        cycle || "月",
      );
      const content = await callDeepSeek(systemPrompt, userPrompt);
      return new Response(JSON.stringify({ content, maxT }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "motivation") {
      const { completionRate, streakDays, planName } = data;
      const { systemPrompt, userPrompt } = buildMotivationPrompt(
        Number(completionRate) || 0,
        Number(streakDays) || 0,
        planName || "你的计划",
      );
      let content = await callDeepSeek(systemPrompt, userPrompt);
      content = content.replace(/^["'「『]|["'」』]$/g, "").slice(0, 30);
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
