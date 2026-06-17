# Annoying AI Tendencies Detector

A writing-feedback bot that reads a submitted paragraph sentence by sentence and flags the stylistic tells that commonly signal AI-generated or AI-polished prose. The detection rubric lives in `criteria.md`. These are *tendencies, not proof of authorship* — a human can write any of them, and a careful editor can remove them — so the tool flags patterns rather than declaring that text "was written by AI."

## What It Does

* Accepts paragraph submissions via a web form
* Uses Azure OpenAI (GPT-4.1-mini) to analyze the paragraph sentence by sentence
* Applies the eleven "annoying AI tendency" criteria defined in `criteria.md`
* Returns a structured, highlighted, sentence-by-sentence breakdown with per-category totals and a prose summary
* Optionally logs each query and response to Qualtrics if configured

### The eleven tendencies flagged

1. Caveats / reflexive hedging
2. Undue emphasis on significance, legacy, and broader trends
3. Canned emphasis on notability, attribution, and media coverage
4. Superficial analysis
5. Promotional / advertisement-like language
6. Vague attribution and overgeneralization
7. Outline-like conclusions about challenges and future prospects
8. Leads treating a broad title as a proper noun
9. Avoidance of basic "is/are" phrases
10. Negative parallelisms
11. Overuse of em dashes

To add, rename, or remove a category, edit the `type` keys in `criteria.md` and the matching `CATS` config object near the top of the `<script>` in `index.html` — the legend, highlight colours, tags, and totals all generate from that one object.

## Instructor Guidance Feature

You can prepend any submission with instructor input using this format:

```
dsb2025 - This paragraph fails to address the question logically and gives no specific examples.

In wartime, international law...
```

This instruction is not shown in the feedback but influences how the bot interprets the paragraph.

## Setup Instructions

### 1. Fork the Repository

Create a copy using GitHub's "Use this template" function.

### 2. Replace the Detection Criteria

Edit `criteria.md` to change which writing tendencies are flagged (this is the file the backend actually loads). Keep the JSON output structure intact and make sure each `type` key matches an entry in the `CATS` object in `index.html`.

### 3. Deploy the API Backend on Deno

* Go to [https://dash.deno.com](https://dash.deno.com)
* Create a new project and set `main.ts` as the entry point
* Configure environment variables:

```
AZURE_OPENAI_KEY        = your Azure key
oAZURE_DEPLOYMENT_NAME  = e.g., gpt-4.1-mini
AZURE_ENDPOINT          = your Azure endpoint URL
SYLLABUS_LINK           = optional link to course page
QUALTRICS_API_TOKEN     = optional
QUALTRICS_SURVEY_ID     = optional
QUALTRICS_DATACENTER    = optional (e.g., uwo.eu)
```

### 4. Host the Frontend Separately

* Push `index.html` to a GitHub Pages repo or Netlify
* In `index.html`, set the `fetch()` URL to your deployed Deno backend:

```js
fetch("https://your-deno-project.deno.dev/", {
```

### 5. Enable GitHub Pages (Optional)

Settings → Pages → Source = `main` branch → root

### 6. (Optional) Embed in Brightspace

Use `brightspace.html` with an iframe pointing to your hosted frontend.

### 7. Qualtrics Logging Setup (Optional)
If using Qualtrics, make sure your survey contains embedded data fields:

```
responseText
queryText
```

These will be populated by the bot. Responses will include a hidden HTML comment like:
`<!-- Qualtrics status: 200 -->`

## Notes

* Input is transmitted securely over HTTPS
* No artificial limit is imposed on paragraph length, but large inputs may be truncated by token limits
* Feedback always ends with a disclaimer directing students to the course website
* A hidden HTML comment shows Qualtrics logging status

## License

© Dan Bousfield. Licensed under Creative Commons Attribution 4.0
[https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/)
