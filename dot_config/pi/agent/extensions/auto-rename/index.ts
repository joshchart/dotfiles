/**
 * Auto Session Name Extension
 *
 * Names the session once, after the first completed agent run.
 * It summarizes the first user message into a compact ChatGPT-style title.
 * If model-based generation is unavailable, it falls back to a short keyword title.
 */
import { complete, type Api, type Model, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { syncCurrentTmuxPaneTitle } from "../lib/tmux-pane-title";

const CODEX_MODEL_ID = "gpt-5.1-codex-mini";
const HAIKU_MODEL_ID = "claude-haiku-4-5";
const MAX_TITLE_LENGTH = 40;
const MAX_SOURCE_TEXT_CHARS = 1200;
const MAX_FALLBACK_WORDS = 4;

const TITLE_SYSTEM_PROMPT = `You generate ultra-short conversation titles like ChatGPT.

Return only the title text.

Rules:
- Summarize the user's first message.
- Prefer 2 to 4 words.
- Use a compact noun phrase, not a sentence.
- Drop filler words and hedging.
- No quotes.
- No markdown.
- No trailing punctuation.
- Keep it under 40 characters.
- Make it specific and natural.`;

const LEADING_FILLER_PATTERNS = [
	/^(?:please\s+)+/i,
	/^(?:can|could|would|will)\s+you\s+/i,
	/^help\s+me\s+(?:with\s+)?/i,
	/^i\s+(?:need|want|would\s+like)\s+to\s+/i,
	/^i['’]m\s+trying\s+to\s+/i,
	/^this\s+is\s+/i,
];

const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"at",
	"by",
	"for",
	"from",
	"help",
	"how",
	"i",
	"if",
	"in",
	"into",
	"is",
	"it",
	"me",
	"my",
	"of",
	"on",
	"or",
	"please",
	"so",
	"that",
	"the",
	"this",
	"to",
	"we",
	"with",
	"you",
]);

function hasUsableAuth(auth: Awaited<ReturnType<ModelRegistry["getApiKeyAndHeaders"]>>): boolean {
	return auth.ok && (!!auth.apiKey || Object.keys(auth.headers ?? {}).length > 0);
}

async function selectTitleModel(
	currentModel: Model<Api> | undefined,
	modelRegistry: ModelRegistry,
): Promise<Model<Api> | undefined> {
	const codexModel = modelRegistry.find("openai-codex", CODEX_MODEL_ID);
	if (codexModel) {
		const auth = await modelRegistry.getApiKeyAndHeaders(codexModel);
		if (hasUsableAuth(auth)) {
			return codexModel;
		}
	}

	const haikuModel = modelRegistry.find("anthropic", HAIKU_MODEL_ID);
	if (haikuModel) {
		const auth = await modelRegistry.getApiKeyAndHeaders(haikuModel);
		if (hasUsableAuth(auth)) {
			return haikuModel;
		}
	}

	if (!currentModel) {
		return undefined;
	}

	const auth = await modelRegistry.getApiKeyAndHeaders(currentModel);
	return hasUsableAuth(auth) ? currentModel : undefined;
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

function trimSourceText(text: string, maxChars: number): string {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxChars) {
		return normalized;
	}

	const cutoff = normalized.lastIndexOf(" ", maxChars - 1);
	const end = cutoff > Math.floor(maxChars * 0.6) ? cutoff : maxChars - 1;
	return `${normalized.slice(0, end).trim()}…`;
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

function sanitizeTitle(text: string): string {
	let title = text.trim();
	if (!title) {
		return "";
	}

	title = title.replace(/^\s*title\s*:\s*/i, "");
	title = title.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
	title = title.replace(/^[-*]\s*/, "");
	title = title.replace(/^['"`]+|['"`]+$/g, "");
	title = title.replace(/\s+/g, " ").trim();
	title = title.replace(/[.!?,;:]+$/g, "").trim();

	if (title.length > MAX_TITLE_LENGTH) {
		title = title.slice(0, MAX_TITLE_LENGTH).trim();
	}

	return title;
}

function stripLeadingFiller(text: string): string {
	let result = text.trim();
	let changed = true;

	while (changed) {
		changed = false;
		for (const pattern of LEADING_FILLER_PATTERNS) {
			const next = result.replace(pattern, "").trim();
			if (next !== result) {
				result = next;
				changed = true;
			}
		}
	}

	return result;
}

function titleCaseToken(token: string): string {
	return token
		.split("-")
		.map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
		.join("-");
}

function fallbackTitleFromPrompt(promptText: string): string | null {
	const sourceText = trimSourceText(promptText, MAX_SOURCE_TEXT_CHARS);
	const stripped = stripLeadingFiller(sourceText).replace(/[^\p{L}\p{N}\s-]+/gu, " ");
	const allWords = stripped.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) ?? [];
	const informativeWords = allWords.filter((word) => !STOP_WORDS.has(word.toLowerCase()));
	const selectedWords = (informativeWords.length > 0 ? informativeWords : allWords).slice(0, MAX_FALLBACK_WORDS);

	if (selectedWords.length > 0) {
		return sanitizeTitle(selectedWords.map(titleCaseToken).join(" "));
	}

	const firstClause = sourceText
		.split(/[\n.!?;:]+/)
		.map((part) => part.trim())
		.find(Boolean);
	return firstClause ? sanitizeTitle(firstClause) : null;
}

async function generateSessionTitle(ctx: ExtensionContext): Promise<string | null> {
	const firstUserMessage = getFirstUserMessageText(ctx);
	if (!firstUserMessage) {
		return null;
	}

	const sourceText = trimSourceText(firstUserMessage, MAX_SOURCE_TEXT_CHARS);
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
		content: [{ type: "text", text: `First user message:\n${sourceText}` }],
		timestamp: Date.now(),
	};

	const response = await complete(
		model,
		{ systemPrompt: TITLE_SYSTEM_PROMPT, messages: [userMessage] },
		{ apiKey: auth.apiKey, headers: auth.headers, signal: ctx.signal },
	);

	if (response.stopReason === "aborted") {
		return null;
	}

	const responseText = response.content
		.filter((block): block is { type: "text"; text: string } => block.type === "text")
		.map((block) => block.text)
		.join("\n");

	const title = sanitizeTitle(responseText);
	return title || null;
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async (_event, ctx) => {
		if (pi.getSessionName()) {
			return;
		}

		if (countUserMessages(ctx) !== 1) {
			return;
		}

		let title: string | null = null;
		try {
			title = await generateSessionTitle(ctx);
		} catch {
			// Fall back to heuristic naming below.
		}

		const firstUserMessage = getFirstUserMessageText(ctx);
		const nextTitle = title ?? (firstUserMessage ? fallbackTitleFromPrompt(firstUserMessage) : null);
		if (!nextTitle) {
			return;
		}

		pi.setSessionName(nextTitle);
		await syncCurrentTmuxPaneTitle(pi, nextTitle);
	});
}
