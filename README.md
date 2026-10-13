# pi-tab-queue

Codex-style message queueing for [pi](https://github.com/earendil-works/pi). While the agent is working, **Enter steers** and **Tab queues** — two different things, which is the whole point.

| Key | Agent is running | Agent is idle |
|---|---|---|
| `Enter` | Steer: delivered after the current tool calls | Send |
| `Tab` | Queue: delivered only once the run stops | pi's own Tab — path and slash-command completion |

Steering interrupts the agent's train of thought. Most of what you type mid-run is not a correction, it is a note for later — "also add a test for that", "the changelog is in docs/". Tab keeps the note out of the model's way until it surfaces naturally.

## Install

```bash
pi install git:github.com/bradleydwyer/pi-tab-queue
```

Single run, no install:

```bash
pi -e git:github.com/bradleydwyer/pi-tab-queue
```

Or drop the file where pi discovers it:

```bash
mkdir -p ~/.pi/agent/extensions
curl -fLo ~/.pi/agent/extensions/tab-queue.ts \
  https://raw.githubusercontent.com/bradleydwyer/pi-tab-queue/main/extensions/tab-queue.ts
```

Reload a running session with `/reload`.

## Usage

Nothing to configure. While the agent runs, the editor border shows ` tab: queue · enter: steer ` so the keys are discoverable the first time without reading this file.

`/tabqueue` toggles the behaviour for the current session — handier than you'd expect when you want Tab back for path completion mid-run.

Queued drafts dequeue with pi's own keybinding (`alt+up` by default), so a queued note can be pulled back into the editor and edited before it is ever delivered.

## How it works

It subclasses pi's editor rather than adding a second queue.

```ts
private queueHandler(): (() => void) | undefined {
  if (!enabled || !isBusy() || this.isShowingAutocomplete()) return undefined;
  if (this.getExpandedText().trim().length === 0) return undefined;
  return this.actionHandlers.get("app.message.followUp"); // pi's native queue
}

handleInput(data: string): void {
  if (this.keys.matches(data, "tui.input.tab")) {
    const queue = this.queueHandler();
    if (queue) {
      queue();
      return;
    }
  }
  super.handleInput(data); // keybindings, editing, completion
}
```

Because it reuses pi's `app.message.followUp` action, everything the native queue already does keeps working: queued items appear in pi's queued-messages display, stay FIFO behind steering and other follow-ups, survive Esc-to-restore, and dequeue with `alt+up`. Tab falls through to pi's completion whenever the agent is idle, the draft is empty, or an autocomplete popup is open.

`isBusy()` reads the live `ctx.isIdle()` probe, refreshed on every `session_start`, so it is also true during compaction, auto-retry, and queued continuation — the moments when steering would be most disruptive.

## Notes

- TUI mode only. RPC, JSON, and print modes have no terminal editor, so the extension registers nothing there.
- pi holds one editor factory per session, set from `session_start` with `ctx.ui.setEditorComponent()`. If another extension also replaces the editor, whichever loaded last wins — run `/tabqueue` to disable this one rather than debugging a silent editor swap.

## License

MIT
