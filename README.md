# DMP Evaluation Tool

An AI-powered web application for evaluating Data Management Plans (DMPs) against standardized criteria using Together.ai or compatible LLM APIs.

## Features

- **Sentence-level evaluation**: Each DMP sentence is scored (0–100) against relevant criteria, with explanations and improvement suggestions for scores below 75
- **Phase-specific**: Evaluate for Proposal/Early Stage, Mid-Project, or End-Project phases
- **Flexible input**: Upload files or paste text directly; default criteria (eva.json) auto-loaded
- **Multiple API backends**: DataPLANT (default, no key needed), Together.ai, LM Studio (local), or any OpenAI-compatible endpoint

## Supported File Formats

| Format | Extensions |
|---|---|
| Word Document | `.docx`, `.doc` |
| Plain Text | `.txt` |
| Markdown | `.md` |
| HTML | `.html`, `.htm` |
| JSON | `.json` |

## Quick Start

1. Open `index.html` in a modern browser
2. Default criteria (eva.json) and DataPLANT API are pre-configured — no setup required
3. Upload a DMP document (or paste text)
4. Select the project phase and click **Start Evaluation**

To use Together.ai, open **API Config**, select the Together.ai profile, and enter your API key.

## Model Selection

Default model: **GPT OSS 20B** (`openai/gpt-oss-20b`)

Available Together.ai models:
- `Qwen/Qwen3-235B-A22B-Instruct-2507-tput` — Qwen3 235B
- `openai/gpt-oss-20b` — GPT OSS 20B *(default)*
- `openai/gpt-oss-120b` — GPT OSS 120B
- `deepseek-ai/DeepSeek-R1-0528-tput` — DeepSeek R1

## Score Bands

| Score | Rating |
|---|---|
| 90–100 | Excellent |
| 75–89 | Good |
| 60–74 | Pass |
| 0–59 | Insufficient |

## Evaluation Criteria

Default criteria cover six DMP dimensions (IDs 1a–6b):

1. **Data Description & Collection** (1a, 1b)
2. **Documentation & Quality** (2a, 2b)
3. **Storage & Backup** (3a, 3b, 3c)
4. **Legal & Ethical Requirements** (4a, 4b, 4c)
5. **Data Sharing & Preservation** (5a, 5b, 5c, 5d)
6. **Responsibilities & Resources** (6a, 6b)

Custom criteria can be uploaded as a file or pasted as text; the tool can use AI to convert raw policy documents into evaluation criteria format.

## Export

Results can be exported as:
- **JSON** — structured data for archiving or further processing
- **Markdown** — human-readable report

## Project Structure

```
├── index.html              # Application entry point
├── eva.json                # Default evaluation criteria
├── js/
│   ├── app.js              # UI logic and orchestration
│   ├── api-config.js       # API profile management
│   ├── llm-service.js      # LLM API calls and streaming
│   ├── evaluator.js        # Evaluation pipeline
│   ├── criteria-extractor.js
│   ├── file-parser.js      # File format parsing
│   └── export-service.js   # JSON/Markdown export
└── css/styles.css
```

## Privacy

All file processing is client-side. Files are not uploaded to any server. API calls go directly to your chosen LLM endpoint. Settings are stored in browser localStorage only.
