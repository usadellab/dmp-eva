# DMP Evaluation Tool

An AI-powered web application for evaluating Data Management Plans (DMPs) against standardized criteria using Together.ai's language models.

## Features

- **File Format Support**: Upload DMP documents and evaluation criteria in multiple formats:
  - DOCX (Word documents)
  - PDF
  - TXT (plain text)
  - JSON
  - Markdown (.md)
  - HTML

- **Phase-Specific Evaluation**: Evaluate DMPs for different project phases:
  - Proposal / Early Stage
  - Mid-Project
  - End-Project

- **AI-Powered Analysis**: Uses Together.ai's advanced language models to:
  - Extract evaluation criteria from uploaded documents
  - Analyze DMP content against criteria
  - Provide quantitative scores (0-100) and qualitative feedback

- **Multiple Export Formats**:
  - JSON (structured data)
  - Markdown (human-readable report)
  - PDF (formatted report)

- **Test Mode**: Includes sample evaluation data for testing without API calls

## Getting Started

### 1. Open the Tool

Simply open `index.html` in a modern web browser (Chrome, Firefox, Edge, or Safari).

### 2. Configure API

- **API Key**: Enter your Together.ai API key (get one at https://api.together.xyz/)
- **Model Selection**: Choose from available models (default: Qwen 2.5 72B)
- **Test Mode**: Enable to use sample data without API calls

### 3. Upload Files

- **Evaluation Criteria**: Upload your criteria document (e.g., `DMP_Evaluation_Criteria_Formated.md`)
- **DMP Document**: Upload the DMP to evaluate (e.g., `_horizon_europeTue Nov 11 2025 17_13_26.doc`)

### 4. Select Project Phase

Choose the appropriate phase:
- **Proposal**: For evaluating planned approaches
- **Mid-Project**: For assessing current implementation
- **End-Project**: For reviewing final outcomes

### 5. Start Evaluation

Click "Start Evaluation" and wait for the AI to analyze the DMP. Progress updates will be shown.

### 6. Review Results

View:
- Overall compliance score (0-100)
- Detailed scores by category
- Narrative feedback for each criterion
- Strengths and areas for improvement

### 7. Export Results

Download evaluation results in your preferred format:
- **JSON**: For further processing or archiving
- **Markdown**: For editing or sharing
- **PDF**: For formal reports

## Project Structure

```
dmpeva-tool/
├── index.html              # Main application page
├── css/
│   └── styles.css          # Custom styling
├── js/
│   ├── app.js              # Main application logic
│   ├── file-parser.js      # File format parsing
│   ├── criteria-extractor.js # Criteria extraction
│   ├── llm-service.js      # Together.ai API integration
│   ├── evaluator.js        # Evaluation orchestration
│   └── export-service.js   # Export functionality
└── README.md               # This file
```

## Evaluation Criteria

The tool expects evaluation criteria organized by category (1a-6b):

1. **Data Description and Collection** (1a, 1b)
2. **Documentation and Quality** (2a, 2b)
3. **Storage and Backup** (3a, 3b, 3c)
4. **Legal and Ethical Requirements** (4a, 4b, 4c)
5. **Data Sharing and Preservation** (5a, 5b, 5c, 5d)
6. **Responsibilities and Resources** (6a, 6b)

## Technical Requirements

- Modern web browser with JavaScript enabled
- Internet connection (for API calls and loading CDN libraries)
- Together.ai API key (unless using test mode)

## Libraries Used

- **Bootstrap 5.3**: UI framework
- **Font Awesome 6.4**: Icons
- **PDF.js 3.11**: PDF parsing
- **Mammoth.js 1.6**: DOCX parsing
- **jsPDF 2.5**: PDF export
- **jsPDF-AutoTable 3.5**: PDF table generation

## Privacy & Security

- All file processing happens client-side in your browser
- Files are not uploaded to any server (except API calls to Together.ai)
- API keys are stored locally in your browser's localStorage
- No data is collected or stored by this tool

## Troubleshooting

**Files not uploading?**
- Check file format is supported (.docx, .pdf, .txt, .json, .md, .html)
- Ensure file size is under 50MB

**API errors?**
- Verify your API key is correct
- Check your internet connection
- Try enabling test mode to verify the tool works

**No results showing?**
- Check browser console for errors (F12 → Console tab)
- Ensure both files are uploaded
- Try with test mode enabled

## Support

For issues or questions:
- Check the browser console for detailed error messages
- Review this README for configuration steps
- Ensure all required files are present

## License

This tool is provided as-is for research and educational purposes.
