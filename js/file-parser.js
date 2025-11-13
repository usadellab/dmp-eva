// =============================================================================
// FILE PARSER MODULE
// Handles parsing of various file formats: txt, json, docx, pdf, html, md
// =============================================================================

(function(window) {
  'use strict';

  // Set PDF.js worker
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  /**
   * Parse a text file
   * @param {File} file - File object
   * @returns {Promise<string>} - Extracted text content
   */
  async function parseTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Text file read failed'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse a JSON file
   * @param {File} file - File object
   * @returns {Promise<Object>} - Parsed JSON object
   */
  async function parseJsonFile(file) {
    const text = await parseTextFile(file);
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Extract text from old .doc file using raw text extraction + AI cleanup
   * @param {File} file - File object
   * @returns {Promise<string>} - Extracted and cleaned text
   */
  async function extractDocTextWithAI(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const uint8Array = new Uint8Array(arrayBuffer);

          // Extract readable text from binary
          let rawText = '';
          for (let i = 0; i < uint8Array.length; i++) {
            const char = uint8Array[i];
            // Include printable ASCII characters and common extended ASCII
            if ((char >= 32 && char <= 126) || char === 10 || char === 13 || char === 9) {
              rawText += String.fromCharCode(char);
            } else if (char >= 128 && char <= 255) {
              // Include extended ASCII for international characters
              rawText += String.fromCharCode(char);
            }
          }

          // Clean up the raw text - remove excessive whitespace and control characters
          rawText = rawText
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '') // Remove control characters
            .replace(/\s{3,}/g, '\n\n') // Replace 3+ spaces with paragraph breaks
            .replace(/(.)\1{10,}/g, '$1') // Remove character repetitions (10+)
            .trim();

          if (rawText.length < 100) {
            reject(new Error('Insufficient text extracted from .doc file. Please save as .docx or paste text.'));
            return;
          }

          console.log('[Parser] Extracted raw text from .doc, length:', rawText.length);

          // Use AI to clean up the text if available
          if (window.LLMService && !window.LLMService.isTestMode()) {
            try {
              const cleaned = await cleanTextWithAI(rawText);
              resolve(cleaned);
            } catch (aiError) {
              console.warn('[Parser] AI cleanup failed, using raw text:', aiError);
              resolve(rawText); // Fallback to raw text
            }
          } else {
            // Test mode or no AI available - return raw text
            resolve(rawText);
          }

        } catch (err) {
          reject(new Error(`DOC extraction failed: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Clean extracted text using AI
   * @param {string} rawText - Raw extracted text
   * @returns {Promise<string>} - Cleaned text
   */
  async function cleanTextWithAI(rawText) {
    const apiKey = window.LLMService.getAPIKey();
    if (!apiKey) {
      console.log('[Parser] No API key, skipping AI cleanup');
      return rawText;
    }

    const model = window.LLMService.getSelectedModel();
    const activeProfile = window.APIConfig.getActiveProfile();

    const systemPrompt = `You are a text extraction assistant. Your job is to clean up text extracted from a binary Word document (.doc file). The text may contain formatting artifacts, gibberish characters, and scrambled content mixed with the actual document text.

Extract and return ONLY the meaningful document content, removing:
- Binary artifacts and gibberish
- Repeated characters or formatting codes
- Document metadata and headers
- Navigation or UI elements

Preserve:
- All meaningful text content
- Paragraph structure
- Headings and sections
- Lists and formatting cues`;

    const userPrompt = `Clean up this text extracted from a .doc file and return only the meaningful content:

${rawText.substring(0, 15000)}${rawText.length > 15000 ? '\n\n[... text truncated ...]' : ''}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const fetchConfig = window.APIConfig.generateFetchConfig(
      activeProfile,
      apiKey,
      model,
      messages
    );

    const response = await fetch(fetchConfig.url, fetchConfig.options);

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();
    const cleaned = data.choices[0]?.message?.content;

    if (!cleaned) {
      throw new Error('No content from AI');
    }

    console.log('[Parser] AI cleaned text, original:', rawText.length, 'cleaned:', cleaned.length);
    return cleaned;
  }

  /**
   * Parse a DOCX/DOC file using mammoth.js with fallback for old .doc
   * @param {File} file - File object
   * @returns {Promise<string>} - Extracted text content
   */
  async function parseDocxFile(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error('Mammoth.js library not loaded');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;

          // Check if it's a valid ZIP file (DOCX files are ZIP archives)
          const uint8Array = new Uint8Array(arrayBuffer);
          const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B; // PK header

          if (!isZip) {
            // Old .doc format detected - try AI extraction
            console.warn('[Parser] Old .doc format detected, trying AI extraction...');
            try {
              const extracted = await extractDocTextWithAI(file);
              resolve(extracted);
              return;
            } catch (extractErr) {
              reject(new Error('DOC file could not be parsed. Try: Save as .docx or use "Paste Text Instead".'));
              return;
            }
          }

          // Standard DOCX parsing
          const result = await mammoth.extractRawText({ arrayBuffer });

          if (result.messages && result.messages.length > 0) {
            console.warn('[DOCX Parser] Warnings:', result.messages);
          }

          resolve(result.value);
        } catch (err) {
          // Provide concise error messages
          if (err.message && err.message.includes('end of central directory')) {
            reject(new Error('File corrupted. Try: Save as .docx or paste text instead.'));
          } else {
            reject(new Error(`Parse error: ${err.message.substring(0, 50)}...`));
          }
        }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse a PDF file using PDF.js
   * @param {File} file - File object
   * @returns {Promise<string>} - Extracted text content
   */
  async function parsePdfFile(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library not loaded');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

          let fullText = '';

          // Extract text from each page
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
          }

          resolve(fullText.trim());
        } catch (err) {
          reject(new Error(`PDF parse error: ${err.message.substring(0, 40)}...`));
        }
      };
      reader.onerror = () => reject(new Error('PDF read failed'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse an HTML file
   * @param {File} file - File object
   * @returns {Promise<string>} - Extracted text content
   */
  async function parseHtmlFile(file) {
    const html = await parseTextFile(file);

    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove script and style elements
    const scripts = tempDiv.querySelectorAll('script, style');
    scripts.forEach(el => el.remove());

    // Get text content
    let text = tempDiv.textContent || tempDiv.innerText || '';

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Parse a Markdown file
   * @param {File} file - File object
   * @returns {Promise<string>} - Markdown content (raw text)
   */
  async function parseMarkdownFile(file) {
    return parseTextFile(file);
  }

  /**
   * Parse any supported file format
   * @param {File} file - File object
   * @returns {Promise<Object>} - {text: string, type: string, originalFile: File}
   */
  async function parseFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();

    console.log(`[File Parser] Parsing file: ${file.name} (${extension})`);

    let text;
    let isJson = false;

    try {
      switch (extension) {
        case 'txt':
          text = await parseTextFile(file);
          break;

        case 'json':
          const jsonData = await parseJsonFile(file);
          text = JSON.stringify(jsonData, null, 2);
          isJson = true;
          break;

        case 'docx':
        case 'doc':
          text = await parseDocxFile(file);
          break;

        case 'pdf':
          text = await parsePdfFile(file);
          break;

        case 'html':
        case 'htm':
          text = await parseHtmlFile(file);
          break;

        case 'md':
        case 'markdown':
          text = await parseMarkdownFile(file);
          break;

        default:
          throw new Error(`Unsupported file type: .${extension}`);
      }

      console.log(`[File Parser] Successfully parsed ${file.name}: ${text.length} characters`);

      return {
        text: text,
        type: extension,
        isJson: isJson,
        originalFile: file,
        size: file.size,
        name: file.name
      };
    } catch (error) {
      console.error('[File Parser] Error:', error);
      throw error;
    }
  }

  /**
   * Validate file before parsing
   * @param {File} file - File object
   * @param {Array<string>} allowedExtensions - Allowed extensions (e.g., ['txt', 'pdf'])
   * @returns {Object} - {valid: boolean, error: string}
   */
  function validateFile(file, allowedExtensions = ['txt', 'json', 'docx', 'doc', 'pdf', 'html', 'htm', 'md', 'markdown']) {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();

    // Info for old .doc files (AI-powered extraction)
    if (extension === 'doc') {
      return {
        valid: true,
        warning: true,
        error: 'Old .doc format will use AI-powered text extraction. Best results with .docx.'
      };
    }

    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Unsupported: .${extension}. Allowed: ${allowedExtensions.slice(0, 4).join(', ')}`
      };
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 50MB)`
      };
    }

    return { valid: true };
  }

  /**
   * Get file extension
   * @param {File} file - File object
   * @returns {string} - File extension (lowercase)
   */
  function getFileExtension(file) {
    return file.name.toLowerCase().split('.').pop();
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted size string
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Export public API
  window.FileParser = {
    parseFile,
    validateFile,
    getFileExtension,
    formatFileSize,
    parseTextFile,
    parseJsonFile,
    parseDocxFile,
    parsePdfFile,
    parseHtmlFile,
    parseMarkdownFile
  };

})(window);
