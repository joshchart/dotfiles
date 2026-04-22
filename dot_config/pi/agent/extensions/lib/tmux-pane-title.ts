import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export async function syncCurrentTmuxPaneTitle(pi: ExtensionAPI, sessionName: string): Promise<boolean> {
	const title = sessionName.trim();
	if (!title) return false;
	if (!process.env.TMUX || !process.env.TMUX_PANE) return false;

	const result = await pi.exec("tmux", ["select-pane", "-t", process.env.TMUX_PANE, "-T", title]);
	return result.code === 0;
}
