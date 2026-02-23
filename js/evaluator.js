// =============================================================================
// EVALUATOR MODULE
// Orchestrates the DMP evaluation process
// =============================================================================

(function(window) {
  'use strict';

  /**
   * Main evaluation orchestrator
   * @param {File} criteriaFile - Evaluation criteria file
   * @param {File} dmpFile - DMP document file
   * @param {string} phase - Project phase (proposal/mid/end)
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Evaluation results
   */
  async function evaluate(criteriaFile, dmpFile, phase, onProgress = null) {
    try {
      // Step 1: Parse criteria file
      const isDocCriteria = criteriaFile.name.toLowerCase().endsWith('.doc');
      updateProgress(onProgress, isDocCriteria ? 'Extracting .doc file with AI...' : 'Parsing evaluation criteria...');
      const criteriaData = await window.FileParser.parseFile(criteriaFile);
      const criteria = window.CriteriaExtractor.extractCriteria(criteriaData.text, phase);

      // Validate criteria
      const criteriaValidation = window.CriteriaExtractor.validateCriteria(criteria);
      if (!criteriaValidation.valid) {
        throw new Error(`Invalid criteria: ${criteriaValidation.message}`);
      }

      console.log('[Evaluator] Criteria loaded:', criteriaValidation.message);
      updateProgress(onProgress, `Criteria loaded: ${criteria.categories.length} categories`);

      // Step 2: Parse DMP file
      const isDocDmp = dmpFile.name.toLowerCase().endsWith('.doc');
      updateProgress(onProgress, isDocDmp ? 'Extracting .doc file with AI...' : 'Parsing DMP document...');
      const dmpData = await window.FileParser.parseFile(dmpFile);

      console.log('[Evaluator] DMP document parsed:', dmpData.name);
      updateProgress(onProgress, `DMP document parsed: ${window.FileParser.formatFileSize(dmpData.size)}`);

      // Check DMP size
      if (dmpData.text.length < 100) {
        throw new Error('DMP document is too short. Please provide a complete DMP.');
      }

      // Step 3: Build evaluation prompt
      updateProgress(onProgress, 'Building evaluation prompt...');
      const prompts = window.LLMService.buildEvaluationPrompt(criteria, dmpData.text, phase);

      console.log('[Evaluator] Prompt built, token estimate:',
        window.LLMService.estimateTokens(prompts.systemPrompt + prompts.userPrompt));

      // Step 4: Call LLM for evaluation
      updateProgress(onProgress, 'Evaluating DMP with AI...');
      const results = await window.LLMService.evaluateDMP(
        prompts.systemPrompt,
        prompts.userPrompt,
        (msg) => {
          // Pass messages through directly
          // LLM service now sends consistent object format
          updateProgress(onProgress, msg);
        }
      );

      // Step 5: Process and validate results
      updateProgress(onProgress, 'Processing results...');
      const processedResults = processResults(results, criteria, dmpData.text);

      console.log('[Evaluator] Evaluation complete. Overall score:', processedResults.overallScore);
      updateProgress(onProgress, 'Evaluation complete!');

      return {
        success: true,
        results: processedResults,
        metadata: {
          criteriaFile: criteriaFile.name,
          dmpFile: dmpFile.name,
          phase: phase,
          evaluationDate: new Date().toISOString(),
          model: window.LLMService.getSelectedModel()
        }
      };

    } catch (error) {
      console.error('[Evaluator] Error:', error);
      return {
        success: false,
        error: error.message,
        metadata: {
          criteriaFile: criteriaFile?.name,
          dmpFile: dmpFile?.name,
          phase: phase,
          evaluationDate: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Process and validate evaluation results
   * @param {Object} rawResults - Raw results from LLM
   * @param {Object} criteria - Original criteria
   * @param {string} originalDMPText - Original DMP text (optional)
   * @returns {Object} - Processed results
   */
  function processResults(rawResults, criteria, originalDMPText = '') {
    // Detect and expand compact format
    const expandedResults = expandCompactFormat(rawResults);

    // Ensure all required fields exist
    const processed = {
      overallScore: 0,
      categories: [],
      sentenceEvaluations: [],
      originalDMPText: originalDMPText
    };

    // Process sentence evaluations
    if (expandedResults.sentenceEvaluations && Array.isArray(expandedResults.sentenceEvaluations)) {
      processed.sentenceEvaluations = expandedResults.sentenceEvaluations.map(se => ({
        sentence: se.sentence || '',
        criteriaIds: se.criteriaIds || [],
        score: Math.min(100, Math.max(0, se.score || 0)),
        explanation: se.explanation || 'No explanation provided',
        suggestion: se.suggestion || null
      }));
    }

    // Calculate category scores from sentence evaluations
    const categoryScores = {};
    const categoryExplanations = {};
    processed.sentenceEvaluations.forEach(se => {
      se.criteriaIds.forEach(cid => {
        if (!categoryScores[cid]) {
          categoryScores[cid] = [];
          categoryExplanations[cid] = [];
        }
        categoryScores[cid].push(se.score);
        if (se.explanation) {
          categoryExplanations[cid].push(se.explanation);
        }
      });
    });

    // Build categories from criteria and sentence scores
    if (criteria && criteria.categories) {
      processed.categories = criteria.categories.map(critCat => {
        const scores = categoryScores[critCat.id] || [];
        const calculatedScore = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

        const status = determineStatus(calculatedScore);

        // Generate feedback from sentence explanations
        const feedback = generateCategoryFeedback(critCat.id, critCat.name, calculatedScore, categoryExplanations[critCat.id] || []);

        return {
          id: critCat.id,
          name: critCat.name,
          score: calculatedScore,
          status: status,
          feedback: feedback
        };
      });
    }

    // Calculate overall score from category scores
    if (processed.categories.length > 0) {
      const validCategories = processed.categories.filter(c => c.score > 0);
      if (validCategories.length > 0) {
        const sum = validCategories.reduce((acc, cat) => acc + cat.score, 0);
        processed.overallScore = Math.round(sum / validCategories.length);
      }
    }

    // Sort categories by ID
    processed.categories.sort((a, b) => {
      const aNum = parseInt(a.id);
      const bNum = parseInt(b.id);
      if (aNum !== bNum) return aNum - bNum;
      return a.id.localeCompare(b.id);
    });

    return processed;
  }

  /**
   * Expand compact format to full format
   * Handles multiple formats from different models:
   * 1. Compact array format: {"s": [["sentence", ["1a"], 90, "explanation"]]}
   * 2. Object format: {"s": [{"sentence": "...", "criteriaIds": ["1a"], "score": 90, ...}]}
   * 3. Ministral format: [{"s": [["sentence", [1a]]], "score": 90, "explanation": "..."}]
   * @param {Object|Array} compact - Compact format results
   * @returns {Object} - Expanded results
   */
  function expandCompactFormat(compact) {
    // Handle Ministral format: array at top level with nested s/score/explanation
    if (Array.isArray(compact)) {
      console.log('[Evaluator] Detected Ministral array format, normalizing...');
      const sentenceEvaluations = [];

      compact.forEach(item => {
        if (item.s && Array.isArray(item.s)) {
          item.s.forEach(sItem => {
            // sItem can be ["sentence", [criteriaIds]] or ["sentence", criteriaId]
            const sentence = Array.isArray(sItem) ? sItem[0] : sItem;
            const criteriaIds = Array.isArray(sItem) && Array.isArray(sItem[1])
              ? sItem[1].map(id => typeof id === 'string' ? id : String(id))
              : (Array.isArray(sItem) && sItem[1] ? [String(sItem[1])] : []);

            sentenceEvaluations.push({
              sentence: sentence || '',
              criteriaIds: criteriaIds,
              score: typeof item.score === 'number' ? item.score : 0,
              explanation: item.explanation || 'No explanation provided',
              suggestion: item.suggestion || null
            });
          });
        }
      });

      return {
        sentenceEvaluations,
        categories: [],
        overallScore: 0
      };
    }

    // Handle new compact format (s for sentences only)
    if (compact.s && Array.isArray(compact.s)) {
      console.log('[Evaluator] Detected compact format, expanding...');

      // Check if first item is an object (object format from smaller models)
      // or an array (compact format from larger models)
      const firstItem = compact.s[0];
      if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        // Object format - already has named properties
        console.log('[Evaluator] Detected object format (from smaller model), normalizing...');
        return {
          sentenceEvaluations: compact.s.map(item => {
            // Normalize criteriaIds to array (handle single string like "1a" -> ["1a"])
            let criteriaIds = item.criteriaIds;
            if (typeof criteriaIds === 'string') {
              criteriaIds = [criteriaIds];
            } else if (!Array.isArray(criteriaIds)) {
              criteriaIds = [];
            }
            return {
              sentence: item.sentence || '',
              criteriaIds: criteriaIds,
              score: typeof item.score === 'number' ? item.score : 0,
              explanation: item.explanation || 'No explanation provided',
              suggestion: item.suggestion || null
            };
          }),
          categories: compact.c ? compact.c.map(item => ({
            id: item[0],
            name: item[1],
            score: item[2],
            status: expandStatus(item[3]),
            feedback: item[4],
            suggestion: item[5] || null
          })) : [],
          overallScore: 0
        };
      }

      // Compact array format
      return {
        sentenceEvaluations: compact.s.map(item => {
          // Normalize criteriaIds to array (handle single string like "1a" -> ["1a"])
          let criteriaIds = item[1];
          if (typeof criteriaIds === 'string') {
            criteriaIds = [criteriaIds];
          } else if (!Array.isArray(criteriaIds)) {
            criteriaIds = [];
          }
          return {
            sentence: item[0],
            criteriaIds: criteriaIds,
            score: item[2],
            explanation: item[3],
            suggestion: item[4] || null
          };
        }),
        categories: compact.c ? compact.c.map(item => ({
          id: item[0],
          name: item[1],
          score: item[2],
          status: expandStatus(item[3]),
          feedback: item[4],
          suggestion: item[5] || null
        })) : [],
        overallScore: 0
      };
    }
    // Fallback to original format (backward compatibility)
    return compact;
  }

  /**
   * Expand status code to full status name
   * @param {string} code - Status code (e/g/p/i)
   * @returns {string} - Full status name
   */
  function expandStatus(code) {
    const map = {
      'e': 'excellent',
      'g': 'good',
      'p': 'pass',
      'i': 'insufficient'
    };
    return map[code] || code;
  }

  /**
   * Generate category feedback from sentence explanations
   * @param {string} categoryId - Category ID
   * @param {string} categoryName - Category name
   * @param {number} score - Calculated score
   * @param {Array<string>} explanations - Array of sentence explanations
   * @returns {string} - Generated feedback
   */
  function generateCategoryFeedback(categoryId, categoryName, score, explanations) {
    if (explanations.length === 0) {
      return 'No relevant content found in DMP for this criterion.';
    }

    // Combine unique explanations (avoid repetition)
    const uniqueExplanations = [...new Set(explanations)].slice(0, 3);

    if (score >= 90) {
      return `Excellent coverage of ${categoryName.toLowerCase()}. ${uniqueExplanations.join(' ')}`;
    } else if (score >= 75) {
      return `Good coverage of ${categoryName.toLowerCase()}. ${uniqueExplanations.join(' ')}`;
    } else if (score >= 60) {
      return `Adequate coverage of ${categoryName.toLowerCase()}, but could be improved. ${uniqueExplanations.join(' ')}`;
    } else {
      return `Insufficient coverage of ${categoryName.toLowerCase()}. ${uniqueExplanations.join(' ')}`;
    }
  }

  /**
   * Determine status label based on score
   * @param {number} score - Score (0-100)
   * @returns {string} - Status label
   */
  function determineStatus(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'pass';
    return 'insufficient';
  }

  /**
   * Update progress callback
   * @param {Function} callback - Progress callback
   * @param {string|Object} message - Progress message or streaming object
   */
  function updateProgress(callback, message) {
    if (callback && typeof callback === 'function') {
      callback(message);
    }
    // Only log non-streaming messages to avoid console spam
    // Stream messages are objects with type: 'stream'
    if (typeof message === 'string' || (message && message.type !== 'stream')) {
      console.log('[Progress]', message);
    }
  }

  /**
   * Get score color class
   * @param {number} score - Score (0-100)
   * @returns {string} - CSS class name
   */
  function getScoreColorClass(score) {
    if (score >= 90) return 'score-excellent';
    if (score >= 75) return 'score-good';
    if (score >= 60) return 'score-pass';
    return 'score-insufficient';
  }

  /**
   * Get score status badge class
   * @param {string} status - Status (excellent/good/pass/insufficient)
   * @returns {string} - CSS class name
   */
  function getStatusBadgeClass(status) {
    const map = {
      'excellent': 'bg-success',
      'good': 'bg-info',
      'pass': 'bg-warning',
      'insufficient': 'bg-danger'
    };
    return map[status] || 'bg-secondary';
  }

  /**
   * Get progress bar color class
   * @param {number} score - Score (0-100)
   * @returns {string} - Bootstrap color class
   */
  function getProgressBarClass(score) {
    if (score >= 90) return 'bg-success';
    if (score >= 75) return 'bg-info';
    if (score >= 60) return 'bg-warning';
    return 'bg-danger';
  }

  /**
   * Generate summary statistics
   * @param {Object} results - Evaluation results
   * @returns {Object} - Summary statistics
   */
  function generateSummary(results) {
    if (!results || !results.categories) {
      return null;
    }

    const categories = results.categories;
    const scores = categories.map(c => c.score);

    const statusCounts = {
      excellent: categories.filter(c => c.status === 'excellent').length,
      good: categories.filter(c => c.status === 'good').length,
      pass: categories.filter(c => c.status === 'pass').length,
      insufficient: categories.filter(c => c.status === 'insufficient').length
    };

    return {
      overallScore: results.overallScore,
      totalCategories: categories.length,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      maxScore: Math.max(...scores),
      minScore: Math.min(...scores),
      statusCounts: statusCounts,
      strengths: categories.filter(c => c.score >= 80),
      weaknesses: categories.filter(c => c.score < 60)
    };
  }

  // Export public API
  window.Evaluator = {
    evaluate,
    processResults,
    determineStatus,
    getScoreColorClass,
    getStatusBadgeClass,
    getProgressBarClass,
    generateSummary
  };

})(window);
