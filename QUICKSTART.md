# Quick Start Guide

## How to Use the DMP Evaluation Tool

### Step 1: Open the Tool

Open `index.html` in your web browser:
```bash
# From the project directory
cd dmpeva-tool
# Then open index.html in your browser
# On Linux:
xdg-open index.html
# On Mac:
open index.html
# On Windows:
start index.html
```

Or simply double-click on `index.html` in your file explorer.

### Step 2: Configure API (or use Test Mode)

**Option A: Use Test Mode (Recommended for first try)**
1. Check the "Test Mode" checkbox
2. This uses sample data without requiring an API key

**Option B: Use Together.ai API**
1. Get your API key from https://api.together.xyz/
2. Paste it into the "Together.ai API Key" field
3. Select your preferred model (default is fine)

### Step 3: Prepare Your Files

You need two files:

1. **Evaluation Criteria** - Use the included file:
   - `../DMP_Evaluation_Criteria_Formated.md`

2. **DMP Document** - Use the sample file:
   - `../_horizon_europeTue Nov 11 2025 17_13_26.doc`

### Step 4: Upload Files

1. Click or drag-and-drop your evaluation criteria file into the first upload zone
2. Click or drag-and-drop your DMP document into the second upload zone

### Step 5: Select Project Phase

Choose the appropriate phase from the dropdown:
- **Proposal / Early Stage** - For initial DMP evaluation
- **Mid-Project** - For progress assessment
- **End-Project** - For final compliance check

### Step 6: Start Evaluation

Click the "Start Evaluation" button and wait for the results.

### Step 7: Review & Export

Once complete:
- Review the overall score and detailed feedback
- Export results in JSON, Markdown, or PDF format

## Example Files

To test the tool quickly:

**Criteria File**: `../DMP_Evaluation_Criteria_Formated.md`
**DMP File**: `../_horizon_europeTue Nov 11 2025 17_13_26.doc`
**Phase**: Proposal / Early Stage
**Mode**: Test Mode (enabled)

## Troubleshooting

**"Evaluate" button is disabled?**
- Make sure both files are uploaded
- Either enable Test Mode OR enter a valid API key

**File upload fails?**
- Check that file format is supported (.docx, .pdf, .txt, .json, .md, .html)
- File size must be under 50MB

**Evaluation fails?**
- Check browser console (F12 → Console) for errors
- Try enabling Test Mode first to verify the tool works
- Check your internet connection if using API mode

## Tips

1. **Start with Test Mode** - This lets you see how the tool works without using API credits
2. **Use Markdown files** - They're faster to parse than DOCX or PDF
3. **Review the feedback** - The AI provides specific, actionable recommendations
4. **Export results** - Save your evaluations for documentation and tracking

## What's Next?

- Use the tool with your own DMP documents
- Customize evaluation criteria for your specific needs
- Integrate into your DMP review workflow
- Share reports with stakeholders
