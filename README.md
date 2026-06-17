# Annoying AI Tendencies Detector

An open-source writing-feedback bot. A student or writer pastes a paragraph, and the bot reads it sentence by sentence and flags eleven stylistic tells that commonly signal AI-generated or AI-polished prose. Runs on **Cloudflare Workers** with a static frontend on **GitHub Pages**, embeds in Brightspace, and logs every query, response, and feedback rating to Qualtrics.

These are *tendencies, not proof of authorship* — a human can write any of them and a careful editor can remove them — so the tool flags patterns rather than declaring that text "was written by AI."

### The eleven tendencies flagged
Caveats / reflexive hedging · undue emphasis on significance, legacy, and broader trends · canned notability and media coverage · superficial analysis · promotional / advertisement-like language · vague attribution and overgeneralization · outline-like conclusions about challenges and the future · leads treating a broad title as a proper noun · avoidance of basic "is/are" phrasing · negative parallelisms · em-dash overuse.

## How it works

Three pieces, in two places:

- **Frontend** (`index.html`) — hosted on GitHub Pages. The user pastes a paragraph, clicks **Analyze**, and gets a colour-coded, sentence-by-sentence breakdown with per-category totals, a prose summary, and 👍 / 👎 feedback buttons.
- **Backend** (`worker.js`) — runs on Cloudflare Workers. Receives each request, fetches `criteria.md` from this GitHub repo at runtime, sends it plus the paragraph to the model, returns structured **JSON**, and logs to Qualtrics.
- **Content** (`criteria.md`) — lives in this repo. The worker fetches a fresh copy on every request (`cache: "no-store"`), so editing `criteria.md` and committing immediately updates what the bot detects. No redeploy needed.

**Where `worker.js` actually runs:** the running copy lives in Cloudflare, not in this repo. The copy here is your backup and template. The change that takes effect is the one you paste into Cloudflare's editor and **Deploy** — committing the same change to GitHub is just so you have a backup.

For `criteria.md` the opposite is true: editing it in GitHub *is* what changes behaviour, because that's where the worker reads it from at runtime.

### Two things specific to this bot

- **JSON, not plain text.** Unlike a simple Q&A bot, this worker returns a structured JSON object that the frontend renders into the highlighted breakdown. The Qualtrics log status is appended as an HTML comment after the JSON; the frontend strips comments before parsing, so it never interferes.
- **Provider auto-detect.** The worker picks its model provider from the environment variables you set — no code edit needed:
  - Set `OPENAI_API_KEY` → it calls OpenAI (`api.openai.com`).
  - Set `AZURE_OPENAI_KEY` instead → it calls your Azure OpenAI deployment (defaults already target the western resource / `gpt-4.1-mini`).
  - Set only one. If both are present, OpenAI wins.

## Setup

### 1. Get the files into your repo
Add `worker.js`, `index.html`, `criteria.md`, `brightspace.html`, and this `README.md` to your GitHub repo (or "Use this template" if starting fresh). Name it after the tool (e.g., `ai-tendencies-bot`).

### 2. Edit `criteria.md`
This file is the detection rubric (the system prompt). Edit it to change which tendencies are flagged or how they're described. Keep the JSON output structure intact, and make sure every `type` key it lists matches an entry in the `CATS` object near the top of the `<script>` in `index.html` — that one object drives the legend, highlight colours, tags, and totals.

### 3. Deploy the worker

Sign up free at https://dash.cloudflare.com — no credit card required.

1. Dashboard: **Compute (Workers)** → **Create** → **Start with Hello World!**
2. Name the worker (e.g., `aitendenciesbot`). The name becomes part of the URL: `<name>.<your-subdomain>.workers.dev`.
3. After it deploys, click **Edit code** (top right).
4. **Clear the editor first.** Click in the code area, Ctrl+A (Cmd+A on Mac), Delete. The editor must be completely empty before pasting — pasting over selected code can comment everything out and leave the worker stuck on Hello World.
5. Open `worker.js` from this repo, copy all of it, paste into the empty editor.
6. Click **Deploy** (top right, blue button).

To verify: visit `https://<your-name>.<your-subdomain>.workers.dev` in a browser. You should see **"Method Not Allowed"** — that's correct (the worker only accepts POST). If you see "Hello World!" the paste didn't take; redo from step 4.

### 4. Set environment variables

Worker page → **Settings** → **Variables and Secrets** → **+ Add** for each. Full reference in `env-vars-checklist.txt`.

| Name | Type | Required | Value |
|---|---|---|---|
| `CRITERIA_URL` | Text | yes | Raw GitHub URL of this repo's `criteria.md` |
| `OPENAI_API_KEY` | Secret | one provider | OpenAI key (`sk-...`) — **or** use Azure below |
| `OPENAI_MODEL` | Text | optional | Defaults to `gpt-4o-mini` |
| `AZURE_OPENAI_KEY` | Secret | one provider | Azure key — **or** use OpenAI above |
| `AZURE_ENDPOINT` | Text | optional | Defaults to `https://chatbot-api-western.openai.azure.com` |
| `AZURE_DEPLOYMENT_NAME` | Text | optional | Defaults to `gpt-4.1-mini` |
| `AZURE_API_VERSION` | Text | optional | Defaults to `2024-04-01-preview` |
| `QUALTRICS_API_TOKEN` | Secret | for logging | |
| `QUALTRICS_SURVEY_ID` | Text | for logging | starts with `SV_` |
| `QUALTRICS_DATACENTER` | Text | for logging | e.g., `uwo.eu` |
| `MAX_TOKENS` | Text | optional | Defaults to `2000` |

For `CRITERIA_URL`, the easiest way to get the right value: open `criteria.md` in your repo on GitHub, click the **Raw** button, copy the URL from the address bar. It looks like:
```
https://raw.githubusercontent.com/<username>/<repo>/main/criteria.md
```
Paste it into a browser tab to test — you should see your criteria text. A 404 means the username, repo, or branch is wrong. **`criteria.md` must be committed before the worker can fetch it** — this is the most common first-run problem.

**Why Secret vs Text:** Secret values are encrypted and hidden after saving (you can replace them but never view them again). Use Secret for anything sensitive — API keys and tokens.

### 5. Configure Qualtrics (for logging and feedback)

In your Qualtrics survey, add three embedded data fields with these exact names:
- `queryText`
- `responseText`
- `feedback`

Each analysis creates one Qualtrics row (with `feedback` empty). Each 👍/👎 click creates a second row with the same query/response and a `feedback` value of `helpful` or `not_helpful`. To find analyses students flagged as unhelpful, filter for `feedback = not_helpful`.

### 6. Point the frontend at your worker

Open `index.html`. Near the top of the `<script>` block:
```js
const WORKER_URL = "https://<your-worker-name>.<your-subdomain>.workers.dev/";
```
Change it to your worker URL. Commit.

### 7. Publish the frontend
- Repo → **Settings** → **Pages** → Branch: `main`, Folder: `/ (root)` → **Save**
- Wait 1–2 minutes for the first build, then visit the published URL (e.g., `https://<username>.github.io/<repo>/`)
- For Brightspace: edit `brightspace.html`, set the iframe `src` to your published GitHub Pages URL, and paste it as a content item or widget.

## Instructor guidance feature (db2025)

You can prepend a submission with a private instructor note using the `db2025` marker:
```
This paragraph leans hard on promotional language; be strict. db2025
```
Text before `db2025` is treated as the paragraph; text after it is passed to the model as a hidden instructor note that shapes the analysis but is not shown to the student.

## Day-to-day editing

| Change | What to do | Live immediately? |
|---|---|---|
| Edit which tendencies are flagged | Edit `criteria.md` in GitHub, commit | Yes, on next request |
| Add/rename/recolour a category | Edit `criteria.md` `type` keys **and** the `CATS` object in `index.html` | criteria: next request · frontend: after Pages rebuild |
| Switch provider or model | Set `OPENAI_API_KEY` / `AZURE_OPENAI_KEY` / `OPENAI_MODEL` in the dashboard | Yes |
| Rotate any API key | Edit the Secret in the dashboard | Yes |
| Change frontend appearance/text | Edit `index.html` on GitHub | After Pages rebuild (1–2 min) + hard refresh |
| Change prompt-wrapping or backend logic | Edit `worker.js` in Cloudflare's editor → **Deploy** | After Deploy click |

GitHub Pages and browser caching can both delay seeing `index.html` changes. After committing, give it 1–2 minutes, then hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) or open a private window.

## Notes

- **CORS** is handled by the worker, so iframe and cross-domain calls from Brightspace and GitHub Pages work without extra config.
- **Fetch caching is disabled** for criteria reads (`cache: "no-store"`), so edits appear immediately.
- **Per-bot isolation:** each bot is its own Cloudflare Worker with its own env vars. Keys can differ between bots, letting you track costs per course.
- **Token cap:** responses are limited by `MAX_TOKENS` (default 2000). Long paragraphs with many flags may need more; raise it in the dashboard.
- **Free tier:** Cloudflare Workers free tier is 100,000 requests/day, no credit card required.
- **Feedback clicks are free:** 👍/👎 submissions skip the model entirely, so they cost nothing beyond a negligible Qualtrics call.

## Files
- `index.html` — public interface: paste box, highlighted breakdown, totals, summary, feedback buttons
- `worker.js` — Cloudflare Workers backend (running copy lives in Cloudflare; this is the backup)
- `criteria.md` — the eleven-tendency detection rubric, fetched at runtime
- `brightspace.html` — LMS iframe wrapper
- `env-vars-checklist.txt` — quick setup reference for the Cloudflare variables
- `README.md` — this file

## License
© Dan Bousfield. Licensed under Creative Commons Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/
