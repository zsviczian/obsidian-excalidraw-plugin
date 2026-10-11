---
name: obsidian-excalidraw-cli
description: Create, inspect, edit and render Obsidian Excalidraw drawings through the running app's native CLI.
---

Use a local terminal with Obsidian running and CLI enabled (API 1.12.2+).
Always put vault="<name or ID>" before the command. Native root: obsidian-excalidraw-plugin.
Start with obsidian vault="<vault>" obsidian-excalidraw-plugin:help, then :schema action=create.
All results use apiVersion 1. Check ok, mutation and persistence; process exit zero alone does not prove success.
Put large requests in a visible vault-relative JSON file and pass input="<file>". Inline json is for small requests.
Requests in files include apiVersion:1; the native command supplies command. The in-process ea.executeCLI request also includes command.
Use exact drawing paths including extensions. Never assume an active drawing. :open explicitly creates a tab and can run configured drawing scripts.
Loop: :read source=live detail=elements → :apply with expectedRevision and a unique requestId → check persistence=saved → :export → inspect the image file.
For duplicate views use the view ID from :open or :read. Refresh after STALE_REVISION; retry BUSY only after read-back.
New skeleton IDs are local labels; use returned idMap actual IDs for updates. Updates reject identity, bindings and asset internals.
Every write requires requestId. Repeat the identical effective request to retrieve its receipt; different content with the same ID fails.
:result requestId=<id> recovers a receipt after lost stdout. Receipts expire after 15 minutes/reload; unknown outcome requires read-back before another write.
:api surface=ea name=<method> gives existing EA signatures. :api surface=lib lists the supported installed Lib reference; advanced exports remain available to scripts.
:script requires trusted=true and an explicit existing local script file. utils.input contains args; utils.excalidrawLib is the installed runtime. Await all work; completion does not imply saved drawing.
One-shot EA is cleaned up; utility prompts fail INTERACTION_REQUIRED. Trusted code can still invoke other interactive APIs: this is not a sandbox, timeout cancellation or transaction.
Export names an explicit out=.svg/.png; overwrite=true is required for existing outputs. Live exports never implicitly save. Remote assets follow existing permissions.
Use :schema for exact fields, operation limits, and runnable examples. Do not edit compressed drawing Markdown directly or install another Excalidraw CLI.
