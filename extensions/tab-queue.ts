/**
 * tab-queue — Codex-style message queueing for pi.
 *
 *   Enter while the agent runs   -> steer (pi default: delivered after the current tool calls)
 *   Tab   while the agent runs   -> queue (delivered only once the run stops, behind anything already queued)
 *   Tab   while the agent idles  -> pi's own Tab (path / slash-command completion)
 *
 * Tab reuses pi's native follow-up queue (`app.message.followUp`), so queued text
 * appears in pi's "queued messages" display, keeps FIFO order behind steering and
 * other follow-ups, survives Esc-to-restore, and can still be pulled back into the
 * editor with the dequeue keybinding (alt+up by default).
 *
 * `/tabqueue` toggles the behaviour off and back on for the current session, e.g.
 * when you want pi's file-path completion back while the agent runs.
 *
 * Install: ~/.pi/agent/extensions/tab-queue.ts   (project: .pi/extensions/tab-queue.ts)
 */

import { CustomEditor, type ExtensionAPI, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { visibleWidth, type EditorTheme, type TUI } from "@earendil-works/pi-tui";

/** Live "is the agent busy?" probe. Refreshed on every session_start. */
let isBusy: () => boolean = () => false;
/** `/tabqueue` toggle. */
let enabled = true;

const QUEUE_LABEL = " tab: queue · enter: steer ";

class QueueEditor extends CustomEditor {
	/** CustomEditor keeps its keybindings private, so hold our own reference. */
	private readonly keys: KeybindingsManager;

	constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) {
		super(tui, theme, keybindings);
		this.keys = keybindings;
	}

	/**
	 * Pi's own "queue follow-up" action, but only when Tab should queue instead of
	 * completing: the agent is working, the draft is non-empty, nothing is being
	 * autocompleted, and pi registered the action on the default editor.
	 */
	private queueHandler(): (() => void) | undefined {
		if (!enabled || !isBusy() || this.isShowingAutocomplete()) return undefined;
		if (this.getExpandedText().trim().length === 0) return undefined;
		return this.actionHandlers.get("app.message.followUp");
	}

	handleInput(data: string): void {
		if (this.keys.matches(data, "tui.input.tab")) {
			const queue = this.queueHandler();
			if (queue) {
				queue();
				return;
			}
		}
		super.handleInput(data); // app keybindings + normal editing and completion
	}

	/** Show what the two keys will do while the agent is working. */
	protected renderBottomBorder(width: number, hiddenLineCount: number): string {
		const base = super.renderBottomBorder(width, hiddenLineCount);
		if (!enabled || !isBusy() || hiddenLineCount > 0) return base; // keep the "↑ n more" indicator
		const label = visibleWidth(QUEUE_LABEL);
		if (width < label + 8) return base;
		const left = Math.floor((width - label) / 2);
		return this.borderColor(`${"─".repeat(left)}${QUEUE_LABEL}${"─".repeat(width - left - label)}`);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return; // no terminal editor in rpc/json/print modes
		const session = ctx;
		// isIdle() is live: false during a run, compaction, retry, or queued continuation.
		isBusy = () => {
			try {
				return !session.isIdle();
			} catch {
				return false; // context invalidated by reload or session replacement
			}
		};
		session.ui.setEditorComponent((tui, theme, keybindings) => new QueueEditor(tui, theme, keybindings));
	});

	pi.registerCommand("tabqueue", {
		description: "Toggle 'Tab queues a follow-up' for this session",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			ctx.ui.notify(`Tab queueing ${enabled ? "enabled" : "disabled"}`, "info");
		},
	});
}
