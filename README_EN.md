# MarkFlow

[中文](./README.md) | **English**

> A web text highlighter with precise jump-back, with optional GitHub Gist sync across devices.

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange)](https://addons.mozilla.org/firefox/addon/markflow/) [![GitHub License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE) ![Local First](https://img.shields.io/badge/Storage-Local--First-blue) ![Sync](https://img.shields.io/badge/Sync-GitHub%20Gist-purple) ![Privacy](https://img.shields.io/badge/Privacy-No--Login-green)

---

## What can it do?

### Precise Jump-Back

Hold `Alt` and select text on any webpage to mark it. Click a note in the sidebar to jump back to the exact spot instantly.

### Structured Organization

Marks are automatically grouped by section. Add tags to build a knowledge graph across pages.

### Adaptive Recovery

Page structure drifted or containers reused? The system attempts automatic repair. If the content has been substantially changed or the layout rebuilt, the sidebar preserves the context for your confirmation.

### Multi-Device Sync (Optional)

Sync your marks across devices via GitHub Gist.

<video src="https://raw.githubusercontent.com/catx1726/Highlight-Mark-Flow/main/assets/markflow-promo.en.webm" autoplay muted loop playsinline></video>

---

## Quick Start

1. **Install the extension** — [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/markflow/) (Chrome coming soon)
2. **Open any webpage**, hold `Alt` and select text
3. **Click a mark in the sidebar** to jump back to the original passage instantly
4. **(Optional) Multi-device sync** — configure a GitHub Token in the settings page, connect and enable sync

---

## FAQ

**Q: Will highlights be lost on dynamic pages (e.g. Reddit)?**
A: For common scenarios like structure drift or container reuse, the system attempts automatic recovery. If the page content has been substantially changed or the layout rebuilt, automatic recovery may not be possible — in that case the sidebar preserves the context for your confirmation.

**Q: Where is my data stored?**
A: 100% local by default. No sign-up, no data collection. GitHub Gist sync is optional.

**Q: Can I export my notes?**
A: One-click Markdown export, ready to paste into Obsidian/Notion.

**Q: Why does a recovery confirmation dialog occasionally appear?**
A: When large portions of a page are removed or the layout is rebuilt, automatic recovery may fail. The sidebar keeps the context so you can decide whether to re-mark.

**Q: Is multi-device sync secure?**
A: Sync runs on GitHub Gist. The extension only requests the `gist` scope and cannot access your repositories. The token is stored in the extension's private storage.

---

MIT License

> _Every mark, precisely traceable._
