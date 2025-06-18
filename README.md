# Paragraph Marker Bot

A grading assistant bot for self-evaluating student paragraphs using a structured rubric defined in `syllabus.txt`. This tool is optimized for use in political science and related disciplines where grading criteria are detailed and paragraph-specific.

## What It Does

* Accepts paragraph submissions via a web form
* Uses Azure OpenAI (GPT-4.1-mini) to analyze paragraph structure and content
* Applies detailed grading criteria from `syllabus.txt`
* Returns structured feedback and an explicit grade (A–D)
* Optionally logs each query and response to Qualtrics if configured

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

### 2. Replace Grading Criteria

Edit `syllabus.txt` to reflect your own paragraph marking rubric.

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
