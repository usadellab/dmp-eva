// =============================================================================
// LLM SERVICE MODULE FOR DMP EVALUATION
// Handles Together.AI API integration
// =============================================================================

(function(window) {
  'use strict';

  const DEFAULT_MODEL = 'Qwen/Qwen3-235B-A22B-Instruct-2507-tput';

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
   * Test data for DMP evaluation (bypasses API calls)
   */
  const TEST_EVALUATION_DATA = {
    overallScore: 75,
    categories: [
      {
        id: '1a',
        name: 'Data Description and Collection',
        score: 80,
        status: 'good',
        feedback: 'The DMP provides good information about data types and formats. Genomic data is well-described with clear references to RNAseq and genetic analysis methods.'
      },
      {
        id: '1b',
        name: 'Data Updates',
        score: 70,
        status: 'fair',
        feedback: 'Some information about data collection methods is present, but could be more detailed regarding specific instruments and protocols.'
      },
      {
        id: '2a',
        name: 'Documentation and Metadata',
        score: 75,
        status: 'good',
        feedback: 'Metadata standards are mentioned with references to JSON-LD and community standards. Could benefit from more specific examples.'
      },
      {
        id: '2b',
        name: 'Data Quality',
        score: 65,
        status: 'fair',
        feedback: 'Quality control measures are mentioned but lack detail. Consider adding specific QA/QC procedures and validation steps.'
      },
      {
        id: '3a',
        name: 'Storage Solutions',
        score: 85,
        status: 'good',
        feedback: 'Storage solutions are well-defined with institutional repositories mentioned. Clear backup procedures outlined.'
      },
      {
        id: '3b',
        name: 'Data Security',
        score: 70,
        status: 'fair',
        feedback: 'Basic security measures mentioned. Consider adding more details about encryption, access control, and GDPR compliance.'
      },
      {
        id: '4a',
        name: 'Legal and Ethical Requirements',
        score: 60,
        status: 'fair',
        feedback: 'Ethical considerations are addressed but lack specific references to GDPR Articles or ethics approval numbers.'
      },
      {
        id: '4b',
        name: 'IPR and Ownership',
        score: 75,
        status: 'good',
        feedback: 'Intellectual property rights are clearly stated with consortium agreements mentioned.'
      },
      {
        id: '5a',
        name: 'Data Sharing Plans',
        score: 80,
        status: 'good',
        feedback: 'Data sharing plans are comprehensive with repository selection and embargo periods clearly defined.'
      },
      {
        id: '5b',
        name: 'Long-term Preservation',
        score: 85,
        status: 'excellent',
        feedback: 'Excellent preservation strategy with DOI assignment and 10+ year retention period specified.'
      },
      {
        id: '6a',
        name: 'Roles and Responsibilities',
        score: 70,
        status: 'fair',
        feedback: 'Key roles identified but could benefit from more specific assignment of data management tasks.'
      },
      {
        id: '6b',
        name: 'Resources',
        score: 65,
        status: 'fair',
        feedback: 'Resource allocation mentioned but needs more detail on budget, personnel time, and infrastructure.'
      }
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

      // Common fixes
      let repaired = jsonStr;

      // Remove markdown code blocks if present
      repaired = repaired.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      // Fix trailing commas
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

      // Fix missing quotes on keys
      repaired = repaired.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

      try {
        return JSON.parse(repaired);
      } catch (e2) {
        console.error('[JSON Repair] Repair failed:', e2);
        return null;
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

    // Validate API key
    const apiKey = getAPIKey();
    if (!apiKey) {
      throw new Error('Together AI API key not configured. Please enter your API key.');
    }

    const model = getSelectedModel();
    console.log(`[LLM] Evaluating DMP with model: ${model}`);
    console.log(`[LLM] Prompt size: ~${estimateTokens(systemPrompt + userPrompt)} tokens`);

    if (onProgress) {
      onProgress({ type: 'status', content: `Calling ${model}...` });
    }

    // Get active API profile
    const activeProfile = window.APIConfig.getActiveProfile();

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
   * @param {Object} criteria - Extracted evaluation criteria
   * @param {string} dmpText - DMP document text
   * @param {string} phase - Project phase (proposal/mid/end)
   * @returns {Object} - {systemPrompt, userPrompt}
   */
  function buildEvaluationPrompt(criteria, dmpText, phase) {
    const systemPrompt = `You are an expert Data Management Plan (DMP) evaluator for ${phase === 'proposal' ? 'proposal/early stage' : phase === 'mid' ? 'mid-project' : 'end-project'} research projects.

Your task is to evaluate a DMP document against standardized criteria and provide:
1. Quantitative scores (0-100) for each criterion
2. Qualitative feedback highlighting strengths and areas for improvement

Scoring guidance:
- 90-100: Excellent - Fully addresses criterion with exemplary detail
- 75-89: Good - Adequately addresses criterion with minor gaps
- 60-74: Fair - Partially addresses criterion with notable gaps
- 0-59: Poor - Does not adequately address criterion

You must return your evaluation as a JSON object with this exact structure:
{
  "overallScore": <number 0-100>,
  "categories": [
    {
      "id": "<criterion ID like 1a, 2b, etc>",
      "name": "<criterion name>",
      "score": <number 0-100>,
      "status": "<excellent|good|fair|poor>",
      "feedback": "<detailed feedback string>"
    }
  ]
}`;

    const criteriaText = criteria.categories.map(cat => {
      return `**${cat.id}: ${cat.name}**\n${cat.description}`;
    }).join('\n\n');

    const userPrompt = `Please evaluate the following Data Management Plan for the ${phase} phase.

## EVALUATION CRITERIA

${criteriaText}

## DMP DOCUMENT TO EVALUATE

${dmpText}

## INSTRUCTIONS

1. Evaluate the DMP against each criterion listed above
2. Assign a score (0-100) and status (excellent/good/fair/poor) for each criterion
3. Provide specific, actionable feedback for each criterion
4. Calculate an overall score as the average of all criteria scores
5. Return the evaluation as a JSON object following the specified structure`;

    return { systemPrompt, userPrompt };
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
      const apiKey = getAPIKey();
      if (!apiKey) {
        throw new Error('API key required for criteria conversion');
      }

      const model = getSelectedModel();
      const activeProfile = window.APIConfig.getActiveProfile();

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
    estimateTokens
  };

})(window);
