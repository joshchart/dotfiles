import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { existsSync, promises as fs } from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

function shellQuote(value: string): string {
	if (value.length === 0) return "''";
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function getPiInvocationParts(): string[] {
	const currentScript = process.argv[1];
	if (currentScript && existsSync(currentScript)) {
		return [process.execPath, currentScript];
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return [process.execPath];
	}

	return ["pi"];
}

function buildPiStartupCommand(sessionFile: string | undefined, prompt: string): string {
	const commandParts = [...getPiInvocationParts()];

	if (sessionFile) {
		commandParts.push("--session", sessionFile);
	}

	if (prompt.length > 0) {
		commandParts.push("--", prompt);
	}

	return commandParts.map(shellQuote).join(" ");
}

function execFailureReason(result: { stdout?: string; stderr?: string }): string {
	return result.stderr?.trim() || result.stdout?.trim() || "unknown error";
}

async function openTmuxSplit(
	pi: ExtensionAPI,
	cwd: string,
	startupCommand: string,
): Promise<{ paneId: string } | { error: string }> {
	if (!process.env.TMUX) {
		return { error: "/split-fork requires running pi inside tmux." };
	}

	const splitResult = await pi.exec("tmux", ["split-window", "-h", "-c", cwd, "-P", "-F", "#{pane_id}"]);
	if (splitResult.code !== 0) {
		return { error: `Failed to create tmux split: ${execFailureReason(splitResult)}` };
	}

	const paneId = splitResult.stdout.trim();
	if (!paneId.startsWith("%")) {
		return { error: `Failed to create tmux split: unexpected pane id \"${paneId || "(empty)"}\"` };
	}

	await pi.exec("tmux", ["select-pane", "-t", paneId, "-T", "split-fork"]);

	const sendCommandResult = await pi.exec("tmux", ["send-keys", "-t", paneId, "-l", startupCommand]);
	if (sendCommandResult.code !== 0) {
		await pi.exec("tmux", ["kill-pane", "-t", paneId]);
		return { error: `Failed to start pi in tmux split: ${execFailureReason(sendCommandResult)}` };
	}

	const enterResult = await pi.exec("tmux", ["send-keys", "-t", paneId, "Enter"]);
	if (enterResult.code !== 0) {
		await pi.exec("tmux", ["kill-pane", "-t", paneId]);
		return { error: `Failed to execute pi in tmux split: ${execFailureReason(enterResult)}` };
	}

	return { paneId };
}

async function createForkedSession(ctx: ExtensionCommandContext): Promise<string | undefined> {
	const sessionFile = ctx.sessionManager.getSessionFile();
	if (!sessionFile) {
		return undefined;
	}

	const sessionDir = path.dirname(sessionFile);
	const branchEntries = ctx.sessionManager.getBranch();
	const currentHeader = ctx.sessionManager.getHeader();

	const timestamp = new Date().toISOString();
	const fileTimestamp = timestamp.replace(/[:.]/g, "-");
	const newSessionId = randomUUID();
	const newSessionFile = path.join(sessionDir, `${fileTimestamp}_${newSessionId}.jsonl`);

	const newHeader = {
		type: "session",
		version: currentHeader?.version ?? 3,
		id: newSessionId,
		timestamp,
		cwd: currentHeader?.cwd ?? ctx.cwd,
		parentSession: sessionFile,
	};

	const lines = [JSON.stringify(newHeader), ...branchEntries.map((entry) => JSON.stringify(entry))].join("\n") + "\n";

	await fs.mkdir(sessionDir, { recursive: true });
	await fs.writeFile(newSessionFile, lines, "utf8");

	return newSessionFile;
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand("split-fork", {
		description: "Fork this session into a new pi process in a right-hand tmux split. Usage: /split-fork [optional prompt]",
		handler: async (args, ctx) => {
			const wasBusy = !ctx.isIdle();
			const prompt = args.trim();
			const forkedSessionFile = await createForkedSession(ctx);
			const startupCommand = buildPiStartupCommand(forkedSessionFile, prompt);

			const result = await openTmuxSplit(pi, ctx.cwd, startupCommand);
			if ("error" in result) {
				ctx.ui.notify(result.error, "error");
				if (forkedSessionFile) {
					ctx.ui.notify(`Forked session was created: ${forkedSessionFile}`, "info");
				}
				return;
			}

			if (forkedSessionFile) {
				const fileName = path.basename(forkedSessionFile);
				const suffix = prompt ? " and sent prompt" : "";
				ctx.ui.notify(`Forked to ${fileName} in tmux pane ${result.paneId}${suffix}.`, "info");
				if (wasBusy) {
					ctx.ui.notify("Forked from current committed state (in-flight turn continues in original session).", "info");
				}
			} else {
				ctx.ui.notify(`Opened a new tmux split in pane ${result.paneId} (no persisted session to fork).`, "warning");
			}
		},
	});
}
