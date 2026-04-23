/**
 * Auto Session Name Extension
 *
 * Names the session once, after the first completed agent run.
 * The title generation logic is intentionally kept close to Claude's shared
 * session-title utility: pass in a trimmed description, ask for a structured
 * JSON title, parse it, and return null on failure.
 */
import { complete, type Api, type Model, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { syncSessionWindowTitle } from "../lib/tmux-pane-title";

const CODEX_MODEL_ID = "gpt-5.1-codex-mini";
const HAIKU_MODEL_ID = "claude-haiku-4-5";
const MAX_DESCRIPTION_TEXT = 1000;

const SESSION_TITLE_PROMPT = `Generate a concise, sentence-case title (3-7 words) that captures the main topic or goal of this coding session. The title should be clear enough that the user recognizes the session in a list. Use sentence case: capitalize only the first word and proper nouns.

Return JSON with a single "title" field.

Good examples:
{"title": "Fix login button on mobile"}
{"title": "Add OAuth authentication"}
{"title": "Debug failing CI tests"}
{"title": "Refactor API client error handling"}

Bad (too vague): {"title": "Code changes"}
Bad (too long): {"title": "Investigate and fix the issue where the login button does not respond on mobile devices"}
Bad (wrong case): {"title": "Fix Login Button On Mobile"}`;

const TITLE_JSON_SCHEMA = {
	type: "object",
	properties: {
		title: { type: "string" },
	},
	required: ["title"],
	additionalProperties: false,
} as const;

function hasUsableAuth(
	auth: Awaited<ReturnType<ModelRegistry["getApiKeyAndHeaders"]>>,
): auth is Extract<Awaited<ReturnType<ModelRegistry["getApiKeyAndHeaders"]>>, { ok: true }> {
	return auth.ok && (!!auth.apiKey || Object.keys(auth.headers ?? {}).length > 0);
}

async function selectTitleModel(
	currentModel: Model<Api> | undefined,
	modelRegistry: ModelRegistry,
): Promise<Model<Api> | undefined> {
	if (currentModel) {
		const auth = await modelRegistry.getApiKeyAndHeaders(currentModel);
		if (hasUsableAuth(auth)) {
			return currentModel;
		}
	}

	const haikuModel = modelRegistry.find("anthropic", HAIKU_MODEL_ID);
	if (haikuModel) {
		const auth = await modelRegistry.getApiKeyAndHeaders(haikuModel);
		if (hasUsableAuth(auth)) {
			return haikuModel;
		}
	}

	const codexModel = modelRegistry.find("openai-codex", CODEX_MODEL_ID);
	if (codexModel) {
		const auth = await modelRegistry.getApiKeyAndHeaders(codexModel);
		if (hasUsableAuth(auth)) {
			return codexModel;
		}
	}

	return undefined;
}

function getTextContent(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}
	if (!Array.isArray(content)) {
		return "";
	}

	return content
		.filter((block): block is { type?: unknown; text?: unknown } => !!block && typeof block === "object")
		.filter((block) => block.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("\n");
}

function trimDescription(description: string): string {
	const normalized = description.replace(/\s+/g, " ").trim();
	if (normalized.length <= MAX_DESCRIPTION_TEXT) {
		return normalized;
	}

	return normalized.slice(-MAX_DESCRIPTION_TEXT);
}

function countUserMessages(ctx: ExtensionContext): number {
	let count = 0;

	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message") {
			continue;
		}

		const message = entry.message;
		if ("role" in message && message.role === "user") {
			count++;
		}
	}

	return count;
}

function getFirstUserMessageText(ctx: ExtensionContext): string | null {
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message") {
			continue;
		}

		const message = entry.message;
		if (!("role" in message) || message.role !== "user") {
			continue;
		}

		const text = getTextContent((message as { content?: unknown }).content)
			.replace(/\s+/g, " ")
			.trim();
		if (text) {
			return text;
		}
	}

	return null;
}

function buildStructuredOutputPayload(payload: unknown, model: Model<Api>): unknown {
	if (!payload || typeof payload !== "object") {
		return payload;
	}

	if (model.api === "openai-responses" || model.api === "openai-codex-responses" || model.api === "azure-openai-responses") {
		const body = payload as Record<string, unknown>;
		const text = body.text && typeof body.text === "object" ? (body.text as Record<string, unknown>) : {};
		return {
			...body,
			text: {
				...text,
				format: {
					type: "json_schema",
					name: "session_title",
					schema: TITLE_JSON_SCHEMA,
					strict: true,
				},
			},
		};
	}

	if (model.api === "anthropic-messages") {
		const params = payload as Record<string, unknown>;
		const outputConfig = params.output_config && typeof params.output_config === "object"
			? (params.output_config as Record<string, unknown>)
			: {};
		return {
			...params,
			output_config: {
				...outputConfig,
				format: {
					type: "json_schema",
					name: "session_title",
					schema: TITLE_JSON_SCHEMA,
				},
			},
		};
	}

	return payload;
}

function parseTitleResponse(text: string): string | null {
	const normalized = text.trim();
	if (!normalized) {
		return null;
	}

	const candidates = [
		normalized,
		normalized.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(),
	];

	const objectMatch = normalized.match(/\{[\s\S]*\}/);
	if (objectMatch) {
		candidates.push(objectMatch[0]);
	}

	for (const candidate of candidates) {
		try {
			const parsed = JSON.parse(candidate) as { title?: unknown };
			if (typeof parsed.title === "string") {
				const title = parsed.title.trim();
				return title || null;
			}
		} catch {
			// Ignore parse failures and continue trying the next structured candidate.
		}
	}

	return null;
}

async function generateSessionTitle(
	description: string,
	ctx: ExtensionContext,
): Promise<string | null> {
	const trimmed = trimDescription(description);
	if (!trimmed) {
		return null;
	}

	try {
		const model = await selectTitleModel(ctx.model, ctx.modelRegistry);
		if (!model) {
			return null;
		}

		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!hasUsableAuth(auth)) {
			return null;
		}

		const userMessage: UserMessage = {
			role: "user",
			content: [{ type: "text", text: trimmed }],
			timestamp: Date.now(),
		};

		const response = await complete(
			model,
			{ systemPrompt: SESSION_TITLE_PROMPT, messages: [userMessage] },
			{
				apiKey: auth.apiKey,
				headers: auth.headers,
				signal: ctx.signal,
				onPayload: async (payload) => buildStructuredOutputPayload(payload, model),
			},
		);

		if (response.stopReason === "aborted") {
			return null;
		}

		const text = response.content
			.filter((block): block is { type: "text"; text: string } => block.type === "text")
			.map((block) => block.text)
			.join("\n");

		if (response.stopReason === "error") {
			return null;
		}

		const title = parseTitleResponse(text);
		return title;
	} catch {
		return null;
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async (_event, ctx) => {
		if (pi.getSessionName()) {
			return;
		}

		const userMessageCount = countUserMessages(ctx);
		if (userMessageCount !== 1) {
			return;
		}

		const firstUserMessage = getFirstUserMessageText(ctx);
		if (!firstUserMessage) {
			return;
		}

		const title = await generateSessionTitle(firstUserMessage, ctx);
		if (!title) {
			return;
		}

		pi.setSessionName(title);
		await syncSessionWindowTitle(pi, ctx, title);
	});
}
