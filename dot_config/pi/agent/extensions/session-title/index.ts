import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { syncSessionWindowTitle } from "../lib/tmux-pane-title";

async function syncTmuxPaneTitle(pi: ExtensionAPI, ctx: ExtensionContext): Promise<boolean> {
	if (!ctx.hasUI) return false;

	const sessionName = pi.getSessionName()?.trim();
	if (!sessionName) return false;

	return await syncSessionWindowTitle(pi, ctx, sessionName);
}

export default function (pi: ExtensionAPI) {
	let synced = false;
	let checkedAfterFirstTurn = false;

	async function maybeSync(ctx: ExtensionContext) {
		if (synced) return;
		synced = await syncTmuxPaneTitle(pi, ctx);
	}

	pi.on("session_start", async (_e, ctx) => {
		await maybeSync(ctx);
	});

	pi.on("agent_end", async (_e, ctx) => {
		if (checkedAfterFirstTurn) return;
		checkedAfterFirstTurn = true;
		await maybeSync(ctx);
	});
}
