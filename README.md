# DMP Evaluation Tool

An AI-powered web application for evaluating Data Management Plans (DMPs) against standardized criteria using Together.ai or compatible LLM APIs.

## Video Introduction

A short video walkthrough introducing what is DMP Evaluation Criteria, and how to review DMP with the help of AI-generated evaluation results.

https://github.com/user-attachments/assets/95ae5cb3-55f2-4126-aefa-1f4bcbcaf977

## Features

- **Sentence-level evaluation**: Each DMP paragraph is scored (0–100) against relevant criteria, with explanations and improvement suggestions for scores below 75
- **Phase-specific**: Evaluate for Proposal/Early Stage, Mid-Project, or End-Project phases
- **Flexible input**: Upload files or paste text directly; default criteria (`eva.json`) auto-loaded
- **Multiple API backends**: DataPLANT (default, no key needed), Together.ai, LM Studio (local), or any OpenAI-compatible endpoint
- **Export & reload**: Save evaluations as JSON/Markdown and reload later via **Advanced → Load Results**

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
2. Default criteria (`eva.json`) and DataPLANT API are pre-configured — no setup required
3. Upload a DMP document (or paste text)
4. Select the project phase and click **Start Evaluation**

To use Together.ai, open **API Config**, select the Together.ai profile, and enter your API key.

To use LM Studio locally, ensure the server is running on `http://localhost:1234` with CORS enabled, then select the LM Studio profile.

## Model Selection

Default model: **Qwen3 235B** (`qwen3-235b-a22b-instruct-2507-mlx`)

Available Together.ai models:
- `Qwen/Qwen3-235B-A22B-Instruct-2507-tput` — Qwen3 235B
- `openai/gpt-oss-20b` — GPT OSS 20B *(default for DataPLANT)*
- `openai/gpt-oss-120b` — GPT OSS 120B

## Input Size Limits

Estimated at ~4 characters per token:

- **16,000 tokens** — hard limit for all profiles; larger inputs are rejected.
- **4,000 tokens** — limit for the free DataPLANT community server. Larger inputs are rejected with a suggestion to use a local LLM (LM Studio) or another API.

## URL Parameters

The app accepts optional query parameters to pre-configure the LLM service and load resources from links (GitHub `blob` URLs are converted to raw URLs automatically):

| Parameter | Effect |
|---|---|
| `profile` | Switch the active API profile (`dataplan`, `together`, `openai`, `lmstudio`) |
| `endpoint` | Create and activate a custom endpoint profile |
| `apikey` | API key stored for the endpoint |
| `model` | Model identifier to use |
| `prompt` | URL of a custom prompt template (JSON sections or plain text) |
| `criteria` | URL of an evaluation criteria file (`.json`, `.md`, `.txt`) |
| `dmp` | URL of a DMP document to evaluate (`.txt`, `.md`, `.json`, `.docx`) |

Example:

```
index.html?endpoint=https://api.example.com/v1/chat/completions&apikey=KEY&model=my-model&dmp=https://github.com/user/repo/blob/main/dmp.txt
```

Use the **Share Link** button (next to API Configuration) to copy a shareable URL built from the current settings — active profile, custom endpoint, model, and any resources that were loaded from URLs. When an API key is configured, an **"Include API key in share links"** checkbox appears below the button; tick it to embed the key (the choice is remembered). Only share such links with people you trust, since anyone with the link can use your key.

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

### Phase-Specific Criteria

Pre-built criteria for each project phase are available in `tests/`:

| File | Phase | Subsections |
|---|---|---|
| `tests/eva-early-stage.json` | Proposal / Early Stage | 16 (1a–6b) |
| `tests/eva-mid-project.json` | Mid-Project | 15 (5d excluded) |
| `tests/eva-end-project.json` | End-Project | 16 (1a–6b) |

## Test Data

The `tests/` directory contains example DMPs and pre-computed evaluation results for validation:

| DMP | Description |
|---|---|
| `tests/test-dmp-early-good-end-bad.txt` | Strong proposal DMP; lacks final results/archiving for end-project |
| `tests/test-dmp-mid-good-end-bad.txt` | Strong mid-project update; missing final archiving & PIDs |
| `tests/test-dmp-bad-all-stages.txt` | Minimal vague DMP; fails all phases |

| Result | DMP | Criteria | Score |
|---|---|---|---|
| `tests/results-early-good.json` | early-good | early-stage | **77/100** |
| `tests/results-mid-good.json` | mid-good | mid-project | **85/100** |
| `tests/results-bad-all.json` | bad-all | early-stage | **0/100** |
| `tests/results-bad-end.json` | bad-all | end-project | **47/100** |
| `tests/results-early-vs-end.json` | early-good | end-project | **85/100** |
| `tests/results-mid-vs-end.json` | mid-good | end-project | **87/100** |

Load any result file via **Advanced → Load Results** to review the full evaluation UI.

## Export

Results can be exported as:
- **JSON** — structured data for archiving or further processing
- **Markdown** — human-readable report

## Project Structure

```
├── index.html              # Application entry point
├── eva.json                # Default evaluation criteria (all phases)
├── tests/                  # Phase-specific criteria, test DMPs, and results
│   ├── eva-early-stage.json
│   ├── eva-mid-project.json
│   ├── eva-end-project.json
│   ├── test-dmp-*.txt
│   └── results-*.json
├── js/
│   ├── app.20260727a.js    # UI logic and orchestration
│   ├── api-config.js       # API profile management
│   ├── llm-service.js      # LLM API calls and streaming
│   ├── evaluator.20260423a.js   # Evaluation pipeline
│   ├── criteria-extractor.js
│   ├── file-parser.20260423a.js # File format parsing
│   └── export-service.js   # JSON/Markdown export
├── css/styles.css
└── local/                  # Local development files
    ├── examples/
    └── js/
```

## DMP evaluation community

- **[DMP Evaluation](https://github.com/dmp-evaluation)** — Companion repository for DMP evaluation workflows and resources.

## Privacy

All file processing is client-side. Files are not uploaded to any server. API calls go directly to your chosen LLM endpoint. Settings are stored in browser localStorage only.
