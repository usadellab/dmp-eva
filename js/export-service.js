// =============================================================================
// EXPORT SERVICE MODULE
// Handles exporting evaluation results to JSON, Markdown, and PDF
// =============================================================================

(function(window) {
  'use strict';

  /**
   * Export results as JSON file
   * @param {Object} evaluationData - Complete evaluation data with results and metadata
   * @param {string} filename - Optional filename (default: dmp-evaluation-{date}.json)
   */
  function exportAsJSON(evaluationData, filename = null) {
    const defaultFilename = `dmp-evaluation-${getDateString()}.json`;
    const finalFilename = filename || defaultFilename;

    const jsonString = JSON.stringify(evaluationData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    downloadFile(blob, finalFilename);
    console.log('[Export] JSON file exported:', finalFilename);
  }

  /**
   * Export results as Markdown file
   * @param {Object} evaluationData - Complete evaluation data with results and metadata
   * @param {string} filename - Optional filename
   */
  function exportAsMarkdown(evaluationData, filename = null) {
    const defaultFilename = `dmp-evaluation-${getDateString()}.md`;
    const finalFilename = filename || defaultFilename;

    const markdown = generateMarkdown(evaluationData);
    const blob = new Blob([markdown], { type: 'text/markdown' });

    downloadFile(blob, finalFilename);
    console.log('[Export] Markdown file exported:', finalFilename);
  }

  /**
   * Export results as PDF file
   * @param {Object} evaluationData - Complete evaluation data with results and metadata
   * @param {string} filename - Optional filename
   */
  function exportAsPDF(evaluationData, filename = null) {
    if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
      alert('PDF library not loaded. Please refresh the page and try again.');
      return;
    }

    const defaultFilename = `dmp-evaluation-${getDateString()}.pdf`;
    const finalFilename = filename || defaultFilename;

    try {
      const doc = new jspdf.jsPDF();
      generatePDF(doc, evaluationData);
      doc.save(finalFilename);
      console.log('[Export] PDF file exported:', finalFilename);
    } catch (error) {
      console.error('[Export] PDF generation error:', error);
      alert('Failed to generate PDF: ' + error.message);
    }
  }

  /**
   * Generate Markdown content from evaluation data
   * @param {Object} data - Evaluation data
   * @returns {string} - Markdown content
   */
  function generateMarkdown(data) {
    const { results, metadata } = data;
    const date = new Date(metadata.evaluationDate).toLocaleDateString();
    const phase = capitalizeFirst(metadata.phase);

    let md = `# DMP Evaluation Report\n\n`;

    // Metadata section
    md += `## Evaluation Details\n\n`;
    md += `- **Date**: ${date}\n`;
    md += `- **Phase**: ${phase}\n`;
    md += `- **DMP File**: ${metadata.dmpFile}\n`;
    md += `- **Criteria File**: ${metadata.criteriaFile}\n`;
    md += `- **Model Used**: ${metadata.model || 'N/A'}\n\n`;

    // Overall Score
    md += `## Overall Compliance Score\n\n`;
    md += `**${results.overallScore}/100** `;
    md += `(${getStatusLabel(results.overallScore)})\n\n`;

    // Progress bar (visual representation)
    const barLength = 30;
    const filledLength = Math.round((results.overallScore / 100) * barLength);
    const emptyLength = barLength - filledLength;
    md += `\`[${'█'.repeat(filledLength)}${' '.repeat(emptyLength)}]\`\n\n`;

    // Summary statistics
    const summary = window.Evaluator.generateSummary(results);
    if (summary) {
      md += `### Summary Statistics\n\n`;
      md += `- Total Categories Evaluated: ${summary.totalCategories}\n`;
      md += `- Average Score: ${summary.averageScore}\n`;
      md += `- Highest Score: ${summary.maxScore}\n`;
      md += `- Lowest Score: ${summary.minScore}\n\n`;

      md += `**Performance Breakdown**:\n`;
      md += `- Excellent (90-100): ${summary.statusCounts.excellent} categories\n`;
      md += `- Good (75-89): ${summary.statusCounts.good} categories\n`;
      md += `- Fair (60-74): ${summary.statusCounts.fair} categories\n`;
      md += `- Poor (0-59): ${summary.statusCounts.poor} categories\n\n`;
    }

    // Detailed scores table
    md += `## Detailed Scores by Category\n\n`;
    md += `| ID | Category | Score | Status |\n`;
    md += `|----|----------|-------|--------|\n`;

    results.categories.forEach(cat => {
      md += `| ${cat.id} | ${cat.name} | ${cat.score}/100 | ${capitalizeFirst(cat.status)} |\n`;
    });
    md += `\n`;

    // Detailed feedback
    md += `## Detailed Feedback\n\n`;

    results.categories.forEach(cat => {
      md += `### ${cat.id}. ${cat.name}\n\n`;
      md += `**Score**: ${cat.score}/100 (${capitalizeFirst(cat.status)})\n\n`;
      md += `${cat.feedback}\n\n`;
      md += `---\n\n`;
    });

    // Strengths and weaknesses
    if (summary && (summary.strengths.length > 0 || summary.weaknesses.length > 0)) {
      md += `## Key Findings\n\n`;

      if (summary.strengths.length > 0) {
        md += `### Strengths\n\n`;
        summary.strengths.forEach(cat => {
          md += `- **${cat.name}** (${cat.score}/100): ${cat.feedback.substring(0, 150)}...\n`;
        });
        md += `\n`;
      }

      if (summary.weaknesses.length > 0) {
        md += `### Areas for Improvement\n\n`;
        summary.weaknesses.forEach(cat => {
          md += `- **${cat.name}** (${cat.score}/100): ${cat.feedback.substring(0, 150)}...\n`;
        });
        md += `\n`;
      }
    }

    // Footer
    md += `---\n\n`;
    md += `*Generated by DMP Evaluation Tool on ${new Date(metadata.evaluationDate).toLocaleString()}*\n`;

    return md;
  }

  /**
   * Generate PDF document
   * @param {jsPDF} doc - jsPDF document instance
   * @param {Object} data - Evaluation data
   */
  function generatePDF(doc, data) {
    const { results, metadata } = data;
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);

    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('DMP Evaluation Report', margin, yPos);
    yPos += 15;

    // Metadata
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Date: ${new Date(metadata.evaluationDate).toLocaleDateString()}`, margin, yPos);
    yPos += 6;
    doc.text(`Phase: ${capitalizeFirst(metadata.phase)}`, margin, yPos);
    yPos += 6;
    doc.text(`DMP File: ${metadata.dmpFile}`, margin, yPos);
    yPos += 6;
    doc.text(`Criteria File: ${metadata.criteriaFile}`, margin, yPos);
    yPos += 12;

    // Overall Score
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Overall Compliance Score', margin, yPos);
    yPos += 8;

    doc.setFontSize(24);
    doc.setTextColor(getScoreColor(results.overallScore));
    doc.text(`${results.overallScore}/100`, margin, yPos);
    doc.setTextColor(0, 0, 0); // Reset to black
    yPos += 12;

    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Scores table
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Detailed Scores by Category', margin, yPos);
    yPos += 8;

    const tableData = results.categories.map(cat => [
      cat.id,
      cat.name,
      `${cat.score}/100`,
      capitalizeFirst(cat.status)
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['ID', 'Category', 'Score', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [13, 110, 253], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 90 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 }
      },
      margin: { left: margin, right: margin }
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // Detailed feedback
    doc.addPage();
    yPos = 20;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Detailed Feedback', margin, yPos);
    yPos += 10;

    results.categories.forEach((cat, index) => {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`${cat.id}. ${cat.name}`, margin, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Score: ${cat.score}/100 (${capitalizeFirst(cat.status)})`, margin, yPos);
      yPos += 6;

      // Wrap feedback text
      const feedbackLines = doc.splitTextToSize(cat.feedback, contentWidth);
      doc.text(feedbackLines, margin, yPos);
      yPos += (feedbackLines.length * 5) + 8;
    });

    // Footer on last page
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
  }

  /**
   * Download a blob as a file
   * @param {Blob} blob - Blob to download
   * @param {string} filename - Filename
   */
  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get date string for filename
   * @returns {string} - Date string (YYYY-MM-DD)
   */
  function getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} - Capitalized string
   */
  function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get status label from score
   * @param {number} score - Score (0-100)
   * @returns {string} - Status label
   */
  function getStatusLabel(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  }

  /**
   * Get RGB color for score (for PDF)
   * @param {number} score - Score (0-100)
   * @returns {Array<number>} - [R, G, B]
   */
  function getScoreColor(score) {
    if (score >= 90) return [25, 135, 84]; // Green
    if (score >= 75) return [13, 202, 240]; // Cyan
    if (score >= 60) return [255, 193, 7]; // Yellow
    return [220, 53, 69]; // Red
  }

  // Export public API
  window.ExportService = {
    exportAsJSON,
    exportAsMarkdown,
    exportAsPDF
  };

})(window);
