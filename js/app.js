// =============================================================================
// MAIN APPLICATION
// Handles UI interactions and coordinates evaluation workflow
// =============================================================================

(function() {
  'use strict';

  // State management
  let state = {
    criteriaFile: null,
    dmpFile: null,
    evaluationResults: null,
    isEvaluating: false
  };

  // Initialize app when DOM is ready
  document.addEventListener('DOMContentLoaded', initializeApp);

  function initializeApp() {
    console.log('[App] Initializing DMP Evaluation Tool');

    // Load saved settings from localStorage
    loadSettings();

    // Setup event listeners
    setupAPIKeyListeners();
    setupAPIConfigListeners();
    setupFileUploadListeners();
    setupPasteTextListeners();
    setupEvaluationListeners();
    setupExportListeners();

    // Update UI state
    updateEvaluateButtonState();

    console.log('[App] Initialization complete');
  }

  /**
   * Load settings from localStorage
   */
  function loadSettings() {
    const apiKey = localStorage.getItem('togetherAPIKey');
    const model = localStorage.getItem('togetherAIModel');
    const testMode = localStorage.getItem('llmTestMode');

    if (apiKey) {
      document.getElementById('togetherAPIKey').value = apiKey;
    }

    if (model) {
      document.getElementById('togetherAIModel').value = model;
    }

    if (testMode === 'true') {
      document.getElementById('llmTestMode').checked = true;
    }
  }

  /**
   * Setup API key and configuration listeners
   */
  function setupAPIKeyListeners() {
    // API Key input
    const apiKeyInput = document.getElementById('togetherAPIKey');
    apiKeyInput.addEventListener('input', (e) => {
      localStorage.setItem('togetherAPIKey', e.target.value);
      updateEvaluateButtonState();
    });

    // Toggle API key visibility
    const toggleBtn = document.getElementById('toggleAPIKey');
    toggleBtn.addEventListener('click', () => {
      const type = apiKeyInput.type === 'password' ? 'text' : 'password';
      apiKeyInput.type = type;
      toggleBtn.innerHTML = type === 'password'
        ? '<i class="fas fa-eye"></i>'
        : '<i class="fas fa-eye-slash"></i>';
    });

    // Model selection
    const modelSelect = document.getElementById('togetherAIModel');
    modelSelect.addEventListener('change', (e) => {
      localStorage.setItem('togetherAIModel', e.target.value);
    });

    // Test mode toggle
    const testModeToggle = document.getElementById('llmTestMode');
    testModeToggle.addEventListener('change', (e) => {
      localStorage.setItem('llmTestMode', e.target.checked);
    });
  }

  /**
   * Setup API configuration modal listeners
   */
  function setupAPIConfigListeners() {
    const modal = new bootstrap.Modal(document.getElementById('apiConfigModal'));
    const openBtn = document.getElementById('openAPIConfigBtn');
    const saveBtn = document.getElementById('saveAPIConfigBtn');
    const deleteBtn = document.getElementById('deleteProfileBtn');
    const profileSelect = document.getElementById('apiProfileSelect');
    const addHeaderBtn = document.getElementById('addHeaderBtn');

    // Open modal and load active profile
    openBtn.addEventListener('click', () => {
      loadAPIConfigModal();
      modal.show();
    });

    // Profile selection change
    profileSelect.addEventListener('change', () => {
      const selectedProfile = profileSelect.value;
      loadProfileIntoForm(selectedProfile);
      updateDeleteButtonState();
    });

    // Add header button
    addHeaderBtn.addEventListener('click', () => {
      addHeaderInput();
    });

    // Save configuration
    saveBtn.addEventListener('click', () => {
      saveAPIConfiguration();
      modal.hide();
    });

    // Delete profile
    deleteBtn.addEventListener('click', () => {
      const profileId = profileSelect.value;
      if (confirm(`Delete custom profile "${profileId}"?`)) {
        window.APIConfig.deleteProfile(profileId);
        loadAPIConfigModal();
        updateCodePreview();
      }
    });

    // Update code preview on input changes (debounced)
    let previewTimeout;
    const formInputs = [
      'apiEndpoint', 'authHeader', 'modelParamName', 'messagesParamName',
      'temperature', 'maxTokens', 'responseFormat'
    ];

    formInputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => {
          clearTimeout(previewTimeout);
          previewTimeout = setTimeout(() => updateCodePreview(), 500);
        });
      }
    });
  }

  /**
   * Load API config modal with current profile
   */
  function loadAPIConfigModal() {
    const activeProfileId = window.APIConfig.getActiveProfileId();

    // Update profile selector
    const profileSelect = document.getElementById('apiProfileSelect');
    profileSelect.innerHTML = `
      <option value="together">Together.ai (Default)</option>
      <option value="openai">OpenAI Compatible</option>
    `;

    // Add custom profiles
    const customProfiles = window.APIConfig.getAllProfiles();
    for (const [id, profile] of Object.entries(customProfiles)) {
      if (!window.APIConfig.DEFAULT_PROFILES[id]) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = profile.name;
        profileSelect.appendChild(option);
      }
    }

    // Add "Custom" option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom Configuration';
    profileSelect.appendChild(customOption);

    // Select active profile
    profileSelect.value = activeProfileId;

    // Load profile into form
    loadProfileIntoForm(activeProfileId);

    // Update delete button state
    updateDeleteButtonState();

    // Update code preview
    updateCodePreview();
  }

  /**
   * Load profile data into form fields
   */
  function loadProfileIntoForm(profileId) {
    let profile;

    if (profileId === 'custom') {
      // Show custom profile name input
      document.getElementById('customProfileNameGroup').style.display = 'block';
      // Load default together profile as template
      profile = { ...window.APIConfig.DEFAULT_PROFILES.together };
    } else {
      // Hide custom profile name input
      document.getElementById('customProfileNameGroup').style.display = 'none';
      profile = window.APIConfig.getProfile(profileId);
    }

    if (!profile) {
      profile = { ...window.APIConfig.DEFAULT_PROFILES.together };
    }

    // Set form values
    document.getElementById('apiEndpoint').value = profile.endpoint || '';
    document.getElementById('authHeader').value = profile.authHeaderTemplate || '';
    document.getElementById('modelParamName').value = profile.modelParamName || 'model';
    document.getElementById('messagesParamName').value = profile.messagesParamName || 'messages';
    document.getElementById('temperature').value = profile.temperature || 0.3;
    document.getElementById('maxTokens').value = profile.maxTokens || 8000;
    document.getElementById('responseFormat').value = profile.responseFormat || 'json_object';

    // Load additional headers
    loadAdditionalHeaders(profile.additionalHeaders || {});

    // Update code preview
    updateCodePreview();
  }

  /**
   * Load additional headers into the container
   */
  function loadAdditionalHeaders(headers) {
    const container = document.getElementById('additionalHeadersContainer');
    container.innerHTML = '';

    for (const [key, value] of Object.entries(headers)) {
      if (key !== 'Content-Type') { // Content-Type is always included
        addHeaderInput(key, value);
      }
    }
  }

  /**
   * Add a header input row
   */
  function addHeaderInput(key = '', value = '') {
    const container = document.getElementById('additionalHeadersContainer');
    const headerRow = document.createElement('div');
    headerRow.className = 'input-group mb-2';

    headerRow.innerHTML = `
      <input type="text" class="form-control" placeholder="Header Name" value="${key}">
      <input type="text" class="form-control" placeholder="Header Value" value="${value}">
      <button class="btn btn-outline-danger" type="button">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Remove button handler
    const removeBtn = headerRow.querySelector('button');
    removeBtn.addEventListener('click', () => {
      headerRow.remove();
      updateCodePreview();
    });

    // Update preview on input
    const inputs = headerRow.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        clearTimeout(window.headerPreviewTimeout);
        window.headerPreviewTimeout = setTimeout(() => updateCodePreview(), 500);
      });
    });

    container.appendChild(headerRow);
  }

  /**
   * Update code preview
   */
  function updateCodePreview() {
    const profile = {
      endpoint: document.getElementById('apiEndpoint').value,
      authHeaderTemplate: document.getElementById('authHeader').value,
      additionalHeaders: getAdditionalHeaders(),
      modelParamName: document.getElementById('modelParamName').value,
      messagesParamName: document.getElementById('messagesParamName').value,
      temperature: parseFloat(document.getElementById('temperature').value),
      maxTokens: parseInt(document.getElementById('maxTokens').value),
      responseFormat: document.getElementById('responseFormat').value
    };

    const preview = window.APIConfig.generateFetchPreview(profile);
    document.getElementById('fetchCodePreview').textContent = preview;
  }

  /**
   * Get additional headers from form
   */
  function getAdditionalHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    const container = document.getElementById('additionalHeadersContainer');
    const rows = container.querySelectorAll('.input-group');

    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const key = inputs[0].value.trim();
      const value = inputs[1].value.trim();

      if (key && value) {
        headers[key] = value;
      }
    });

    return headers;
  }

  /**
   * Save API configuration
   */
  function saveAPIConfiguration() {
    const profileId = document.getElementById('apiProfileSelect').value;

    // Build profile config
    const config = {
      name: profileId === 'custom' ? document.getElementById('customProfileName').value : document.getElementById('apiProfileSelect').options[document.getElementById('apiProfileSelect').selectedIndex].text,
      endpoint: document.getElementById('apiEndpoint').value,
      authHeaderTemplate: document.getElementById('authHeader').value,
      additionalHeaders: getAdditionalHeaders(),
      modelParamName: document.getElementById('modelParamName').value,
      messagesParamName: document.getElementById('messagesParamName').value,
      temperature: parseFloat(document.getElementById('temperature').value),
      maxTokens: parseInt(document.getElementById('maxTokens').value),
      responseFormat: document.getElementById('responseFormat').value
    };

    // If custom profile, save with custom name
    if (profileId === 'custom') {
      const customName = document.getElementById('customProfileName').value.trim();
      if (!customName) {
        alert('Please enter a profile name');
        return;
      }

      const customId = customName.toLowerCase().replace(/\s+/g, '-');
      window.APIConfig.saveProfile(customId, config);
      window.APIConfig.setActiveProfileId(customId);
    } else if (profileId === 'together' || profileId === 'openai') {
      // For default profiles, just set as active
      window.APIConfig.setActiveProfileId(profileId);
    } else {
      // Update existing custom profile
      window.APIConfig.saveProfile(profileId, config);
      window.APIConfig.setActiveProfileId(profileId);
    }

    console.log('[App] API configuration saved:', profileId);
  }

  /**
   * Update delete button state
   */
  function updateDeleteButtonState() {
    const profileId = document.getElementById('apiProfileSelect').value;
    const deleteBtn = document.getElementById('deleteProfileBtn');

    if (window.APIConfig.isCustomProfile(profileId)) {
      deleteBtn.disabled = false;
    } else {
      deleteBtn.disabled = true;
    }
  }

  /**
   * Setup file upload listeners (drag-drop and click)
   */
  function setupFileUploadListeners() {
    // Criteria file upload
    setupFileZone(
      'criteriaUploadZone',
      'criteriaFileInput',
      'criteriaFileInfo',
      'criteriaFileName',
      'removeCriteriaFile',
      (file) => {
        state.criteriaFile = file;
        updateEvaluateButtonState();
      }
    );

    // DMP file upload
    setupFileZone(
      'dmpUploadZone',
      'dmpFileInput',
      'dmpFileInfo',
      'dmpFileName',
      'removeDmpFile',
      (file) => {
        state.dmpFile = file;
        updateEvaluateButtonState();
      }
    );
  }

  /**
   * Setup a file upload zone with drag-drop
   */
  function setupFileZone(zoneId, inputId, infoId, nameId, removeId, onFileSelected) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const info = document.getElementById(infoId);
    const nameSpan = document.getElementById(nameId);
    const removeBtn = document.getElementById(removeId);

    // Click to upload
    zone.addEventListener('click', () => input.click());

    // File input change
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFileSelection(file, zone, info, nameSpan, onFileSelected);
    });

    // Drag and drop
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');

      const file = e.dataTransfer.files[0];
      if (file) handleFileSelection(file, zone, info, nameSpan, onFileSelected);
    });

    // Remove file
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = '';
      zone.style.display = 'flex';
      info.classList.add('d-none');
      onFileSelected(null);
    });
  }

  /**
   * Handle file selection
   */
  function handleFileSelection(file, zone, info, nameSpan, callback) {
    // Validate file
    const validation = window.FileParser.validateFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // Update UI
    zone.style.display = 'none';
    info.classList.remove('d-none');

    // Show file name with info/warning if needed
    let displayText = `${file.name} (${window.FileParser.formatFileSize(file.size)})`;
    if (validation.warning) {
      displayText += ' 🤖'; // AI icon for .doc files
      // Show compact tooltip-style info
      nameSpan.setAttribute('title', validation.error);
      nameSpan.style.fontWeight = '500';
    }
    nameSpan.textContent = displayText;

    // Call callback
    callback(file);

    console.log('[App] File selected:', file.name);
  }

  /**
   * Setup paste text listeners
   */
  function setupPasteTextListeners() {
    const pasteCriteriaBtn = document.getElementById('pasteCriteriaBtn');
    const pasteDmpBtn = document.getElementById('pasteDmpBtn');
    const saveCriteriaTextBtn = document.getElementById('saveCriteriaTextBtn');
    const saveDmpTextBtn = document.getElementById('saveDmpTextBtn');
    const useDefaultCriteria = document.getElementById('useDefaultCriteria');
    const criteriaTextArea = document.getElementById('criteriaTextArea');

    const pasteCriteriaModal = new bootstrap.Modal(document.getElementById('pasteCriteriaModal'));
    const pasteDmpModal = new bootstrap.Modal(document.getElementById('pasteDmpModal'));

    // Open criteria paste modal
    pasteCriteriaBtn.addEventListener('click', () => {
      // Load phase-specific default criteria if checkbox is checked
      if (useDefaultCriteria.checked) {
        const phase = document.getElementById('projectPhase').value;
        criteriaTextArea.value = window.CriteriaExtractor.getDefaultCriteriaText(phase);
      }
      pasteCriteriaModal.show();
    });

    // Toggle default criteria text
    useDefaultCriteria.addEventListener('change', (e) => {
      if (e.target.checked) {
        const phase = document.getElementById('projectPhase').value;
        criteriaTextArea.value = window.CriteriaExtractor.getDefaultCriteriaText(phase);
      } else {
        criteriaTextArea.value = '';
      }
    });

    // Phase change listener - update criteria if default is checked
    const projectPhaseSelect = document.getElementById('projectPhase');
    projectPhaseSelect.addEventListener('change', () => {
      // If modal is open and default criteria checkbox is checked, update the text
      if (useDefaultCriteria.checked) {
        const phase = projectPhaseSelect.value;
        criteriaTextArea.value = window.CriteriaExtractor.getDefaultCriteriaText(phase);
      }
    });

    // Open DMP paste modal
    pasteDmpBtn.addEventListener('click', () => {
      const useExampleDmp = document.getElementById('useExampleDmp');
      // Load example DMP if checkbox is checked
      if (useExampleDmp.checked) {
        document.getElementById('dmpTextArea').value = window.CriteriaExtractor.EXAMPLE_DMP_TEXT;
      }
      pasteDmpModal.show();
    });

    // Toggle example DMP text
    const useExampleDmp = document.getElementById('useExampleDmp');
    useExampleDmp.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.getElementById('dmpTextArea').value = window.CriteriaExtractor.EXAMPLE_DMP_TEXT;
      } else {
        document.getElementById('dmpTextArea').value = '';
      }
    });

    // Save criteria text
    saveCriteriaTextBtn.addEventListener('click', async () => {
      const text = criteriaTextArea.value.trim();

      if (!text) {
        alert('Please enter or paste evaluation criteria text');
        return;
      }

      // Show processing status
      saveCriteriaTextBtn.disabled = true;
      saveCriteriaTextBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

      try {
        // Detect and convert if needed
        const result = await window.LLMService.detectAndConvertCriteria(text);

        // Create a virtual file object from the text
        const blob = new Blob([result.convertedText], { type: 'text/plain' });
        const file = new File([blob], 'pasted-criteria.txt', { type: 'text/plain' });

        // Set it as the criteria file
        state.criteriaFile = file;

        // Update UI
        const zone = document.getElementById('criteriaUploadZone');
        const info = document.getElementById('criteriaFileInfo');
        const nameSpan = document.getElementById('criteriaFileName');

        zone.style.display = 'none';
        info.classList.remove('d-none');
        nameSpan.textContent = `Pasted Text (${window.FileParser.formatFileSize(blob.size)})${result.suitable ? '' : ' - AI Converted'}`;

        updateEvaluateButtonState();

        // Show message to user
        if (!result.suitable && !result.error) {
          alert('Your criteria have been automatically converted to evaluation format using AI.');
        }

        // Close modal
        pasteCriteriaModal.hide();

        console.log('[App] Criteria text saved:', result);
      } catch (error) {
        console.error('[App] Error processing criteria:', error);
        alert(`Error processing criteria: ${error.message}`);
      } finally {
        // Reset button
        saveCriteriaTextBtn.disabled = false;
        saveCriteriaTextBtn.innerHTML = '<i class="fas fa-check me-1"></i>Use This Text';
      }
    });

    // Save DMP text
    saveDmpTextBtn.addEventListener('click', () => {
      const text = document.getElementById('dmpTextArea').value.trim();

      if (!text) {
        alert('Please enter or paste DMP document text');
        return;
      }

      // Create a virtual file object from the text
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], 'pasted-dmp.txt', { type: 'text/plain' });

      // Set it as the DMP file
      state.dmpFile = file;

      // Update UI
      const zone = document.getElementById('dmpUploadZone');
      const info = document.getElementById('dmpFileInfo');
      const nameSpan = document.getElementById('dmpFileName');

      zone.style.display = 'none';
      info.classList.remove('d-none');
      nameSpan.textContent = `Pasted Text (${window.FileParser.formatFileSize(blob.size)})`;

      updateEvaluateButtonState();

      // Close modal
      pasteDmpModal.hide();

      console.log('[App] DMP text saved');
    });
  }

  /**
   * Setup evaluation listeners
   */
  function setupEvaluationListeners() {
    const evaluateBtn = document.getElementById('evaluateBtn');
    evaluateBtn.addEventListener('click', startEvaluation);
  }

  /**
   * Setup export listeners
   */
  function setupExportListeners() {
    document.getElementById('exportJsonBtn').addEventListener('click', () => {
      if (state.evaluationResults) {
        window.ExportService.exportAsJSON(state.evaluationResults);
      }
    });

    document.getElementById('exportMarkdownBtn').addEventListener('click', () => {
      if (state.evaluationResults) {
        window.ExportService.exportAsMarkdown(state.evaluationResults);
      }
    });

    document.getElementById('exportPdfBtn').addEventListener('click', () => {
      if (state.evaluationResults) {
        window.ExportService.exportAsPDF(state.evaluationResults);
      }
    });
  }

  /**
   * Update evaluate button state
   */
  function updateEvaluateButtonState() {
    const evaluateBtn = document.getElementById('evaluateBtn');
    const apiKey = localStorage.getItem('togetherAPIKey');
    const testMode = localStorage.getItem('llmTestMode') === 'true';

    const canEvaluate = state.criteriaFile && state.dmpFile && (apiKey || testMode);

    evaluateBtn.disabled = !canEvaluate;
  }

  /**
   * Start evaluation process
   */
  async function startEvaluation() {
    if (state.isEvaluating) {
      console.warn('[App] Evaluation already in progress');
      return;
    }

    state.isEvaluating = true;

    // Get project phase
    const phase = document.getElementById('projectPhase').value;

    // Update UI to show processing
    showStatus('processing');
    hideResults();
    clearStreamingDisplay();

    try {
      // Run evaluation
      const result = await window.Evaluator.evaluate(
        state.criteriaFile,
        state.dmpFile,
        phase,
        (message) => updateStatusMessage(message)
      );

      if (result.success) {
        // Store results
        state.evaluationResults = result;

        // Display results
        displayResults(result.results);

        // Show success status
        showStatus('complete');
      } else {
        // Show error
        showStatus('error', result.error);
      }

    } catch (error) {
      console.error('[App] Evaluation error:', error);
      showStatus('error', error.message);
    } finally {
      state.isEvaluating = false;
    }
  }

  /**
   * Display evaluation results
   */
  function displayResults(results) {
    console.log('[App] Displaying results:', results);

    // Show results card
    const resultsCard = document.getElementById('resultsCard');
    resultsCard.style.display = 'block';
    resultsCard.classList.add('fade-in');

    // Update overall score
    updateOverallScore(results.overallScore);

    // Update scores table
    updateScoresTable(results.categories);

    // Update narrative feedback
    updateNarrativeFeedback(results.categories);

    // Scroll to results
    setTimeout(() => {
      resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }

  /**
   * Update overall score display
   */
  function updateOverallScore(score) {
    const scoreBar = document.getElementById('overallScoreBar');
    const scoreText = document.getElementById('overallScoreText');

    scoreBar.style.width = score + '%';
    scoreBar.setAttribute('aria-valuenow', score);
    scoreText.textContent = score + '%';

    // Update color based on score
    const colorClass = window.Evaluator.getProgressBarClass(score);
    scoreBar.className = 'progress-bar ' + colorClass;
  }

  /**
   * Update scores table
   */
  function updateScoresTable(categories) {
    const tbody = document.getElementById('scoresTableBody');
    tbody.innerHTML = '';

    categories.forEach(cat => {
      const row = document.createElement('tr');

      // Category group (extract number from ID)
      const categoryGroup = cat.id.match(/^\d+/)[0];
      const categoryName = getCategoryGroupName(categoryGroup);

      row.innerHTML = `
        <td class="criterion-id">${cat.id}</td>
        <td class="category-label">${categoryName}</td>
        <td>${cat.name}</td>
        <td class="score-cell">${cat.score}/100</td>
        <td>
          <span class="score-badge ${window.Evaluator.getScoreColorClass(cat.score)}">
            ${cat.status.toUpperCase()}
          </span>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  /**
   * Get category group name from number
   */
  function getCategoryGroupName(num) {
    const names = {
      '1': 'Data Description',
      '2': 'Documentation',
      '3': 'Storage & Backup',
      '4': 'Legal & Ethics',
      '5': 'Sharing & Preservation',
      '6': 'Responsibilities'
    };
    return names[num] || 'Category ' + num;
  }

  /**
   * Update narrative feedback section
   */
  function updateNarrativeFeedback(categories) {
    const container = document.getElementById('narrativeFeedback');
    container.innerHTML = '';

    categories.forEach(cat => {
      const section = document.createElement('div');
      section.className = 'feedback-section ' + cat.status;

      section.innerHTML = `
        <h6>${cat.id}. ${cat.name} (${cat.score}/100)</h6>
        <p>${cat.feedback}</p>
      `;

      container.appendChild(section);
    });
  }

  /**
   * Show status message
   */
  function showStatus(status, message = '') {
    // Hide all status divs
    document.getElementById('statusIdle').style.display = 'none';
    document.getElementById('statusProcessing').classList.add('d-none');
    document.getElementById('statusComplete').classList.add('d-none');
    document.getElementById('statusError').classList.add('d-none');

    // Show appropriate status
    switch (status) {
      case 'processing':
        document.getElementById('statusProcessing').classList.remove('d-none');
        break;
      case 'complete':
        document.getElementById('statusComplete').classList.remove('d-none');
        break;
      case 'error':
        document.getElementById('statusError').classList.remove('d-none');
        document.getElementById('errorMessage').textContent = message;
        break;
      default:
        document.getElementById('statusIdle').style.display = 'block';
    }
  }

  /**
   * Update status message during processing
   */
  function updateStatusMessage(message) {
    // Handle both string messages and streaming objects
    if (typeof message === 'string') {
      // Simple status message
      const statusMessage = document.getElementById('statusMessage');
      if (statusMessage) {
        statusMessage.textContent = message;
      }
    } else if (typeof message === 'object') {
      // Streaming message object
      handleStreamingMessage(message);
    }
  }

  /**
   * Handle streaming messages from LLM
   */
  function handleStreamingMessage(messageObj) {
    const streamingContainer = document.getElementById('streamingOutputContainer');
    const reasoningSection = document.getElementById('streamingReasoningSection');
    const responseSection = document.getElementById('streamingResponseSection');
    const reasoningContent = document.getElementById('streamingReasoningContent');
    const responseContent = document.getElementById('streamingResponseContent');

    if (messageObj.type === 'stream') {
      // Show streaming container on first chunk
      if (streamingContainer.classList.contains('d-none')) {
        streamingContainer.classList.remove('d-none');
      }

      // Handle streaming chunks
      if (messageObj.isReasoning) {
        // Reasoning content (thinking)
        if (reasoningSection.classList.contains('d-none')) {
          reasoningSection.classList.remove('d-none');
        }
        reasoningContent.textContent += messageObj.content;
        reasoningContent.classList.remove('stream-complete');

        // Auto-scroll to bottom
        streamingContainer.scrollTop = streamingContainer.scrollHeight;

      } else {
        // Regular response content
        if (responseSection.classList.contains('d-none')) {
          responseSection.classList.remove('d-none');
        }
        responseContent.textContent += messageObj.content;
        responseContent.classList.remove('stream-complete');

        // Auto-scroll to bottom
        streamingContainer.scrollTop = streamingContainer.scrollHeight;
      }

    } else if (messageObj.type === 'status') {
      // Regular status message
      const statusMessage = document.getElementById('statusMessage');
      if (statusMessage) {
        statusMessage.textContent = messageObj.content;
      }

    } else if (messageObj.type === 'complete') {
      // Mark streaming as complete
      if (reasoningContent) {
        reasoningContent.classList.add('stream-complete');
      }
      if (responseContent) {
        responseContent.classList.add('stream-complete');
      }

      // Update status message
      const statusMessage = document.getElementById('statusMessage');
      if (statusMessage) {
        statusMessage.textContent = messageObj.content || 'Processing complete...';
      }
    }
  }

  /**
   * Clear streaming display
   */
  function clearStreamingDisplay() {
    const streamingContainer = document.getElementById('streamingOutputContainer');
    const reasoningSection = document.getElementById('streamingReasoningSection');
    const responseSection = document.getElementById('streamingResponseSection');
    const reasoningContent = document.getElementById('streamingReasoningContent');
    const responseContent = document.getElementById('streamingResponseContent');

    // Hide all streaming elements
    if (streamingContainer) streamingContainer.classList.add('d-none');
    if (reasoningSection) reasoningSection.classList.add('d-none');
    if (responseSection) responseSection.classList.add('d-none');

    // Clear content
    if (reasoningContent) {
      reasoningContent.textContent = '';
      reasoningContent.classList.remove('stream-complete');
    }
    if (responseContent) {
      responseContent.textContent = '';
      responseContent.classList.remove('stream-complete');
    }
  }

  /**
   * Hide results card
   */
  function hideResults() {
    document.getElementById('resultsCard').style.display = 'none';
  }

})();
