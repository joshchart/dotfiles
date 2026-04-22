import path from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

export function formatSessionWindowTitle(sessionName: string, cwd: string): string {
	const title = sessionName.trim();
	const cwdBasename = path.basename(cwd);
	return title ? `π - ${title} - ${cwdBasename}` : `π - ${cwdBasename}`;
}

export async function syncCurrentTmuxPaneTitle(
	pi: ExtensionAPI,
	sessionName: string,
	cwd = process.cwd(),
): Promise<boolean> {
	const title = sessionName.trim();
	if (!title) return false;
	if (!process.env.TMUX || !process.env.TMUX_PANE) return false;

	const result = await pi.exec("tmux", ["select-pane", "-t", process.env.TMUX_PANE, "-T", formatSessionWindowTitle(title, cwd)]);
	return result.code === 0;
}

export async function syncSessionWindowTitle(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	sessionName: string,
): Promise<boolean> {
	const title = sessionName.trim();
	if (!title) return false;

	let updated = false;
	if (ctx.hasUI) {
		ctx.ui.setTitle(formatSessionWindowTitle(title, ctx.cwd));
		updated = true;
	}

	const tmuxUpdated = await syncCurrentTmuxPaneTitle(pi, title, ctx.cwd);
	return updated || tmuxUpdated;
}
