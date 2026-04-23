import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type RawState = "working" | "blocked" | "idle" | "unknown";
type InputSource = "interactive" | "rpc" | "extension";

const AGENT_OPTION = "@pi_agent";
const STATE_OPTION = "@pi_agent_state";
const COMPLETION_OPTION = "@pi_agent_completion_id";
const SEEN_COMPLETION_OPTION = "@pi_agent_seen_completion_id";
const LAST_UPDATE_OPTION = "@pi_agent_last_update";

const INPUT_ASSOCIATION_WINDOW_MS = 5_000;

const BLOCKED_PATTERNS = [
	/\bdo you want me\b/i,
	/\bwould you like me\b/i,
	/\bshould i\b/i,
	/\bcan i\b/i,
	/\bwhat would you like\b/i,
	/\bhow would you like\b/i,
	/\bwhich (?:one|option|approach|path|version)\b/i,
	/\bplease (?:provide|confirm|approve|share|pick|choose|select|send)\b/i,
	/\b(?:approval|input) (?:is )?required\b/i,
	/\bwaiting for (?:input|approval|confirmation)\b/i,
	/\blet me know\b/i,
];

function getCurrentPaneId(): string | null {
	const paneId = process.env.TMUX_PANE?.trim();
	return paneId ? paneId : null;
}

async function runTmux(pi: ExtensionAPI, args: string[]): Promise<string> {
	const result = await pi.exec("tmux", args);
	if (result.code !== 0) {
		return "";
	}
	return result.stdout ?? "";
}

async function getPaneOption(pi: ExtensionAPI, paneId: string, option: string): Promise<string> {
	return (await runTmux(pi, ["show-options", "-p", "-v", "-t", paneId, option])).trim();
}

async function setPaneOption(pi: ExtensionAPI, paneId: string, option: string, value: string): Promise<void> {
	await runTmux(pi, ["set-option", "-p", "-t", paneId, option, value]);
}

async function unsetPaneOption(pi: ExtensionAPI, paneId: string, option: string): Promise<void> {
	await runTmux(pi, ["set-option", "-p", "-u", "-t", paneId, option]);
}

async function getVisiblePaneIds(pi: ExtensionAPI): Promise<Set<string>> {
	const stdout = await runTmux(pi, ["list-clients", "-F", "#{pane_id}"]);
	return new Set(
		stdout
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean),
	);
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

function isAssistantMessage(message: unknown): message is { role: "assistant"; content?: unknown } {
	return !!message && typeof message === "object" && "role" in message && message.role === "assistant";
}

function getLastAssistantText(messages: Iterable<unknown>): string {
	const lastAssistant = [...messages].reverse().find(isAssistantMessage);
	if (!lastAssistant) {
		return "";
	}
	return getTextContent(lastAssistant.content)
		.replace(/\s+/g, " ")
		.trim();
}

function looksBlocked(text: string): boolean {
	if (!text) {
		return false;
	}

	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) {
		return false;
	}

	const tail = normalized.slice(-500);
	if (/\?\s*$/.test(tail)) {
		return true;
	}

	return BLOCKED_PATTERNS.some((pattern) => pattern.test(tail));
}

function classifyRawState(messages: Iterable<unknown>): RawState {
	const lastAssistantText = getLastAssistantText(messages);
	if (!lastAssistantText) {
		return "idle";
	}
	return looksBlocked(lastAssistantText) ? "blocked" : "idle";
}

function isUserInitiatedInput(source: InputSource | null): boolean {
	return source === "interactive" || source === "rpc";
}

async function initializeCurrentPaneState(pi: ExtensionAPI): Promise<void> {
	const paneId = getCurrentPaneId();
	if (!paneId || !process.env.TMUX) {
		return;
	}

	await setPaneOption(pi, paneId, AGENT_OPTION, "1");

	const existingState = await getPaneOption(pi, paneId, STATE_OPTION);
	if (existingState === "working" || existingState === "blocked" || existingState === "idle" || existingState === "unknown") {
		return;
	}

	await setPaneOption(pi, paneId, STATE_OPTION, "idle");
	await setPaneOption(pi, paneId, LAST_UPDATE_OPTION, String(Date.now()));
}

async function updatePaneState(pi: ExtensionAPI, rawState: RawState, recordCompletion: boolean): Promise<void> {
	const paneId = getCurrentPaneId();
	if (!paneId || !process.env.TMUX) {
		return;
	}

	await setPaneOption(pi, paneId, AGENT_OPTION, "1");
	await setPaneOption(pi, paneId, STATE_OPTION, rawState);
	await setPaneOption(pi, paneId, LAST_UPDATE_OPTION, String(Date.now()));

	if (!recordCompletion || rawState !== "idle") {
		return;
	}

	const completionId = String(Date.now());
	await setPaneOption(pi, paneId, COMPLETION_OPTION, completionId);

	const visiblePaneIds = await getVisiblePaneIds(pi);
	if (visiblePaneIds.has(paneId)) {
		await setPaneOption(pi, paneId, SEEN_COMPLETION_OPTION, completionId);
	}
}

async function clearCurrentPaneState(pi: ExtensionAPI): Promise<void> {
	const paneId = getCurrentPaneId();
	if (!paneId || !process.env.TMUX) {
		return;
	}

	for (const option of [AGENT_OPTION, STATE_OPTION, COMPLETION_OPTION, SEEN_COMPLETION_OPTION, LAST_UPDATE_OPTION]) {
		await unsetPaneOption(pi, paneId, option);
	}
}

export default function (pi: ExtensionAPI) {
	let pendingInputSource: InputSource | null = null;
	let pendingInputAt = 0;
	let activeRunHasUserInput = false;

	void initializeCurrentPaneState(pi);

	pi.on("session_start", async (_event, _ctx) => {
		pendingInputSource = null;
		pendingInputAt = 0;
		activeRunHasUserInput = false;
		await updatePaneState(pi, "idle", false);
	});

	pi.on("input", async (event, _ctx) => {
		pendingInputSource = event.source;
		pendingInputAt = Date.now();
	});

	pi.on("agent_start", async (_event, _ctx) => {
		activeRunHasUserInput =
			isUserInitiatedInput(pendingInputSource) && Date.now() - pendingInputAt <= INPUT_ASSOCIATION_WINDOW_MS;
		pendingInputSource = null;
		pendingInputAt = 0;
		await updatePaneState(pi, "working", false);
	});

	pi.on("agent_end", async (event, _ctx) => {
		const rawState = classifyRawState(event.messages);
		const shouldRecordCompletion = activeRunHasUserInput && rawState === "idle";
		activeRunHasUserInput = false;
		await updatePaneState(pi, rawState, shouldRecordCompletion);
	});

	pi.on("session_shutdown", async (_event, _ctx) => {
		pendingInputSource = null;
		pendingInputAt = 0;
		activeRunHasUserInput = false;
		await clearCurrentPaneState(pi);
	});
}
