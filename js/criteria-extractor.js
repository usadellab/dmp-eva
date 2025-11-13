// =============================================================================
// CRITERIA EXTRACTOR MODULE
// Extracts evaluation criteria from DMP evaluation documents (Table 2)
// =============================================================================

(function(window) {
  'use strict';

  /**
   * Phase-specific default evaluation criteria (based on Science Europe Table 2)
   */
  const DEFAULT_CRITERIA_BY_PHASE = {
    proposal: `# DMP Evaluation Criteria - Proposal/Early Stage

## Data Management Plan Evaluation Framework

Evaluate the Data Management Plan for the **Proposal/Early Stage**. Focus on planned approaches and initial strategies.

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

Provide constructive feedback highlighting strengths and areas for improvement.`,

    mid: `# DMP Evaluation Criteria - Mid-Project

## Data Management Plan Evaluation Framework

Evaluate the Data Management Plan for **Mid-Project**. Assess both initial plans (from early stage) and current implementation progress.

### 1. DATA DESCRIPTION AND COLLECTION

**1a. Data Collection or Re-use**
- **Early Stage (Monitor):** Planned data collection/reuse approach
- **Mid-Project (Assess):** Confirm data types produced/reused so far, update formats and tools, note changes, include data provenance information

**1b. Data Types, Formats, and Volumes**
- **Early Stage (Monitor):** Expected data types, formats, volumes
- **Mid-Project (Assess):** Monitor RDM pipelines, provide technical updates on actual volumes/types/formats, describe data conversion strategies

### 2. DOCUMENTATION AND DATA QUALITY

**2a. Metadata and Documentation Standards**
- **Early Stage (Monitor):** Planned metadata types and standards
- **Mid-Project (Assess):** Report which metadata standards/tools are being used, describe ongoing QA/QC procedures, explain rationale for standards selection

**2b. Data Quality Control**
- **Early Stage (Monitor):** Planned quality assurance approach
- **Mid-Project (Assess):** Report which measures were taken to ensure data quality

### 3. STORAGE AND BACKUP

**3a. Storage and Backup Procedures**
- **Early Stage (Monitor):** Planned storage concept
- **Mid-Project (Assess):** Report where data/metadata are actually stored, document active backup procedures, describe organizational structure

**3b. Data Access Management**
- **Early Stage (Monitor):** Expected access needs
- **Mid-Project (Assess):** Update list of current users, specify access levels, confirm permissions are actively managed

**3c. Data Security and Protection**
- **Early Stage (Monitor):** Planned security approach
- **Mid-Project (Assess):** Confirm sensitive data collected/processed, describe implemented security measures, report any security incidents

### 4. LEGAL AND ETHICAL REQUIREMENTS

**4a. Personal Data and GDPR Compliance**
- **Early Stage (Monitor):** Legal basis and planned safeguards
- **Mid-Project (Assess):** Confirm legal basis documented, confirm DPIA completion, describe implemented measures, list signed agreements

**4b. Intellectual Property Rights**
- **Early Stage (Monitor):** Anticipated IPR issues
- **Mid-Project (Assess):** Confirm IP clauses formalized, describe access rights management, confirm publication rights

**4c. Ethical Requirements**
- **Early Stage (Monitor):** Ethics approval needs
- **Mid-Project (Assess):** Confirm ethics approval obtained, summarize changes to ethical considerations

### 5. DATA SHARING AND PRESERVATION

**5a. Data Sharing Plans**
- **Early Stage (Monitor):** Planned sharing approach
- **Mid-Project (Assess):** Identify actual repositories used/selected, note updates to sharing timelines/formats

**5b. Long-term Preservation**
- **Early Stage (Monitor):** Planned preservation approach
- **Mid-Project (Assess):** Identify datasets planned for repository storage, report updates on selection criteria

**5c. Access Methods and Tools**
- **Early Stage (Monitor):** Planned file formats and tools
- **Mid-Project (Assess):** Update tools/software required, prioritize open-source tools, update file formats

**5d. Persistent Identifiers**
- **Early Stage (Monitor):** Plan for PIDs
- **Mid-Project (Assess):** Progress on PID implementation

### 6. DATA MANAGEMENT RESPONSIBILITIES

**6a. Roles and Responsibilities**
- **Early Stage (Monitor):** Assigned roles
- **Mid-Project (Assess):** Confirm actual roles and effort, identify bottlenecks, ensure replacement procedures

**6b. Resources for FAIR Data**
- **Early Stage (Monitor):** Estimated resources
- **Mid-Project (Assess):** Review actual resource allocation, monitor workload, assess sufficiency of provisions

## Evaluation Guidelines

Rate each criterion on a scale of 0-100 considering both planning and implementation:
- 0-30: Poor - Major deficiencies in planning or implementation
- 31-60: Fair - Basic planning exists but implementation lacking
- 61-85: Good - Good planning with adequate implementation progress
- 86-100: Excellent - Excellent planning and strong implementation progress

Provide constructive feedback on both adherence to plans and quality of implementation.`,

    end: `# DMP Evaluation Criteria - End-Project

## Data Management Plan Evaluation Framework

Evaluate the Data Management Plan for **End-Project**. Assess the complete lifecycle: initial plans, mid-project implementation, and final outcomes.

### 1. DATA DESCRIPTION AND COLLECTION

**1a. Data Collection or Re-use**
- **Early Stage (Review):** Initial planned approach
- **Mid-Project (Review):** Implementation progress
- **End-Project (Assess):** List final data types and formats collected/reused, provide justification for deviations from original plan

**1b. Data Types, Formats, and Volumes**
- **Early Stage (Review):** Initial expectations
- **Mid-Project (Review):** Actual implementation
- **End-Project (Assess):** Archive final complete technical documentation and metadata files, report on data fidelity for reuse

### 2. DOCUMENTATION AND DATA QUALITY

**2a. Metadata and Documentation Standards**
- **Early Stage (Review):** Planned standards
- **Mid-Project (Review):** Standards in use
- **End-Project (Assess):** Provide evidence of complete documentation, summarize QA outcomes, describe post-project metadata maintenance

**2b. Data Quality Control**
- **Early Stage (Review):** Planned QC approach
- **Mid-Project (Review):** QC implementation
- **End-Project (Assess):** Report on quality control measures taken, combine QC with ethical/legal/preservation requirements

### 3. STORAGE AND BACKUP

**3a. Storage and Backup Procedures**
- **Early Stage (Review):** Planned storage
- **Mid-Project (Review):** Actual storage
- **End-Project (Assess):** List final storage and backup arrangements for all project data and metadata

**3b. Data Access Management**
- **Early Stage (Review):** Expected access
- **Mid-Project (Review):** Current access
- **End-Project (Assess):** Provide final summary of project access, state how post-project access requests will be handled

**3c. Data Security and Protection**
- **Early Stage (Review):** Planned security
- **Mid-Project (Review):** Implemented security
- **End-Project (Assess):** Confirm sensitive data securely stored/anonymized/deleted, document final security configuration, summarize security obligations fulfilled

### 4. LEGAL AND ETHICAL REQUIREMENTS

**4a. Personal Data and GDPR Compliance**
- **Early Stage (Review):** Legal basis plans
- **Mid-Project (Review):** Implementation status
- **End-Project (Assess):** Confirm all measures implemented throughout lifecycle, describe data deletion/anonymization, confirm published outputs properly handled

**4b. Intellectual Property Rights**
- **Early Stage (Review):** IPR plans
- **Mid-Project (Review):** IP management
- **End-Project (Assess):** Confirm final ownership status, describe post-project access/reuse management, list registered IP

**4c. Ethical Requirements**
- **Early Stage (Review):** Ethics approval plans
- **Mid-Project (Review):** Ethics compliance
- **End-Project (Assess):** Confirm ethical issues fulfilled and documented, confirm published data complies with ethics approvals

### 5. DATA SHARING AND PRESERVATION

**5a. Data Sharing Plans**
- **Early Stage (Review):** Sharing plans
- **Mid-Project (Review):** Repository selection
- **End-Project (Assess):** Confirm datasets deposited with metadata/licenses/PIDs, specify reuse licenses, explain restrictions, specify timing/embargo

**5b. Long-term Preservation**
- **Early Stage (Review):** Preservation plans
- **Mid-Project (Review):** Repository preparation
- **End-Project (Assess):** Confirm datasets deposited in repository/archive with appropriate metadata/licenses/PIDs

**5c. Access Methods and Tools**
- **Early Stage (Review):** Planned formats/tools
- **Mid-Project (Review):** Format updates
- **End-Project (Assess):** Confirm preservation file formats listed, confirm required tools named, describe access mechanisms, include source code/workflows if applicable

**5d. Persistent Identifiers**
- **Early Stage (Review):** PID plans
- **Mid-Project (Review):** PID progress
- **End-Project (Assess):** Provide list of published datasets and their PIDs, ensure identifiers linked with metadata, note automation

### 6. DATA MANAGEMENT RESPONSIBILITIES

**6a. Roles and Responsibilities**
- **Early Stage (Review):** Assigned roles
- **Mid-Project (Review):** Role fulfillment
- **End-Project (Assess):** Finalize and document complete list of contributors, reflect on adequacy of responsibilities

**6b. Resources for FAIR Data**
- **Early Stage (Review):** Resource estimates
- **Mid-Project (Review):** Resource allocation
- **End-Project (Assess):** Summarize total resources spent and impact, evaluate cost-efficiency, provide final report on support

## Evaluation Guidelines

Rate each criterion on a scale of 0-100 considering the complete project lifecycle:
- 0-30: Poor - Failed to meet objectives across lifecycle
- 31-60: Fair - Partial achievement with significant gaps
- 61-85: Good - Met most objectives with minor shortcomings
- 86-100: Excellent - Exceeded objectives throughout lifecycle

Provide comprehensive feedback addressing planning, implementation, and final outcomes.`
  };

  /**
   * Default evaluation criteria text (generic fallback)
   */
  const DEFAULT_CRITERIA_TEXT = DEFAULT_CRITERIA_BY_PHASE.proposal; // Use proposal as default

  /**
   * Example DMP document text (for demonstration/testing)
   */
  const EXAMPLE_DMP_TEXT = `# Example Data Management Plan - Research Project

**Project Title:** Impact of Climate Change on Alpine Biodiversity
**Project Phase:** Proposal/Early Stage
**Principal Investigator:** Dr. Jane Smith
**Institution:** University Research Center
**Duration:** 36 months

## 1. Data Description and Collection

### 1a. Data Collection or Re-use
We will collect new observational data on alpine plant species diversity through field surveys across 50 sites in the European Alps using standardized ecological survey methods with GPS-enabled tablets and digital photography. We will also reuse historical biodiversity data from GBIF database for baseline comparisons spanning 50 years.

### 1b. Data Types, Formats, and Volumes
- Field observations: CSV format, ~10,000 records/year (5MB annually)
- Photographs: JPEG, ~5000 images/year (20GB annually)
- Environmental measurements: NetCDF format (2GB annually)
- GIS data: Shapefiles and GeoTIFF (500MB)

## 2. Documentation and Data Quality

### 2a. Metadata and Documentation Standards
We will implement Ecological Metadata Language (EML) for biodiversity observations and Darwin Core for field data. Metadata will include descriptive (title, PIs, funding) and process metadata (protocols, equipment). Tools: QGIS, Python scripts. Format: XML + PostgreSQL database.

### 2b. Data Quality Control
- Double-entry verification for 10% of observations
- Automated range checks
- Cross-validation with historical datasets
- Git version control for scripts
- MD5 checksums, regular backups

## 3. Storage and Backup

### 3a. Storage and Backup Procedures
Data stored on university secure file server (RAID-6). Daily incremental backups, weekly full backups retained one year. Field data uploaded within 48 hours. IT department provides 99.9% uptime. Allocation: 500GB expandable to 2TB.

### 3b. Data Access Management
- PIs: full access
- 3 PhD students: read/write to field data
- 2 data stewards: read-only QC
- External collaborators: secure FTP access
Managed via Active Directory with MFA. Quarterly access log reviews.

### 3c. Data Security and Protection
No personal data involved. Security measures: SFTP for transfers, restricted server room access, regular IT security updates, firewall and intrusion detection.

## 4. Legal and Ethical Requirements

### 4a. Personal Data and GDPR Compliance
No personal data processing - only plant species and environmental data.

### 4b. Intellectual Property Rights
University owns data per institutional policy. Collaborators retain rights to contributed data with clear sharing agreements. Standard academic authorship guidelines. No patents anticipated.

### 4c. Ethical Requirements
Ethics clearance: University Research Ethics Committee (#2024-BIO-089). Fieldwork permits for protected areas. No animal or human subjects.

## 5. Data Sharing and Preservation

### 5a. Data Sharing Plans
Public release within 12 months via GBIF, PANGAEA, and institutional repository. License: CC BY 4.0. Embargo: 12 months (observations), 24 months (photographs for atlas).

### 5b. Long-term Preservation
10+ year preservation in GBIF (indefinite), PANGAEA (10 years), University Archive (10 years). Preserved: finalized quality-controlled datasets, complete metadata, 10% raw photo samples.

### 5c. Access Methods and Tools
Formats: CSV, JPEG, GeoTIFF, Shapefile, NetCDF. Tools: R/Python (analysis), QGIS (GIS), standard spreadsheets. Scripts on GitHub (MIT License) with Jupyter notebooks.

### 5d. Persistent Identifiers
Each dataset receives DOI from respective repository (GBIF, PANGAEA, University). DOIs cited in all publications.

## 6. Data Management Responsibilities and Resources

### 6a. Roles and Responsibilities
- PI: Strategy, compliance, publication decisions
- Data Manager: Daily management, QC, metadata, submissions
- PhD students: Collection, entry, basic QC
- Data Steward: Advisory, reviews, guidance
- IT: Infrastructure, backups, security
Post-project: University RDM Service

### 6b. Resources for FAIR Data
- Data Manager: 0.5 FTE (€60,000)
- Data Steward: 20 hrs/year (institutional)
- Training: 40 hours (€2,000)
- Infrastructure: University-provided (no cost)
- Workshops: €1,800
**Total: €63,800 over 36 months (~7% budget)**`;

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

  /**
   * Get phase-specific default criteria text
   * @param {string} phase - Project phase (proposal, mid, end)
   * @returns {string} - Phase-specific criteria text
   */
  function getDefaultCriteriaText(phase) {
    return DEFAULT_CRITERIA_BY_PHASE[phase] || DEFAULT_CRITERIA_BY_PHASE.proposal;
  }

  // Export public API
  window.CriteriaExtractor = {
    extractCriteria,
    validateCriteria,
    formatCriteriaForDisplay,
    getCriteriaStats,
    getDefaultCriteria,
    getDefaultCriteriaText,
    CATEGORY_DEFINITIONS,
    DEFAULT_CRITERIA_TEXT,
    DEFAULT_CRITERIA_BY_PHASE,
    EXAMPLE_DMP_TEXT
  };

})(window);
