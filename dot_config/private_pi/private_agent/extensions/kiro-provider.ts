import { execFileSync } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  calculateCost,
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@mariozechner/pi-ai";

type KiroAuthDetails = {
  refresh: string;
  access: string;
  expires: number;
  authMethod: "desktop" | "idc";
  region: string;
  oidcRegion?: string;
  profileArn?: string;
  clientId?: string;
  clientSecret?: string;
  email?: string;
};

type OpenAIChunk = {
  id?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string;
      reasoning_content?: string;
      reasoning?: string;
      reasoning_text?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
};

const DEFAULT_REGION = "us-east-1";
const TOKEN_BUFFER_MS = 120_000;

const MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5": "claude-haiku-4.5",
  "claude-haiku-4-5-thinking": "claude-haiku-4.5",
  "claude-sonnet-4-5": "claude-sonnet-4.5",
  "claude-sonnet-4-5-thinking": "claude-sonnet-4.5",
  "claude-sonnet-4-5-1m": "claude-sonnet-4.5-1m",
  "claude-sonnet-4-5-1m-thinking": "claude-sonnet-4.5-1m",
  "claude-sonnet-4-6": "claude-sonnet-4.6",
  "claude-sonnet-4-6-thinking": "claude-sonnet-4.6",
  "claude-sonnet-4-6-1m": "claude-sonnet-4.6-1m",
  "claude-sonnet-4-6-1m-thinking": "claude-sonnet-4.6-1m",
  "claude-opus-4-5": "claude-opus-4.5",
  "claude-opus-4-5-thinking": "claude-opus-4.5",
  "claude-opus-4-6": "claude-opus-4.6",
  "claude-opus-4-6-thinking": "claude-opus-4.6",
  "claude-opus-4-6-1m": "claude-opus-4.6-1m",
  "claude-opus-4-6-1m-thinking": "claude-opus-4.6-1m",
  "qwen3-coder-480b": "QWEN3_CODER_480B_A35B_1_0",
};

const MODELS = [
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
  { id: "claude-sonnet-4-5-thinking", name: "Claude Sonnet 4.5 Thinking", reasoning: true },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "claude-sonnet-4-6-thinking", name: "Claude Sonnet 4.6 Thinking", reasoning: true },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
  { id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 Thinking", reasoning: true },
  { id: "qwen3-coder-480b", name: "Qwen3 Coder 480B" },
];

function getKiroCliDbPath(): string {
  if (process.env.KIROCLI_DB_PATH) return process.env.KIROCLI_DB_PATH;
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "kiro-cli", "data.sqlite3");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "kiro-cli", "data.sqlite3");
  }
  return path.join(os.homedir(), ".local", "share", "kiro-cli", "data.sqlite3");
}

function runSqliteJson<T>(dbPath: string, sql: string): T {
  const out = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return (out ? JSON.parse(out) : []) as T;
}

function extractRegionFromArn(arn?: string): string | undefined {
  if (!arn) return undefined;
  const parts = arn.split(":");
  if (parts.length < 6 || parts[0] !== "arn") return undefined;
  return parts[3] || undefined;
}

function parseExpiry(value: unknown): number {
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value === "string") {
    const t = new Date(value).getTime();
    if (!Number.isNaN(t) && t > 0) return t;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n < 10_000_000_000 ? n * 1000 : n;
  }
  return 0;
}

async function refreshAccessToken(auth: KiroAuthDetails): Promise<KiroAuthDetails> {
  const isIdc = auth.authMethod === "idc";
  const url = isIdc
    ? `https://oidc.${auth.oidcRegion || auth.region}.amazonaws.com/token`
    : `https://prod.${auth.region}.auth.desktop.kiro.dev/refreshToken`;

  const body = isIdc
    ? {
        refreshToken: auth.refresh,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
        grantType: "refresh_token",
      }
    : { refreshToken: auth.refresh };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-amzn-kiro-agent-mode": "vibe",
      "user-agent": "KiroIDE",
      Connection: "close",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Kiro token refresh failed (${res.status}): ${txt}`);
  }

  const data = (await res.json()) as any;
  const access = data.access_token || data.accessToken;
  if (!access) throw new Error("Kiro token refresh returned no access token");

  return {
    ...auth,
    access,
    refresh: data.refresh_token || data.refreshToken || auth.refresh,
    expires: Date.now() + ((data.expires_in || data.expiresIn || 3600) as number) * 1000,
    email: auth.email || data?.userInfo?.email,
  };
}

async function getAuthFromKiroCli(): Promise<KiroAuthDetails> {
  const dbPath = getKiroCliDbPath();

  const rows = runSqliteJson<Array<{ key: string; value: string }>>(
    dbPath,
    "select key, value from auth_kv where key like '%:token'",
  );

  if (!rows.length) {
    throw new Error("No Kiro CLI tokens found. Run: kiro-cli login");
  }

  const candidates = rows
    .map((row) => {
      let value: any = null;
      try {
        value = JSON.parse(row.value);
      } catch {
        return null;
      }
      const profileArn = value.profile_arn || value.profileArn;
      const region = extractRegionFromArn(profileArn) || value.region || DEFAULT_REGION;
      const authMethod: "desktop" | "idc" = row.key.includes("odic") ? "idc" : "desktop";
      const expires = parseExpiry(value.expires_at ?? value.expiresAt) || Date.now() + 30 * 60 * 1000;
      const access = value.access_token || value.accessToken;
      const refresh = value.refresh_token || value.refreshToken;
      if (!access || !refresh) return null;
      return {
        key: row.key,
        auth: {
          refresh,
          access,
          expires,
          authMethod,
          region,
          oidcRegion: value.region,
          profileArn,
          clientId: value.client_id || value.clientId,
          clientSecret: value.client_secret || value.clientSecret,
          email: value.email,
        } satisfies KiroAuthDetails,
      };
    })
    .filter(Boolean) as Array<{ key: string; auth: KiroAuthDetails }>;

  if (!candidates.length) {
    throw new Error("Kiro CLI token rows found, but none were parseable");
  }

  candidates.sort((a, b) => b.auth.expires - a.auth.expires);
  let selected = candidates[0]!.auth;

  if (Date.now() >= selected.expires - TOKEN_BUFFER_MS) {
    selected = await refreshAccessToken(selected);
  }

  return selected;
}

function stripControlChars(text: string): string {
  // Keep newlines/tabs, drop terminal escape/control bytes that can break Kiro parsing.
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function textFromContent(content: any): string {
  if (typeof content === "string") return stripControlChars(content);
  if (!Array.isArray(content)) return "";
  return stripControlChars(
    content
      .map((c) => {
        if (typeof c === "string") return c;
        if (!c || typeof c !== "object") return "";
        if (c.type === "text") return c.text || "";
        if (c.type === "thinking") return c.thinking || c.text || "";
        return "";
      })
      .join(""),
  );
}

function convertMessages(context: Context): any[] {
  const result: any[] = [];

  if ((context as any).systemPrompt) {
    result.push({ role: "system", content: (context as any).systemPrompt });
  }

  for (const msg of (context.messages || []) as any[]) {
    if (msg.role === "user") {
      const text = textFromContent(msg.content);
      result.push({ role: "user", content: text || "Continue" });
      continue;
    }

    if (msg.role === "assistant") {
      const assistantContent: any[] = [];
      const toolCalls: any[] = [];

      for (const block of msg.content || []) {
        if (block.type === "text") assistantContent.push({ type: "text", text: block.text || "" });
        if (block.type === "thinking") assistantContent.push({ type: "thinking", thinking: block.thinking || "" });
        if (block.type === "toolCall") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.arguments || {}),
            },
          });
          assistantContent.push({
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: block.arguments || {},
          });
        }
      }

      result.push({
        role: "assistant",
        content: assistantContent.length ? assistantContent : textFromContent(msg.content),
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }

    if (msg.role === "toolResult") {
      result.push({
        role: "tool",
        tool_call_id: msg.toolCallId,
        content: textFromContent(msg.content) || "",
      });
    }
  }

  return result;
}

function convertTools(context: Context): any[] | undefined {
  const tools = (context as any).tools as any[] | undefined;
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.inputSchema || t.parameters || { type: "object", properties: {} },
    },
  }));
}

let opencodeModulesPromise: Promise<{
  transformToCodeWhisperer: (url: string, body: any, model: string, auth: any, think?: boolean, budget?: number) => any;
  transformKiroStream: (response: Response, model: string, conversationId: string) => AsyncGenerator<any>;
}> | null = null;

function getOpencodeModules() {
  if (!opencodeModulesPromise) {
    opencodeModulesPromise = (async () => {
      const base = path.join(
        os.homedir(),
        ".config",
        "opencode",
        "node_modules",
        "@zhafron",
        "opencode-kiro-auth",
        "dist",
      );

      const requestMod = (await import(pathToFileURL(path.join(base, "plugin", "request.js")).href)) as any;
      const streamMod = (await import(pathToFileURL(path.join(base, "plugin", "streaming", "stream-transformer.js")).href)) as any;

      return {
        transformToCodeWhisperer: requestMod.transformToCodeWhisperer,
        transformKiroStream: streamMod.transformKiroStream,
      };
    })();
  }
  return opencodeModulesPromise;
}

function mapStopReason(reason?: string | null): "stop" | "length" | "toolUse" {
  if (!reason || reason === "stop" || reason === "end" || reason === "end_turn") return "stop";
  if (reason === "length") return "length";
  if (reason === "tool_calls" || reason === "function_call") return "toolUse";
  return "stop";
}

function defaultThinkingBudget(level?: string): number {
  if (level === "minimal") return 4096;
  if (level === "low") return 8192;
  if (level === "medium") return 16384;
  if (level === "high" || level === "xhigh") return 32768;
  return 16384;
}

function lastUserMessageText(context: Context): string {
  const msgs = (context.messages || []) as any[];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "user") {
      const t = textFromContent(m.content).trim();
      if (t) return t;
    }
  }
  return "Continue";
}

async function parseOpenAIChunksIntoStream(
  chunks: AsyncGenerator<OpenAIChunk>,
  model: Model<Api>,
  stream: AssistantMessageEventStream,
  output: AssistantMessage,
) {
  type ToolBlock = { type: "toolCall"; id: string; name: string; arguments: any; partialJson: string };
  let currentTextIndex: number | null = null;
  let currentThinkingIndex: number | null = null;
  const toolByIndex = new Map<number, number>();

  const ensureTextBlock = () => {
    if (currentTextIndex !== null) return currentTextIndex;
    if (currentThinkingIndex !== null) {
      const block = output.content[currentThinkingIndex] as any;
      stream.push({ type: "thinking_end", contentIndex: currentThinkingIndex, content: block.thinking || "", partial: output });
      currentThinkingIndex = null;
    }
    output.content.push({ type: "text", text: "" } as any);
    currentTextIndex = output.content.length - 1;
    stream.push({ type: "text_start", contentIndex: currentTextIndex, partial: output });
    return currentTextIndex;
  };

  const ensureThinkingBlock = () => {
    if (currentThinkingIndex !== null) return currentThinkingIndex;
    if (currentTextIndex !== null) {
      const block = output.content[currentTextIndex] as any;
      stream.push({ type: "text_end", contentIndex: currentTextIndex, content: block.text || "", partial: output });
      currentTextIndex = null;
    }
    output.content.push({ type: "thinking", thinking: "" } as any);
    currentThinkingIndex = output.content.length - 1;
    stream.push({ type: "thinking_start", contentIndex: currentThinkingIndex, partial: output });
    return currentThinkingIndex;
  };

  for await (const chunk of chunks) {
    output.responseId ||= chunk.id;

    if (chunk.usage) {
      output.usage.input = chunk.usage.prompt_tokens || 0;
      output.usage.output = chunk.usage.completion_tokens || 0;
      output.usage.cacheRead = 0;
      output.usage.cacheWrite = 0;
      output.usage.totalTokens = output.usage.input + output.usage.output;
      calculateCost(model, output.usage);
    }

    const choice = chunk.choices?.[0];
    if (!choice) continue;

    if (choice.finish_reason) {
      output.stopReason = mapStopReason(choice.finish_reason);
    }

    const delta = choice.delta;
    if (!delta) continue;

    if (delta.content) {
      const i = ensureTextBlock();
      const block = output.content[i] as any;
      block.text += delta.content;
      stream.push({ type: "text_delta", contentIndex: i, delta: delta.content, partial: output });
    }

    const reasoning = delta.reasoning_content || delta.reasoning || delta.reasoning_text;
    if (reasoning) {
      const i = ensureThinkingBlock();
      const block = output.content[i] as any;
      block.thinking += reasoning;
      stream.push({ type: "thinking_delta", contentIndex: i, delta: reasoning, partial: output });
    }

    if (delta.tool_calls?.length) {
      if (currentTextIndex !== null) {
        const b = output.content[currentTextIndex] as any;
        stream.push({ type: "text_end", contentIndex: currentTextIndex, content: b.text || "", partial: output });
        currentTextIndex = null;
      }
      if (currentThinkingIndex !== null) {
        const b = output.content[currentThinkingIndex] as any;
        stream.push({ type: "thinking_end", contentIndex: currentThinkingIndex, content: b.thinking || "", partial: output });
        currentThinkingIndex = null;
      }

      for (const tc of delta.tool_calls) {
        const tcIndex = tc.index ?? 0;
        let contentIndex = toolByIndex.get(tcIndex);
        if (contentIndex === undefined) {
          const block: ToolBlock = {
            type: "toolCall",
            id: tc.id || "",
            name: tc.function?.name || "",
            arguments: {},
            partialJson: "",
          };
          output.content.push(block as any);
          contentIndex = output.content.length - 1;
          toolByIndex.set(tcIndex, contentIndex);
          stream.push({ type: "toolcall_start", contentIndex, partial: output });
        }

        const block = output.content[contentIndex] as any as ToolBlock;
        if (tc.id) block.id = tc.id;
        if (tc.function?.name) block.name = tc.function.name;

        const argDelta = tc.function?.arguments || "";
        if (argDelta) {
          block.partialJson += argDelta;
          try {
            block.arguments = JSON.parse(block.partialJson);
          } catch {
            // partial JSON during stream
          }
        }

        stream.push({ type: "toolcall_delta", contentIndex, delta: argDelta, partial: output });
      }
    }
  }

  if (currentTextIndex !== null) {
    const b = output.content[currentTextIndex] as any;
    stream.push({ type: "text_end", contentIndex: currentTextIndex, content: b.text || "", partial: output });
  }
  if (currentThinkingIndex !== null) {
    const b = output.content[currentThinkingIndex] as any;
    stream.push({ type: "thinking_end", contentIndex: currentThinkingIndex, content: b.thinking || "", partial: output });
  }

  for (const contentIndex of toolByIndex.values()) {
    const block = output.content[contentIndex] as any;
    if (block.type === "toolCall") {
      try {
        block.arguments = JSON.parse(block.partialJson || "{}");
      } catch {
        // keep best-effort parsed args
      }
      delete block.partialJson;
      stream.push({ type: "toolcall_end", contentIndex, toolCall: block, partial: output });
    }
  }
}

function streamKiro(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };

    try {
      const { transformToCodeWhisperer, transformKiroStream } = await getOpencodeModules();
      const auth = await getAuthFromKiroCli();

      const requestBody: any = {
        model: MODEL_MAP[model.id] ? model.id : "claude-sonnet-4-5",
        stream: true,
        messages: convertMessages(context),
      };

      const tools = convertTools(context);
      if (tools?.length) requestBody.tools = tools;

      if (options?.reasoning && model.reasoning) {
        requestBody.providerOptions = {
          thinkingConfig: {
            thinkingBudget:
              (options as any)?.thinkingBudgets?.[options.reasoning as keyof (typeof options)["thinkingBudgets"]] ||
              defaultThinkingBudget(options.reasoning),
          },
        };
      }

      let activePrep = transformToCodeWhisperer(
        `https://q.${auth.region}.amazonaws.com/v1/chat/completions`,
        requestBody,
        requestBody.model,
        auth,
        !!options?.reasoning,
        requestBody.providerOptions?.thinkingConfig?.thinkingBudget,
      );

      let res = await fetch(activePrep.url, {
        ...activePrep.init,
        signal: options?.signal,
      });

      if (!res.ok) {
        const txt = await res.text();

        // Kiro occasionally rejects rich/tool-heavy payloads as "Improperly formed request".
        // Retry once with a minimal, sanitized payload.
        if (res.status === 400 && txt.includes("Improperly formed request")) {
          const fallbackBody: any = {
            model: requestBody.model,
            stream: true,
            messages: [{ role: "user", content: lastUserMessageText(context) }],
          };

          activePrep = transformToCodeWhisperer(
            `https://q.${auth.region}.amazonaws.com/v1/chat/completions`,
            fallbackBody,
            fallbackBody.model,
            auth,
            !!options?.reasoning,
            requestBody.providerOptions?.thinkingConfig?.thinkingBudget,
          );

          res = await fetch(activePrep.url, {
            ...activePrep.init,
            signal: options?.signal,
          });

          if (!res.ok) {
            const txt2 = await res.text();
            throw new Error(`Kiro request failed (${res.status}): ${txt2}`);
          }
        } else {
          throw new Error(`Kiro request failed (${res.status}): ${txt}`);
        }
      }

      stream.push({ type: "start", partial: output });

      const chunks = transformKiroStream(res, model.id, activePrep.conversationId) as AsyncGenerator<OpenAIChunk>;
      await parseOpenAIChunksIntoStream(chunks, model, stream, output);

      if (options?.signal?.aborted) {
        throw new Error("Request aborted");
      }

      stream.push({ type: "done", reason: output.stopReason as "stop" | "length" | "toolUse", message: output });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    }
  })();

  return stream;
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider("kiro", {
    baseUrl: "https://q.us-east-1.amazonaws.com",
    apiKey: "kiro",
    api: "kiro-opencode-bridge",
    models: MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: !!(m as any).reasoning,
      input: ["text", "image"] as ("text" | "image")[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 64000,
    })),
    streamSimple: streamKiro,
  });
}
