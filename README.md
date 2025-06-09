# Paragraph Marker Bot

A grading assistant bot for self-evaluating student paragraphs using a structured rubric defined in `syllabus.txt`.

This version is optimized for use in political science and related disciplines where grading criteria are detailed and paragraph-specific.

## What It Does

* Accepts a 250-word paragraph submission
* Uses OpenAI to analyze paragraph structure and content
* Applies detailed grading criteria (from `syllabus.txt`)
* Returns structured feedback and an explicit grade (A, B, C, or D)
* Optionally logs each query and response to Qualtrics
* Can accept instructor-supplied feedback guidance

## Instructor Guidance Feature

You can prepend any student submission with instructor input using this format:

```
dsb2025 - This paragraph fails to address the question logically and gives no specific examples.

In wartime, international law...
```

This guidance is only read by the bot — it does not appear in the returned feedback. The bot uses it to shape how it interprets and responds to the submission.

## Setup Instructions

### 1. Fork the Repository

Use GitHub's "Use this template" to create your own copy.

### 2. Replace the Grading Criteria

Edit `syllabus.txt` with your rubric.

### 3. Deploy to Deno

* Go to https://dash.deno.com and sign up or log in using your GitHub account. This is required so Deno can access your repository and deploy from it directly.
* New Project → Import from GitHub → Set `main.ts` as entry point
* Set these environment variables:

```
OPENAI_API_KEY         = your OpenAI key
SYLLABUS_LINK          = optional course webpage URL
QUALTRICS_API_TOKEN    = (optional)
QUALTRICS_SURVEY_ID    = (optional)
QUALTRICS_DATACENTER   = (optional, e.g., uwo.eu)
```

### 4. Update the Fetch URL

In `index.html`, change:

```js
fetch("https://syllabus-bot.deno.dev/", {
```

to your deployed Deno URL, e.g.:

```js
fetch("https://paragraph-marker.deno.dev/", {
```

### 5. Enable GitHub Pages

Settings → Pages → Source = `main` branch → root folder → Save.
Visit `https://your-username.github.io/paragraph-marker/`

### 6. (Optional) Embed in Brightspace

Use `brightspace.html` with an iframe that links to your deployed GitHub Pages frontend.

## Notes

* Always returns a single grade explicitly
* Hidden HTML comment shows Qualtrics status: `<!-- Qualtrics status: 200 -->`
* Appends this sentence to all outputs: `This is a sample grading exercise. No grades will ever be determined by a bot.`

## License

© Dan Bousfield. Licensed under Creative Commons Attribution 4.0
[https://creativecommons.org/licenses/by/4.0/](https://creativecommons.org/licenses/by/4.0/)
