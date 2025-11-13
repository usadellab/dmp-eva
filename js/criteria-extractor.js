// =============================================================================
// CRITERIA EXTRACTOR MODULE
// Extracts evaluation criteria from DMP evaluation documents (Table 2)
// =============================================================================

(function(window) {
  'use strict';

  /**
   * Default evaluation criteria text (based on Science Europe DMP guidelines)
   */
  const DEFAULT_CRITERIA_TEXT = `# DMP Evaluation Criteria

## Data Management Plan Evaluation Framework

Evaluate the Data Management Plan based on the following criteria. Assess whether the information provided is sufficient for the current project stage.

### 1. DATA DESCRIPTION AND COLLECTION

**1a. Data Collection or Re-use**
- For new data: Describe data in scientific and technical context, specify methods/tools/instruments, justify new collection
- For reused data: Describe type/scope/relevance, explain purpose, mention sources and permissions

**1b. Data Types, Formats, and Volumes**
- List expected data types and formats (open vs. proprietary)
- Estimate volumes (size/number of files)
- Justify proprietary formats if used

### 2. DOCUMENTATION AND DATA QUALITY

**2a. Metadata and Documentation Standards**
- Describe types of metadata (descriptive and process-related)
- List suitable community metadata standards
- Mention tools/platforms for metadata management
- Specify metadata storage formats

**2b. Data Quality Control**
- Describe quality assurance procedures
- Outline version control and change tracking
- Document consistency checks and validation methods

### 3. STORAGE AND BACKUP

**3a. Storage and Backup Procedures**
- Provide storage concept (location, infrastructure)
- Explain backup/versioning procedures and frequency
- Document institutional IT/RDM support

**3b. Data Access Management**
- Identify who needs access during project
- Note access restrictions and reasons
- Outline access granting and documentation methods

**3c. Data Security and Protection**
- Identify sensitive/personal/confidential data
- Describe security approach (encryption, secured storage)
- Mention relevant data protection policies (GDPR compliance)
- Specify responsible offices/support services

### 4. LEGAL AND ETHICAL REQUIREMENTS

**4a. Personal Data and GDPR Compliance**
- Describe legal basis for processing (GDPR Article 6)
- Confirm data controller/processor roles
- Document pseudonymization/anonymization plans
- Reference Data Protection Officer involvement

**4b. Intellectual Property Rights**
- Identify data outputs subject to IPR
- Describe ownership and access rights
- Mention collaboration/IP agreements
- Summarize relevant legal frameworks

**4c. Ethical Requirements**
- Document ethics approval needs and status
- List responsible persons and procedures
- Reference relevant codes of conduct

### 5. DATA SHARING AND PRESERVATION

**5a. Data Sharing Plans**
- Describe what, where, and when data will be shared
- Explain restrictions or embargo reasons
- Specify licenses for reuse (e.g., CC BY, CC0)

**5b. Long-term Preservation**
- Describe criteria for selecting data to preserve
- Name specific repositories or archives
- State planned retention period (typically 10+ years)

**5c. Access Methods and Tools**
- List file formats for preservation (prefer open formats)
- Document tools/software needed for access
- Provide alternatives for proprietary tools

**5d. Persistent Identifiers**
- Ensure plan includes PIDs (DOIs) linked with metadata
- Support findability, citation, and reuse

### 6. DATA MANAGEMENT RESPONSIBILITIES

**6a. Roles and Responsibilities**
- List stakeholders and their data management roles
- Assign responsibilities for key tasks
- Address post-project maintenance

**6b. Resources for FAIR Data**
- Estimate human, financial, and technical resources
- Identify institutional/external support
- Document RDM training and infrastructure

## Evaluation Guidelines

Rate each criterion on a scale of 0-100:
- 0-30: Poor - Major deficiencies, insufficient information
- 31-60: Fair - Basic information present but incomplete
- 61-85: Good - Adequate information with minor gaps
- 86-100: Excellent - Comprehensive, well-documented, exceeds expectations

Provide constructive feedback highlighting strengths and areas for improvement.`;

  /**
   * Category definitions for DMP evaluation criteria
   */
  const CATEGORY_DEFINITIONS = {
    '1a': 'Data Description and Collection or Re-use',
    '1b': 'Data Types, Formats, and Volumes',
    '2a': 'Metadata and Documentation Standards',
    '2b': 'Data Quality Control Measures',
    '3a': 'Storage and Backup',
    '3b': 'Data Access Management',
    '3c': 'Data Security and Protection',
    '4a': 'Personal Data and GDPR Compliance',
    '4b': 'Intellectual Property Rights and Ownership',
    '4c': 'Ethical Requirements and Approvals',
    '5a': 'Data Sharing Plans and Restrictions',
    '5b': 'Data Preservation and Archiving',
    '5c': 'Access Methods and Software Tools',
    '5d': 'Persistent Identifiers (PIDs)',
    '6a': 'Data Management Roles and Responsibilities',
    '6b': 'Resources for FAIR Data Management'
  };

  /**
   * Extract criteria from markdown text
   * @param {string} text - Markdown text containing Table 2
   * @param {string} phase - Project phase: 'proposal', 'mid', or 'end'
   * @returns {Object} - Structured criteria object
   */
  function extractCriteria(text, phase = 'proposal') {
    console.log('[Criteria Extractor] Extracting criteria for phase:', phase);

    // Find Table 2 section
    const table2Start = text.indexOf('Table 2');
    if (table2Start === -1) {
      console.warn('[Criteria Extractor] Table 2 not found, using default criteria');
      return getDefaultCriteria(phase);
    }

    // Extract the table portion (from Table 2 to next major section)
    const tableEnd = text.indexOf('\n# ', table2Start + 1);
    const tableText = tableEnd > -1 ? text.substring(table2Start, tableEnd) : text.substring(table2Start);

    // Parse table rows
    const criteria = parseTableRows(tableText, phase);

    if (criteria.categories.length === 0) {
      console.warn('[Criteria Extractor] No criteria extracted, using defaults');
      return getDefaultCriteria(phase);
    }

    console.log(`[Criteria Extractor] Extracted ${criteria.categories.length} criteria categories`);
    return criteria;
  }

  /**
   * Parse table rows and extract criteria based on phase
   * @param {string} tableText - Table text
   * @param {string} phase - Project phase
   * @returns {Object} - Criteria object
   */
  function parseTableRows(tableText, phase) {
    const lines = tableText.split('\n');
    const categories = [];

    // Column index based on phase (0=proposal, 1=mid, 2=end)
    const phaseColumnMap = {
      'proposal': 0,
      'mid': 1,
      'end': 2
    };
    const columnIndex = phaseColumnMap[phase] || 0;

    // Track current category
    let currentCategory = null;
    let currentCategoryId = null;

    for (const line of lines) {
      // Skip header and separator rows
      if (line.includes('Proposal/Early Stage') || line.match(/^\|\s*-+\s*\|/)) {
        continue;
      }

      // Check if this is a table row
      if (!line.startsWith('|')) {
        continue;
      }

      // Split by pipe and clean
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);

      if (cells.length < 3) {
        continue;
      }

      // Check if first cell contains a category marker (e.g., "1a", "2b")
      const firstCell = cells[0];
      const categoryMatch = firstCell.match(/(\d+[a-z])\s*/i);

      if (categoryMatch) {
        currentCategoryId = categoryMatch[1].toLowerCase();

        // Extract category name from first cell
        const categoryName = CATEGORY_DEFINITIONS[currentCategoryId] || extractCategoryName(firstCell);

        // Get description based on phase column
        let description = cells[columnIndex] || cells[0];

        // Clean up description
        description = cleanDescription(description, currentCategoryId);

        if (description && description.length > 10) {
          categories.push({
            id: currentCategoryId,
            name: categoryName,
            description: description
          });
        }
      } else if (currentCategoryId && cells[columnIndex]) {
        // This is a continuation row for the current category
        const additionalText = cleanDescription(cells[columnIndex]);
        if (additionalText && additionalText.length > 10) {
          const lastCategory = categories[categories.length - 1];
          if (lastCategory && lastCategory.id === currentCategoryId) {
            lastCategory.description += '\n\n' + additionalText;
          }
        }
      }
    }

    return {
      phase: phase,
      categories: categories
    };
  }

  /**
   * Extract category name from cell text
   * @param {string} cellText - Cell text
   * @returns {string} - Category name
   */
  function extractCategoryName(cellText) {
    // Remove category ID and extract the main question
    const withoutId = cellText.replace(/^\d+[a-z]?\s*/i, '');

    // Find the first question or sentence
    const questionMatch = withoutId.match(/^([^\n]+\?)/);
    if (questionMatch) {
      return questionMatch[1].trim();
    }

    // Take first line or first 100 chars
    const firstLine = withoutId.split('\n')[0];
    return firstLine.substring(0, 100).trim();
  }

  /**
   * Clean and format description text
   * @param {string} text - Raw description text
   * @param {string} categoryId - Category ID (optional)
   * @returns {string} - Cleaned description
   */
  function cleanDescription(text, categoryId = null) {
    if (!text) return '';

    let cleaned = text;

    // Remove category ID if it appears at the start
    if (categoryId) {
      cleaned = cleaned.replace(new RegExp(`^${categoryId}\\s*`, 'i'), '');
    }

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remove leading category markers like "1a" or "DATA DESCRIPTION"
    cleaned = cleaned.replace(/^\d+[a-z]?\s+/i, '');
    cleaned = cleaned.replace(/^\d+\s+[A-Z\s]+\d+[a-z]/i, '');

    return cleaned;
  }

  /**
   * Get default criteria when extraction fails
   * @param {string} phase - Project phase
   * @returns {Object} - Default criteria
   */
  function getDefaultCriteria(phase) {
    const phaseDescriptions = {
      'proposal': 'planned or proposed approach',
      'mid': 'current implementation and progress',
      'end': 'final outcomes and compliance'
    };

    const categories = Object.keys(CATEGORY_DEFINITIONS).map(id => ({
      id: id,
      name: CATEGORY_DEFINITIONS[id],
      description: `Evaluate the ${phaseDescriptions[phase]} for ${CATEGORY_DEFINITIONS[id].toLowerCase()}.`
    }));

    return {
      phase: phase,
      categories: categories
    };
  }

  /**
   * Validate extracted criteria
   * @param {Object} criteria - Criteria object
   * @returns {Object} - {valid: boolean, message: string}
   */
  function validateCriteria(criteria) {
    if (!criteria) {
      return { valid: false, message: 'No criteria provided' };
    }

    if (!criteria.categories || !Array.isArray(criteria.categories)) {
      return { valid: false, message: 'Invalid criteria structure: missing categories array' };
    }

    if (criteria.categories.length === 0) {
      return { valid: false, message: 'No evaluation categories found' };
    }

    // Check that each category has required fields
    for (const cat of criteria.categories) {
      if (!cat.id || !cat.name || !cat.description) {
        return { valid: false, message: `Invalid category structure: missing id, name, or description` };
      }
    }

    return { valid: true, message: `${criteria.categories.length} categories loaded successfully` };
  }

  /**
   * Format criteria for display
   * @param {Object} criteria - Criteria object
   * @returns {string} - Formatted text
   */
  function formatCriteriaForDisplay(criteria) {
    if (!criteria || !criteria.categories) {
      return 'No criteria loaded';
    }

    let output = `Evaluation Criteria (${criteria.phase} phase)\n\n`;

    criteria.categories.forEach(cat => {
      output += `${cat.id}. ${cat.name}\n`;
      output += `${cat.description}\n\n`;
    });

    return output;
  }

  /**
   * Get summary statistics for criteria
   * @param {Object} criteria - Criteria object
   * @returns {Object} - Statistics
   */
  function getCriteriaStats(criteria) {
    if (!criteria || !criteria.categories) {
      return { total: 0, avgDescriptionLength: 0 };
    }

    const total = criteria.categories.length;
    const totalChars = criteria.categories.reduce((sum, cat) => sum + cat.description.length, 0);

    return {
      total: total,
      avgDescriptionLength: Math.round(totalChars / total),
      phase: criteria.phase
    };
  }

  // Export public API
  window.CriteriaExtractor = {
    extractCriteria,
    validateCriteria,
    formatCriteriaForDisplay,
    getCriteriaStats,
    getDefaultCriteria,
    CATEGORY_DEFINITIONS,
    DEFAULT_CRITERIA_TEXT
  };

})(window);
