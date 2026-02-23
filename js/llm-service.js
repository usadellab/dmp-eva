// =============================================================================
// LLM SERVICE MODULE FOR DMP EVALUATION
// Handles Together.AI API integration
// =============================================================================

(function(window) {
  'use strict';

  const DEFAULT_MODEL = 'Qwen/Qwen3-235B-A22B-Instruct';

  // Default prompt sections for DMP evaluation
  const DEFAULT_PROMPT = {
    systemRole: `DMP evaluator for {phase} phase.

Score: 90-100=e (excellent), 75-89=g (good), 60-74=p (pass), 0-59=i (insufficient).

Return compact JSON:
{"s":[[sentence,[criteriaIds],score,explanation,suggestion?]]}

Rules:
1. Evaluate each meaningful DMP sentence
2. criteriaIds: relevant IDs (1a,1b,2a,etc)
3. Add suggestion only if score<75`,

    criteriaContext: `Criteria:
{criteriaText}`,

    dmpContext: `DMP:
{dmpText}

Evaluate. Return compact JSON.`
  };

  /**
   * Load custom prompt from localStorage
   * @returns {Object} - Prompt sections object
   */
  function loadPromptFromStorage() {
    const saved = localStorage.getItem('dmpCustomPrompt');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { ...DEFAULT_PROMPT };
      }
    }
    return { ...DEFAULT_PROMPT };
  }

  /**
   * Save custom prompt to localStorage
   * @param {Object} promptSections - Prompt sections to save
   */
  function savePromptToStorage(promptSections) {
    localStorage.setItem('dmpCustomPrompt', JSON.stringify(promptSections));
  }

  /**
   * Get default prompt template
   * @returns {Object} - Default prompt sections
   */
  function getDefaultPrompt() {
    return { ...DEFAULT_PROMPT };
  }

  /**
   * Assemble full prompt from sections
   * @param {Object} sections - Prompt sections
   * @param {string} criteriaText - Formatted criteria text
   * @param {string} dmpText - DMP document text
   * @param {string} phase - Project phase
   * @returns {Object} - {systemPrompt, userPrompt}
   */
  function assembleFullPrompt(sections, criteriaText, dmpText, phase) {
    const phaseName = phase === 'proposal' ? 'proposal/early' : phase === 'mid' ? 'mid-project' : 'end-project';

    return {
      systemPrompt: sections.systemRole.replace('{phase}', phaseName),
      userPrompt: sections.criteriaContext.replace('{criteriaText}', criteriaText) + '\n\n' +
                  sections.dmpContext.replace('{dmpText}', dmpText)
    };
  }

  /**
   * Get the currently selected LLM model from localStorage
   * @returns {string} - Model identifier
   */
  function getSelectedModel() {
    return window.localStorage.getItem('togetherAIModel') || DEFAULT_MODEL;
  }

  /**
   * Get API key from localStorage
   * @returns {string|null} - API key or null
   */
  function getAPIKey() {
    return window.localStorage.getItem('togetherAPIKey');
  }

  /**
   * Check if test mode is enabled
   * @returns {boolean}
   */
  function isTestMode() {
    return window.localStorage.getItem('llmTestMode') === 'true';
  }

  /**
   * Test data for DMP evaluation (compact format) - Updated for sentence-level evaluation
   */
  const TEST_EVALUATION_DATA = {
    s: [
      ["This project will generate genomic data from RNA sequencing of alpine plant species.", ["1a"], 85, "Clearly describes data type and subject."],
      ["We will collect new observational data on alpine plant species diversity through field surveys across 50 sites.", ["1a", "1b"], 90, "Excellent detail on methods and scope."],
      ["Field observations will be stored in CSV format, approximately 10,000 records per year.", ["1b"], 80, "Good format specification."],
      ["We will implement Ecological Metadata Language (EML) for biodiversity observations.", ["2a"], 85, "Appropriate metadata standard."],
      ["Data stored on university secure file server with RAID-6 configuration.", ["3a"], 75, "Storage identified but needs more backup detail.", "Specify backup frequency and retention policy."],
      ["Daily incremental backups and weekly full backups retained for one year.", ["3a"], 90, "Excellent backup strategy."],
      ["No personal data processing involved - only plant species and environmental data.", ["4a"], 95, "Clear GDPR compliance statement."],
      ["University owns data per institutional policy with collaborators retaining rights.", ["4b"], 80, "IP ownership stated."],
      ["Public release planned within 12 months via GBIF and PANGAEA under CC BY 4.0.", ["5a", "5b"], 90, "Comprehensive sharing plan."],
      ["10+ year preservation in GBIF and PANGAEA repositories with DOI assignment.", ["5b"], 95, "Excellent long-term preservation."],
      ["PI responsible for strategy and compliance, Data Manager for daily management.", ["6a"], 85, "Clear role assignment."],
      ["Data Manager allocated at 0.5 FTE with total budget of EUR 63,800 over 36 months.", ["6b"], 80, "Specific resource allocation."]
    ]
  };

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   * @param {string} text - Text to estimate
   * @returns {number} - Estimated token count
   */
  function estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Helper: Retry a fetch request with exponential backoff
   * @param {Function} fetchFn - Async function that returns a fetch response
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @param {number} initialDelay - Initial delay in ms (default: 2000)
   * @returns {Promise<Response>} - Fetch response
   */
  async function retryWithBackoff(fetchFn, maxRetries = 3, initialDelay = 2000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchFn();

        // If successful, return immediately
        if (response.ok) {
          return response;
        }

        // Server error (5xx) - retry with exponential backoff
        if (response.status >= 500 && attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.warn(`[LLM] Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Rate limit (429) - retry with longer delay
        if (response.status === 429 && attempt < maxRetries) {
          const delay = 5000 * Math.pow(2, attempt);
          console.warn(`[LLM] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Other errors - return response to handle
        return response;

      } catch (error) {
        lastError = error;
        console.error(`[LLM] Network error on attempt ${attempt + 1}:`, error);

        // Check for CORS error
        if (error.message && error.message.includes('Failed to fetch')) {
          const activeProfile = window.APIConfig.getActiveProfile();
          if (activeProfile.endpoint && activeProfile.endpoint.includes('localhost:1234')) {
            // This is likely a CORS error with LM Studio
            throw new Error('CORS Error: LM Studio requires CORS to be enabled.\n\nIn LM Studio:\n1. Go to "Local Server" tab\n2. Enable "CORS" option\n3. Restart the server');
          }
        }

        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.warn(`[LLM] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw new Error(`All retry attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Attempt to repair malformed JSON
   * @param {string} jsonStr - Potentially malformed JSON string
   * @returns {Object|null} - Parsed object or null
   */
  function repairJSON(jsonStr) {
    try {
      // First, try standard parse
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('[JSON Repair] Standard parse failed, attempting repair...');
      console.warn('[JSON Repair] Error:', e.message);
      console.warn('[JSON Repair] Response length:', jsonStr.length);
      console.warn('[JSON Repair] First 200 chars:', jsonStr.substring(0, 200));
      console.warn('[JSON Repair] Last 200 chars:', jsonStr.substring(jsonStr.length - 200));

      let repaired = jsonStr.trim();

      // Remove markdown code blocks if present
      repaired = repaired.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      // Try to extract JSON object from text (handles extra text before/after)
      const jsonMatch = repaired.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        repaired = jsonMatch[0];
      }

      // Fix unquoted criteria IDs like [1a] -> ["1a"], [1a,2b] -> ["1a","2b"]
      repaired = repaired.replace(/\[([0-9][a-z](?:\s*,\s*[0-9][a-z])*)\]/g, (match, content) => {
        const ids = content.split(',').map(id => `"${id.trim()}"`);
        return `[${ids.join(',')}]`;
      });

      // Fix trailing commas
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

      // Fix missing quotes on keys
      repaired = repaired.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

      try {
        return JSON.parse(repaired);
      } catch (e2) {
        console.warn('[JSON Repair] First repair attempt failed:', e2.message);

        // Try to fix truncated JSON by closing unclosed brackets
        let truncated = repaired;
        const openBraces = (truncated.match(/{/g) || []).length;
        const closeBraces = (truncated.match(/}/g) || []).length;
        const openBrackets = (truncated.match(/\[/g) || []).length;
        const closeBrackets = (truncated.match(/]/g) || []).length;

        // Add missing closing brackets
        for (let i = 0; i < openBrackets - closeBrackets; i++) truncated += ']';
        for (let i = 0; i < openBraces - closeBraces; i++) truncated += '}';

        // Remove trailing comma before closing
        truncated = truncated.replace(/,(\s*[}\]])/g, '$1');

        console.log('[JSON Repair] Attempting truncated fix, added',
          openBrackets - closeBrackets, 'brackets and',
          openBraces - closeBraces, 'braces');

        try {
          return JSON.parse(truncated);
        } catch (e3) {
          console.error('[JSON Repair] All repair attempts failed');
          console.error('[JSON Repair] Final attempt error:', e3.message);

          // Last resort: try to find a valid JSON object
          try {
            // Try parsing just the start until we hit invalid content
            for (let len = repaired.length; len > 100; len -= 100) {
              try {
                let partial = repaired.substring(0, len);
                // Try to close it properly
                const pOpenBraces = (partial.match(/{/g) || []).length;
                const pCloseBraces = (partial.match(/}/g) || []).length;
                const pOpenBrackets = (partial.match(/\[/g) || []).length;
                const pCloseBrackets = (partial.match(/]/g) || []).length;
                for (let i = 0; i < pOpenBrackets - pCloseBrackets; i++) partial += ']';
                for (let i = 0; i < pOpenBraces - pCloseBraces; i++) partial += '}';
                partial = partial.replace(/,(\s*[}\]])/g, '$1');
                return JSON.parse(partial);
              } catch {}
            }
          } catch (e4) {}

          return null;
        }
      }
    }
  }

  /**
   * Parse Server-Sent Events (SSE) stream from Together.ai API
   * @param {ReadableStream} stream - Response body stream
   * @param {Function} onChunk - Callback for each content chunk (text, isReasoning)
   * @returns {Promise<string>} - Complete accumulated content
   */
  async function parseSSEStream(stream, onChunk = null) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';
    let accumulatedReasoning = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[LLM Stream] Stream completed');
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split buffer by newlines to process complete lines
        const lines = buffer.split('\n');

        // Keep incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();

          // Skip empty lines
          if (!trimmedLine) continue;

          // Check for data: prefix (SSE format)
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.substring(6);

            // Check for stream termination
            if (data === '[DONE]') {
              console.log('[LLM Stream] Received [DONE] signal');
              break;
            }

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta;

              if (!delta) continue;

              // Handle reasoning content (for models like DeepSeek-R1)
              if (delta.reasoning) {
                accumulatedReasoning += delta.reasoning;
                if (onChunk) {
                  onChunk(delta.reasoning, true); // true = isReasoning
                }
              }

              // Handle regular content
              if (delta.content) {
                accumulatedContent += delta.content;
                if (onChunk) {
                  onChunk(delta.content, false); // false = regular content
                }
              }

              // Check for completion
              const finishReason = chunk.choices?.[0]?.finish_reason;
              if (finishReason === 'stop' || finishReason === 'length') {
                console.log(`[LLM Stream] Stream finished: ${finishReason}`);
                break;
              }

            } catch (parseError) {
              console.warn('[LLM Stream] Failed to parse chunk:', parseError, 'Data:', data);
              // Continue processing other chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('[LLM Stream] Stream reading error:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }

    // Return the complete content (reasoning is typically not used for final output)
    return accumulatedContent || accumulatedReasoning;
  }

  /**
   * Call Together AI API to evaluate DMP
   * @param {string} systemPrompt - System prompt describing the evaluator role
   * @param {string} userPrompt - User prompt with criteria and DMP text
   * @param {Function} onProgress - Optional callback for streaming updates
   * @returns {Promise<Object>} - Evaluation results
   */
  async function evaluateDMP(systemPrompt, userPrompt, onProgress = null) {
    // Check test mode
    if (isTestMode()) {
      console.log('[LLM] Test mode enabled, returning sample data');
      if (onProgress) {
        onProgress({ type: 'status', content: 'Using test mode - sample evaluation data' });
      }
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
      return TEST_EVALUATION_DATA;
    }

    // Get active profile first to check if API key is needed
    const activeProfile = window.APIConfig.getActiveProfile();
    const needsAPIKey = activeProfile.requiresAPIKey !== false;

    // Only validate API key if profile requires it
    let apiKey = '';
    if (needsAPIKey) {
      apiKey = getAPIKey();
      if (!apiKey) {
        throw new Error('API key not configured. Please enter your API key.');
      }
    }

    const model = getSelectedModel();
    console.log(`[LLM] Evaluating DMP with model: ${model}`);
    console.log(`[LLM] Prompt size: ~${estimateTokens(systemPrompt + userPrompt)} tokens`);

    if (onProgress) {
      onProgress({ type: 'status', content: `Calling ${model}...` });
    }

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    // Generate fetch configuration from profile
    const fetchConfig = window.APIConfig.generateFetchConfig(
      activeProfile,
      apiKey,
      model,
      messages
    );

    // Make API call with retry logic
    const response = await retryWithBackoff(async () => {
      return fetch(fetchConfig.url, fetchConfig.options);
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    // Check if response is streaming
    const contentType = response.headers.get('content-type');
    const isStreaming = contentType && contentType.includes('text/event-stream');

    let content;

    if (isStreaming) {
      console.log('[LLM] Streaming response detected');

      // Handle streaming response
      content = await parseSSEStream(response.body, (chunk, isReasoning) => {
        if (onProgress) {
          // Pass streaming chunks to progress callback
          // Format: {type: 'stream', content: string, isReasoning: boolean}
          onProgress({
            type: 'stream',
            content: chunk,
            isReasoning: isReasoning
          });
        }
      });

      if (onProgress) {
        onProgress({ type: 'status', content: 'Processing complete response...' });
      }

    } else {
      // Handle standard JSON response (fallback)
      console.log('[LLM] Standard JSON response');
      const data = await response.json();

      if (onProgress) {
        onProgress({ type: 'status', content: 'Parsing response...' });
      }

      // Extract content from response
      content = data.choices[0]?.message?.content;
    }

    if (!content) {
      throw new Error('No content in API response');
    }

    console.log('[LLM] Response received, parsing JSON...');

    // Try to parse JSON response
    const result = repairJSON(content);
    if (!result) {
      throw new Error('Failed to parse evaluation results as JSON');
    }

    if (onProgress) {
      onProgress({ type: 'complete', content: 'Evaluation complete!' });
    }

    return result;
  }

  /**
   * Build evaluation prompt from criteria and DMP text
   * Uses custom prompt from localStorage if available
   * @param {Object} criteria - Extracted evaluation criteria
   * @param {string} dmpText - DMP document text
   * @param {string} phase - Project phase (proposal/mid/end)
   * @returns {Object} - {systemPrompt, userPrompt}
   */
  function buildEvaluationPrompt(criteria, dmpText, phase) {
    // Load custom prompt from storage
    const customPrompt = loadPromptFromStorage();

    // Format criteria text
    const criteriaText = criteria.categories.map(cat =>
      `${cat.id}: ${cat.name}\n${cat.description}`
    ).join('\n\n');

    // Assemble prompt using custom sections
    return assembleFullPrompt(customPrompt, criteriaText, dmpText, phase);
  }

  /**
   * Detect if criteria text is suitable for evaluation and convert if needed
   * @param {string} criteriaText - Raw criteria text from user input
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - {suitable: boolean, convertedText: string, originalText: string}
   */
  async function detectAndConvertCriteria(criteriaText, onProgress = null) {
    if (!criteriaText || criteriaText.trim().length < 50) {
      throw new Error('Criteria text is too short. Please provide more detailed evaluation criteria.');
    }

    console.log('[LLM] Detecting criteria suitability...');
    if (onProgress) {
      onProgress({ type: 'status', content: 'Analyzing evaluation criteria...' });
    }

    // Check if already in evaluation format (heuristic check)
    const hasEvaluationKeywords = /evaluate|assess|check|criteria|score|rating|measure/i.test(criteriaText);
    const hasStructure = /\d+\.|###|##|\*\*|criterion|requirement/i.test(criteriaText);
    const isLongEnough = criteriaText.length > 300;

    // If it looks good, use as-is
    if (hasEvaluationKeywords && hasStructure && isLongEnough) {
      console.log('[LLM] Criteria appears suitable for direct use');
      return {
        suitable: true,
        convertedText: criteriaText,
        originalText: criteriaText,
        message: 'Criteria format looks good and can be used directly.'
      };
    }

    // If in test mode, skip AI conversion
    if (isTestMode()) {
      console.log('[LLM] Test mode - skipping AI conversion');
      return {
        suitable: false,
        convertedText: criteriaText,
        originalText: criteriaText,
        message: 'Test mode: Using criteria as-is without AI conversion.'
      };
    }

    // Use AI to convert
    console.log('[LLM] Converting criteria using AI...');
    if (onProgress) {
      onProgress({ type: 'status', content: 'Converting criteria to evaluation format...' });
    }

    try {
      // Get active profile first to check if API key is needed
      const activeProfile = window.APIConfig.getActiveProfile();
      const needsAPIKey = activeProfile.requiresAPIKey !== false;

      // Only validate API key if profile requires it
      let apiKey = '';
      if (needsAPIKey) {
        apiKey = getAPIKey();
        if (!apiKey) {
          throw new Error('API key required for criteria conversion');
        }
      }

      const model = getSelectedModel();

      const systemPrompt = `You are an expert in Data Management Plan (DMP) evaluation. Your task is to convert any DMP-related document, guidelines, or requirements into a clear, structured set of evaluation criteria.

The output should be formatted as evaluation criteria that can be used to assess a DMP, including:
- Clear criterion names/categories
- Specific aspects to evaluate
- What to look for in each area
- Expected standards or requirements

Structure the criteria logically with numbered sections and subsections.`;

      const userPrompt = `Convert the following text into structured DMP evaluation criteria:

${criteriaText}

Create comprehensive evaluation criteria that cover all important aspects mentioned in the text. Format as a structured document with clear sections, specific evaluation points, and actionable guidance.`;

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

      // Make API call
      const response = await retryWithBackoff(async () => {
        return fetch(fetchConfig.url, fetchConfig.options);
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const convertedText = data.choices[0]?.message?.content;

      if (!convertedText) {
        throw new Error('No content in API response');
      }

      console.log('[LLM] Criteria converted successfully');
      return {
        suitable: false,
        convertedText: convertedText,
        originalText: criteriaText,
        message: 'Criteria have been converted to evaluation format using AI.'
      };

    } catch (error) {
      console.error('[LLM] Error converting criteria:', error);
      // Fall back to using original text
      return {
        suitable: false,
        convertedText: criteriaText,
        originalText: criteriaText,
        message: `Could not convert criteria (${error.message}). Using original text.`,
        error: true
      };
    }
  }

  // Export public API
  window.LLMService = {
    evaluateDMP,
    buildEvaluationPrompt,
    detectAndConvertCriteria,
    getSelectedModel,
    getAPIKey,
    isTestMode,
    estimateTokens,
    // Prompt editor functions
    loadPromptFromStorage,
    savePromptToStorage,
    getDefaultPrompt
  };

})(window);
