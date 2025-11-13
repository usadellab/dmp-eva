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
        (msg) => updateProgress(onProgress, `AI: ${msg}`)
      );

      // Step 5: Process and validate results
      updateProgress(onProgress, 'Processing results...');
      const processedResults = processResults(results, criteria);

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
   * @returns {Object} - Processed results
   */
  function processResults(rawResults, criteria) {
    // Ensure all required fields exist
    const processed = {
      overallScore: rawResults.overallScore || 0,
      categories: []
    };

    // Process each category
    if (rawResults.categories && Array.isArray(rawResults.categories)) {
      processed.categories = rawResults.categories.map(cat => {
        // Determine status based on score if not provided
        let status = cat.status || determineStatus(cat.score || 0);

        return {
          id: cat.id || 'unknown',
          name: cat.name || 'Unknown Category',
          score: Math.min(100, Math.max(0, cat.score || 0)), // Clamp to 0-100
          status: status,
          feedback: cat.feedback || 'No feedback provided'
        };
      });
    }

    // Recalculate overall score if missing or invalid
    if (!processed.overallScore || processed.overallScore === 0) {
      if (processed.categories.length > 0) {
        const sum = processed.categories.reduce((acc, cat) => acc + cat.score, 0);
        processed.overallScore = Math.round(sum / processed.categories.length);
      }
    }

    // Fill in missing categories from criteria
    const existingIds = new Set(processed.categories.map(c => c.id));
    criteria.categories.forEach(critCat => {
      if (!existingIds.has(critCat.id)) {
        console.warn(`[Evaluator] Missing evaluation for category ${critCat.id}, adding placeholder`);
        processed.categories.push({
          id: critCat.id,
          name: critCat.name,
          score: 0,
          status: 'poor',
          feedback: 'This criterion was not evaluated. Please review the DMP for this section.'
        });
      }
    });

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
   * Determine status label based on score
   * @param {number} score - Score (0-100)
   * @returns {string} - Status label
   */
  function determineStatus(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  /**
   * Update progress callback
   * @param {Function} callback - Progress callback
   * @param {string} message - Progress message
   */
  function updateProgress(callback, message) {
    if (callback && typeof callback === 'function') {
      callback(message);
    }
    console.log('[Progress]', message);
  }

  /**
   * Get score color class
   * @param {number} score - Score (0-100)
   * @returns {string} - CSS class name
   */
  function getScoreColorClass(score) {
    if (score >= 90) return 'score-excellent';
    if (score >= 75) return 'score-good';
    if (score >= 60) return 'score-fair';
    return 'score-poor';
  }

  /**
   * Get score status badge class
   * @param {string} status - Status (excellent/good/fair/poor)
   * @returns {string} - CSS class name
   */
  function getStatusBadgeClass(status) {
    const map = {
      'excellent': 'bg-success',
      'good': 'bg-info',
      'fair': 'bg-warning',
      'poor': 'bg-danger'
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
      fair: categories.filter(c => c.status === 'fair').length,
      poor: categories.filter(c => c.status === 'poor').length
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
