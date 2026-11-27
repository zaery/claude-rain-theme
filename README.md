# Rain — a Claude theme mod

A rainy-window theme for the Claude desktop and mobile apps.

- **Rain behind the chat.** Three layers of dense, soft rain fall at a slight slant behind the conversation, with fog drifting slowly and droplets beaded near the edges of the window.
- **Stormy colors that breathe.** The surfaces drift through slate, indigo and steel teal over about 48 seconds, while text colors stay fixed so everything stays readable. Works in light and dark mode.
- **Rain sounds (optional).** Press the speaker in the session's title bar for steady rain, drops ticking on the glass and the odd far-off thunder, plus soft cues when you send, when Claude finishes and when it needs you.

The terminal and editor extensions don't draw themes, so the look shows only in the apps.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install rain --marketplace zaery/claude-rain-theme
```

Answer `y` to add the marketplace, then pick a scope (user scope makes it apply to every session).

From a shell:

```
claude plugin install rain --marketplace zaery/claude-rain-theme
```

In the desktop app, where `/plugin` doesn't run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `zaery/claude-rain-theme`, then **Add plugin**.

This repository is private: installing it needs read access on GitHub and a git credential for github.com on your machine (an SSH key, or `gh auth login` then `gh auth setup-git`). The install never prompts for one.

## Tweaking it

Everything lives in `hooks/register.tsx`:

- `LAYERS` sets each rain layer's tile size, streak count, length and speed.
- The `<style>` block in `SCENE` sets rain color and opacity for light and dark mode.
- `STORM_LIGHT` / `STORM_DARK` are the tints the panels pulse between; `STEPS` and `TICK_MS` set the pace.
- `SOUND` holds the ambience and cues.
