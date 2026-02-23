// =============================================================================
// FILE PARSER MODULE
// Handles parsing of various file formats: txt, json, docx, html, md
// Converts documents to markdown for efficient LLM processing
// =============================================================================

(function(window) {
  'use strict';

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
   * Parse old .doc file using officeparser library
   * @param {File} file - File object
   * @returns {Promise<string>} - Extracted text content
   */
  async function parseDocWithLibrary(file) {
    return new Promise((resolve, reject) => {
      // Check if officeparser is available
      if (typeof officeParser === 'undefined') {
        reject(new Error('officeparser library not loaded. Please save as .docx or paste text instead.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;

          // officeparser v6.0.0+ returns an AST object
          // Call .toText() to extract plain text
          const ast = await officeParser.parseOffice(arrayBuffer, {
            outputErrorToConsole: true
          });

          const text = ast.toText();

          if (!text || text.trim().length < 50) {
            reject(new Error('Insufficient text extracted from .doc file. Please save as .docx or paste text instead.'));
            return;
          }

          console.log('[Parser] .doc parsed with officeparser, length:', text.length);
          resolve(text);
        } catch (err) {
          console.error('[Parser] officeparser error:', err);
          reject(new Error('Failed to parse .doc file. Please save as .docx or paste text instead.'));
        }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse a DOCX/DOC file using mammoth.js with fallback for old .doc
   * Converts to markdown for better structure preservation
   * @param {File} file - File object
   * @returns {Promise<string>} - Markdown content
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
            // Not a ZIP file - could be old .doc, HTML saved as .doc, or other format
            console.warn('[Parser] Non-ZIP file with .doc/.docx extension, detecting format...');

            // Check if it's actually HTML (common when HTML is saved with .doc extension)
            const textContent = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
            const isHtml = textContent.trim().toLowerCase().startsWith('<!doctype') ||
                           textContent.trim().toLowerCase().startsWith('<html') ||
                           textContent.includes('xmlns:w="urn:schemas-microsoft-com:office:word"');

            if (isHtml) {
              console.log('[Parser] Detected HTML content in .doc file, parsing as HTML...');
              try {
                const htmlResult = await parseHtmlContent(textContent);
                resolve(htmlResult);
                return;
              } catch (htmlErr) {
                reject(new Error('HTML parsing failed. Try: Paste text instead.'));
                return;
              }
            }

            // Try officeparser for old .doc format
            console.log('[Parser] Trying officeparser for old .doc format...');
            try {
              const extracted = await parseDocWithLibrary(file);
              resolve(extracted);
              return;
            } catch (extractErr) {
              console.warn('[Parser] officeparser failed:', extractErr.message);
              reject(new Error('DOC file could not be parsed. Try: Save as .docx or use "Paste Text Instead".'));
              return;
            }
          }

          // Convert DOCX to markdown (preserves structure: headings, lists, formatting)
          const result = await mammoth.convertToMarkdown({ arrayBuffer });

          if (result.messages && result.messages.length > 0) {
            console.warn('[DOCX Parser] Warnings:', result.messages);
          }

          console.log('[Parser] DOCX converted to markdown, length:', result.value.length);
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
   * Parse an HTML file and convert to markdown-like structure
   * @param {File} file - File object
   * @returns {Promise<string>} - Markdown-like content
   */
  async function parseHtmlFile(file) {
    const html = await parseTextFile(file);
    return parseHtmlContent(html);
  }

  /**
   * Parse HTML content string and convert to markdown-like structure
   * @param {string} html - HTML content string
   * @returns {Promise<string>} - Markdown-like content
   */
  async function parseHtmlContent(html) {
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove script and style elements
    const scripts = tempDiv.querySelectorAll('script, style, nav, footer, header');
    scripts.forEach(el => el.remove());

    // Convert HTML to markdown-like structure
    let md = '';

    // Process headings
    tempDiv.querySelectorAll('h1').forEach(el => { md += `# ${el.textContent.trim()}\n\n`; el.remove(); });
    tempDiv.querySelectorAll('h2').forEach(el => { md += `## ${el.textContent.trim()}\n\n`; el.remove(); });
    tempDiv.querySelectorAll('h3').forEach(el => { md += `### ${el.textContent.trim()}\n\n`; el.remove(); });
    tempDiv.querySelectorAll('h4').forEach(el => { md += `#### ${el.textContent.trim()}\n\n`; el.remove(); });

    // Process lists
    tempDiv.querySelectorAll('ul > li').forEach(el => { md += `- ${el.textContent.trim()}\n`; });
    tempDiv.querySelectorAll('ol > li').forEach((el, i) => { md += `${i + 1}. ${el.textContent.trim()}\n`; });

    // Process paragraphs
    tempDiv.querySelectorAll('p').forEach(el => {
      const text = el.textContent.trim();
      if (text) md += `${text}\n\n`;
    });

    // Process tables (simple conversion)
    tempDiv.querySelectorAll('table').forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('th, td');
        const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
        md += `| ${cellTexts.join(' | ')} |\n`;
        if (rowIndex === 0) {
          md += `| ${cellTexts.map(() => '---').join(' | ')} |\n`;
        }
      });
      md += '\n';
    });

    // If no structured content found, fall back to plain text
    if (!md.trim()) {
      md = tempDiv.textContent || '';
      md = md.replace(/\s+/g, ' ').trim();
    }

    return md;
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
   * @param {Array<string>} allowedExtensions - Allowed extensions (e.g., ['txt', 'docx'])
   * @returns {Object} - {valid: boolean, error: string}
   */
  function validateFile(file, allowedExtensions = ['txt', 'json', 'docx', 'doc', 'html', 'htm', 'md', 'markdown']) {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();

    // Info for old .doc files (library-based parsing)
    if (extension === 'doc') {
      return {
        valid: true,
        warning: true,
        error: 'Old .doc format will be parsed using officeparser library. Best results with .docx.'
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
    parseHtmlFile,
    parseMarkdownFile
  };

})(window);
