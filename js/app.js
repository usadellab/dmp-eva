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
    isEvaluating: false,
    usingDefaultCriteria: false // Track if using eva.json default
  };

  // Initialize app when DOM is ready
  document.addEventListener('DOMContentLoaded', initializeApp);

  function initializeApp() {
    console.log('[App] Initializing DMP Evaluation Tool');

    // Load saved settings from localStorage
    loadSettings();

    // Load default criteria (eva.json)
    loadDefaultCriteria();

    // Setup event listeners
    setupAPIKeyListeners();
    setupAPIConfigListeners();
    setupFileUploadListeners();
    setupPasteTextListeners();
    setupEvaluationListeners();
    setupExportListeners();
    setupPromptEditorListeners();

    // Update UI state
    updateEvaluateButtonState();
    updateAPIKeyVisibility();
    updateModelSelectionVisibility();

    console.log('[App] Initialization complete');
  }

  /**
   * Load default criteria from eva.json
   */
  async function loadDefaultCriteria() {
    try {
      const response = await fetch('eva.json');
      if (!response.ok) {
        console.warn('[App] eva.json not found, using fallback criteria');
        return;
      }

      const evaData = await response.json();
      const evaJsonString = JSON.stringify(evaData, null, 2);

      // Create a virtual file from eva.json
      const blob = new Blob([evaJsonString], { type: 'application/json' });
      const file = new File([blob], 'eva.json', { type: 'application/json' });

      // Set as default criteria file
      state.criteriaFile = file;
      state.usingDefaultCriteria = true;

      // Update UI to show default criteria is loaded
      const zone = document.getElementById('criteriaUploadZone');
      const info = document.getElementById('criteriaFileInfo');
      const nameSpan = document.getElementById('criteriaFileName');

      zone.style.display = 'none';
      info.classList.remove('d-none');
      nameSpan.innerHTML = `
        <i class="fas fa-check-circle text-success me-1"></i>
        <strong>eva.json</strong> (Default DMP Criteria)
        <span class="badge bg-secondary ms-2">Pre-loaded</span>
      `;

      // Hide "Use Default" button since default is now loaded
      document.getElementById('useDefaultCriteriaBtn').style.display = 'none';

      updateEvaluateButtonState();
      console.log('[App] Default criteria (eva.json) loaded successfully');

    } catch (error) {
      console.warn('[App] Could not load eva.json:', error.message);
    }
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

    // Sync test mode with menu checkbox
    const testModeCheckbox = document.getElementById('testModeMenuItem');
    if (testModeCheckbox) {
      testModeCheckbox.checked = testMode === 'true';
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

    // Test mode toggle (in header menu)
    const testModeToggle = document.getElementById('testModeMenuItem');
    if (testModeToggle) {
      testModeToggle.addEventListener('change', (e) => {
        localStorage.setItem('llmTestMode', e.target.checked);
        updateEvaluateButtonState();
      });
    }
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

    // Update profile selector - include dataplan as first option
    const profileSelect = document.getElementById('apiProfileSelect');
    profileSelect.innerHTML = `
      <option value="dataplan">DataPLANT (Default)</option>
      <option value="lmstudio">LM Studio (Local)</option>
      <option value="together">Together.ai</option>
      <option value="openai">OpenAI Compatible</option>
    `;

    // Add custom profiles
    const customProfiles = window.APIConfig.getAllProfiles();
    for (const [id, profile] of Object.entries(customProfiles)) {
      if (!window.APIConfig.DEFAULT_PROFILES[id]) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = profile.name + ' (Custom)';
        profileSelect.appendChild(option);
      }
    }

    // Add "Add Custom API" option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = '+ Add Custom API';
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
    const customProfileGroup = document.getElementById('customProfileNameGroup');
    const builtInInfo = document.getElementById('builtInProfileInfo');
    const isBuiltInSecure = profileId === 'dataplan';  // Only dataplan is truly secure/built-in

    // Show/hide built-in profile info alert
    if (builtInInfo) {
      builtInInfo.style.display = isBuiltInSecure ? 'block' : 'none';
    }

    // Disable/hide form fields for built-in secure profiles
    const formFields = ['apiEndpoint', 'authHeader', 'addHeaderBtn'];
    formFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.disabled = isBuiltInSecure;
        if (fieldId === 'apiEndpoint' || fieldId === 'authHeader') {
          field.readOnly = isBuiltInSecure;
        }
      }
    });

    // Disable header inputs container for dataplan
    const headersContainer = document.getElementById('additionalHeadersContainer');
    if (headersContainer) {
      headersContainer.style.opacity = isBuiltInSecure ? '0.5' : '1';
      headersContainer.style.pointerEvents = isBuiltInSecure ? 'none' : 'auto';
    }

    if (profileId === 'custom') {
      // Show custom profile name input
      customProfileGroup.style.display = 'block';
      // Start with blank template for custom API
      profile = {
        endpoint: '',
        authHeaderTemplate: 'Bearer {API_KEY}',
        additionalHeaders: { 'Content-Type': 'application/json' },
        modelParamName: 'model',
        messagesParamName: 'messages',
        temperature: 0.3,
        maxTokens: 8000,
        responseFormat: 'json_object',
        requiresAPIKey: true
      };
    } else {
      // Hide custom profile name input
      customProfileGroup.style.display = 'none';
      profile = window.APIConfig.getProfile(profileId);
    }

    if (!profile) {
      profile = { ...window.APIConfig.DEFAULT_PROFILES.dataplan };
    }

    // For built-in secure profiles, show placeholder instead of actual values
    if (isBuiltInSecure) {
      document.getElementById('apiEndpoint').value = '[Built-in secure endpoint]';
      document.getElementById('authHeader').value = '[Not required]';
      loadAdditionalHeaders({}); // Clear headers display
    } else {
      // Deobfuscate endpoint for display in form
      const displayEndpoint = window.APIConfig.deobfuscateURL
        ? window.APIConfig.deobfuscateURL(profile.endpoint || '')
        : profile.endpoint;

      // Set form values
      document.getElementById('apiEndpoint').value = displayEndpoint;
      document.getElementById('authHeader').value = profile.authHeaderTemplate || '';

      // Load additional headers (exclude Content-Type as it's always included)
      loadAdditionalHeaders(profile.additionalHeaders || {});
    }

    // Always set these values
    document.getElementById('modelParamName').value = profile.modelParamName || 'model';
    document.getElementById('messagesParamName').value = profile.messagesParamName || 'messages';
    document.getElementById('temperature').value = profile.temperature || 0.3;
    document.getElementById('maxTokens').value = profile.maxTokens || 8000;
    document.getElementById('responseFormat').value = profile.responseFormat || 'json_object';

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
    const profileId = document.getElementById('apiProfileSelect').value;

    // Hide preview for built-in secure profiles (dataplan)
    if (profileId === 'dataplan') {
      document.getElementById('fetchCodePreview').textContent = '// Built-in secure configuration\n// API endpoint and headers are managed internally';
      return;
    }

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
    const authHeaderTemplate = document.getElementById('authHeader').value.trim();

    // Build profile config
    const config = {
      name: profileId === 'custom' ? document.getElementById('customProfileName').value : document.getElementById('apiProfileSelect').options[document.getElementById('apiProfileSelect').selectedIndex].text.replace(' (Custom)', ''),
      endpoint: document.getElementById('apiEndpoint').value,
      authHeaderTemplate: authHeaderTemplate,
      requiresAPIKey: authHeaderTemplate.length > 0,
      additionalHeaders: getAdditionalHeaders(),
      modelParamName: document.getElementById('modelParamName').value,
      messagesParamName: document.getElementById('messagesParamName').value,
      temperature: parseFloat(document.getElementById('temperature').value),
      maxTokens: parseInt(document.getElementById('maxTokens').value),
      responseFormat: document.getElementById('responseFormat').value,
      streamEnabled: true
    };

    // If custom profile, save with custom name
    if (profileId === 'custom') {
      const customName = document.getElementById('customProfileName').value.trim();
      if (!customName) {
        alert('Please enter a profile name');
        return;
      }

      const customId = customName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      window.APIConfig.saveProfile(customId, config);
      window.APIConfig.setActiveProfileId(customId);
      console.log('[App] Custom profile saved:', customId, config);
    } else if (profileId === 'dataplan' || profileId === 'lmstudio' || profileId === 'together' || profileId === 'openai') {
      // For default profiles, just set as active
      window.APIConfig.setActiveProfileId(profileId);
    } else {
      // Update existing custom profile
      window.APIConfig.saveProfile(profileId, config);
      window.APIConfig.setActiveProfileId(profileId);
    }

    console.log('[App] API configuration saved:', profileId);

    // Update API key visibility based on new profile
    updateAPIKeyVisibility();
    updateModelSelectionVisibility();
    updateEvaluateButtonState();
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
        if (file === null) {
          // User removed the file, clear criteria completely
          state.criteriaFile = null;
          state.usingDefaultCriteria = false;
          // Show "Use Default" button
          document.getElementById('useDefaultCriteriaBtn').style.display = 'inline-block';
          updateEvaluateButtonState();
        } else {
          state.criteriaFile = file;
          state.usingDefaultCriteria = false; // User uploaded custom criteria
          // Hide "Use Default" button
          document.getElementById('useDefaultCriteriaBtn').style.display = 'none';
          updateEvaluateButtonState();
        }
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
        if (file) {
          checkDMPSizeWarning(file.size);
        } else {
          // Clear warning when file removed
          document.getElementById('dmpSizeWarning').classList.add('d-none');
        }
        updateEvaluateButtonState();
      }
    );
  }

  /**
   * Check DMP file size and show warning if > 10KB with time estimate
   * @param {number} sizeInBytes - File size in bytes
   */
  function checkDMPSizeWarning(sizeInBytes) {
    const warningEl = document.getElementById('dmpSizeWarning');
    const warningTextEl = document.getElementById('dmpSizeWarningText');
    const threshold = 10 * 1024; // 10KB

    if (sizeInBytes > threshold) {
      // Estimate tokens (roughly 4 chars per token)
      const estimatedTokens = Math.ceil(sizeInBytes / 4);
      // Processing rate: 40 tokens/s
      const estimatedSeconds = Math.ceil(estimatedTokens / 40);
      const estimatedMinutes = Math.floor(estimatedSeconds / 60);
      const remainingSeconds = estimatedSeconds % 60;

      const timeStr = estimatedMinutes > 0
        ? `${estimatedMinutes}m ${remainingSeconds}s`
        : `${estimatedSeconds}s`;
      const sizeKB = Math.round(sizeInBytes / 1024);

      warningTextEl.innerHTML = `<strong>Large file (${sizeKB}KB)</strong> — Estimated evaluation time: <strong>${timeStr}</strong>. Larger files may take longer to process.`;
      warningEl.classList.remove('d-none');
    } else {
      warningEl.classList.add('d-none');
    }
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
    let displayText = file.name;
    if (validation.warning) {
      displayText += ' 🤖'; // AI icon for .doc files
      // Show compact tooltip-style info
      nameSpan.setAttribute('title', validation.error);
      nameSpan.style.fontWeight = '500';
    }
    nameSpan.innerHTML = `${displayText} <small class="text-muted">(${window.FileParser.formatFileSize(file.size)})</small>`;

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
    const useDefaultCriteriaBtn = document.getElementById('useDefaultCriteriaBtn');

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

    // Use default criteria button (eva.json)
    useDefaultCriteriaBtn.addEventListener('click', () => {
      loadDefaultCriteria();
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
      pasteDmpModal.show();
    });

    // Use example DMP button - directly loads example DMP
    const useExampleDmpBtn = document.getElementById('useExampleDmpBtn');
    useExampleDmpBtn.addEventListener('click', () => {
      // Create a virtual file object from the example DMP text
      const exampleText = window.CriteriaExtractor.EXAMPLE_DMP_TEXT;
      const blob = new Blob([exampleText], { type: 'text/plain' });
      const file = new File([blob], 'example-dmp.txt', { type: 'text/plain' });

      // Set it as the DMP file
      state.dmpFile = file;

      // Update UI
      const zone = document.getElementById('dmpUploadZone');
      const info = document.getElementById('dmpFileInfo');
      const nameSpan = document.getElementById('dmpFileName');

      zone.style.display = 'none';
      info.classList.remove('d-none');
      nameSpan.innerHTML = `Example DMP <small class="text-muted">(${window.FileParser.formatFileSize(blob.size)})</small> <span class="badge bg-info">Alpine Biodiversity</span>`;

      checkDMPSizeWarning(blob.size);
      updateEvaluateButtonState();
      console.log('[App] Example DMP loaded');
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
        state.usingDefaultCriteria = false; // User pasted custom criteria

        // Update UI
        const zone = document.getElementById('criteriaUploadZone');
        const info = document.getElementById('criteriaFileInfo');
        const nameSpan = document.getElementById('criteriaFileName');

        zone.style.display = 'none';
        info.classList.remove('d-none');
        nameSpan.innerHTML = `Pasted Text <small class="text-muted">(${window.FileParser.formatFileSize(blob.size)})</small>${result.suitable ? '' : ' <span class="badge bg-info">AI Converted</span>'}`;

        // Hide "Use Default" button since custom criteria is loaded
        document.getElementById('useDefaultCriteriaBtn').style.display = 'none';

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

      checkDMPSizeWarning(blob.size);
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
   * Setup export and load listeners
   */
  function setupExportListeners() {
    // Load JSON from header menu
    const loadMenuItem = document.getElementById('loadResultsMenuItem');
    const loadInput = document.getElementById('loadJsonInput');

    if (!loadMenuItem || !loadInput) {
      console.warn('[App] Load menu item or input not found');
      return;
    }

    loadMenuItem.addEventListener('click', (e) => {
      e.preventDefault();
      loadInput.click();
    });

    loadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          loadEvaluationResults(data);
        } catch (err) {
          console.error('[App] Failed to parse JSON:', err);
          showError('Failed to parse JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
      // Reset input so same file can be loaded again
      loadInput.value = '';
    });

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
  }

  /**
   * Load evaluation results from exported JSON
   */
  function loadEvaluationResults(data) {
    console.log('[App] Loading evaluation results:', data);

    // Handle both full export format and results-only format
    const results = data.results || data;

    if (!results.overallScore && !results.categories && !results.sentenceEvaluations) {
      showError('Invalid evaluation JSON format - missing required fields');
      return;
    }

    // Store in state
    state.evaluationResults = data;

    // Display results
    displayResults(results);

    // Show success status
    showStatus('complete');

    console.log('[App] Successfully loaded evaluation from file');
  }

  /**
   * Update evaluate button state
   */
  function updateEvaluateButtonState() {
    const evaluateBtn = document.getElementById('evaluateBtn');
    const testMode = localStorage.getItem('llmTestMode') === 'true';
    const activeProfile = window.APIConfig.getActiveProfile();
    const needsAPIKey = activeProfile.requiresAPIKey !== false;
    const apiKey = localStorage.getItem('togetherAPIKey');

    // Can evaluate if: files uploaded AND (test mode OR keyless profile OR has API key)
    const canEvaluate = state.criteriaFile && state.dmpFile &&
      (testMode || !needsAPIKey || apiKey);

    evaluateBtn.disabled = !canEvaluate;
  }

  /**
   * Update API key field visibility based on active profile
   */
  function updateAPIKeyVisibility() {
    const activeProfile = window.APIConfig.getActiveProfile();
    const needsAPIKey = activeProfile.requiresAPIKey !== false;

    // Get the API key section by ID
    const apiKeySection = document.getElementById('apiKeySection');

    // Show/hide based on profile requirement
    if (apiKeySection) {
      apiKeySection.style.display = needsAPIKey ? 'block' : 'none';
    }
  }

  /**
   * Update model selection visibility based on active profile
   * DataPLANT profile always uses Qwen3 235B Instruct
   * Together.ai profile shows Together models only
   * LM Studio profile shows LM Studio models only
   */
  function updateModelSelectionVisibility() {
    const activeProfileId = window.APIConfig.getActiveProfileId();
    const modelSection = document.getElementById('modelSelectionSection');
    const dataplanNote = document.getElementById('dataplanModelNote');
    const modelSelect = document.getElementById('togetherAIModel');
    const togetherGroup = document.getElementById('togetherModels');
    const lmstudioGroup = document.getElementById('lmstudioModels');

    if (activeProfileId === 'dataplan') {
      // Hide model selection for dataplan - fixed model
      if (modelSection) {
        modelSection.style.display = 'none';
      }
      if (dataplanNote) {
        dataplanNote.style.display = 'block';
      }
    } else if (activeProfileId === 'together') {
      // Show only Together.ai models
      if (modelSection) {
        modelSection.style.display = 'block';
      }
      if (dataplanNote) {
        dataplanNote.style.display = 'none';
      }
      if (togetherGroup) {
        togetherGroup.style.display = 'block';
        togetherGroup.disabled = false;
      }
      if (lmstudioGroup) {
        lmstudioGroup.style.display = 'none';
        lmstudioGroup.disabled = true;
      }
      // Select first Together model if current selection is from LM Studio group
      const currentModel = modelSelect.value;
      const lmstudioModels = ['minimax/minimax-m2.7', 'qwen3-235b-a22b-instruct-2507-mlx', 'qwen/qwen3.5-9b'];
      if (lmstudioModels.includes(currentModel) || currentModel.includes('mlx')) {
        modelSelect.value = 'Qwen/Qwen3-235B-A22B-Instruct-2507-tput';
        localStorage.setItem('togetherAIModel', modelSelect.value);
      }
    } else if (activeProfileId === 'lmstudio') {
      // Show only LM Studio models
      if (modelSection) {
        modelSection.style.display = 'block';
      }
      if (dataplanNote) {
        dataplanNote.style.display = 'none';
      }
      if (togetherGroup) {
        togetherGroup.style.display = 'none';
        togetherGroup.disabled = true;
      }
      if (lmstudioGroup) {
        lmstudioGroup.style.display = 'block';
        lmstudioGroup.disabled = false;
      }
      // Select first LM Studio model if current selection is from Together group
      const currentModel = modelSelect.value;
      const togetherModels = ['Qwen/Qwen3-235B-A22B-Instruct-2507-tput', 'deepseek-ai/DeepSeek-R1-0528-tput'];
      if (togetherModels.includes(currentModel) || currentModel.startsWith('Qwen/') || currentModel.startsWith('deepseek-ai/')) {
        modelSelect.value = 'minimax/minimax-m2.7';
        localStorage.setItem('togetherAIModel', modelSelect.value);
      }
    } else {
      // For other profiles (openai, custom), show all models
      if (modelSection) {
        modelSection.style.display = 'block';
      }
      if (dataplanNote) {
        dataplanNote.style.display = 'none';
      }
      if (togetherGroup) {
        togetherGroup.style.display = 'block';
        togetherGroup.disabled = false;
      }
      if (lmstudioGroup) {
        lmstudioGroup.style.display = 'block';
        lmstudioGroup.disabled = false;
      }
    }
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

    // Update overall score (now calculated from sentences)
    updateOverallScore(results.overallScore);

    // Update simplified scores table
    updateScoresTable(results.categories);

    // Update sentence-level feedback
    updateSentenceFeedback(results.sentenceEvaluations, results.originalDMPText);

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
      const statusColor = getStatusColor(cat.status);

      row.innerHTML = `
        <td class="criterion-id">${cat.id}</td>
        <td>${cat.name}</td>
        <td class="score-cell" style="color: ${statusColor}; font-weight: 600;">
          ${cat.score}/100
        </td>
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
   * Get status color for score display
   */
  function getStatusColor(status) {
    const colors = {
      'excellent': '#0a6638',
      'good': '#28a745',
      'pass': '#ffc107',
      'insufficient': '#dc3545'
    };
    return colors[status] || '#6c757d';
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
   * Update sentence-level feedback — inline document annotation view
   */
  function updateSentenceFeedback(sentenceEvaluations, originalDMPText) {
    const container = document.getElementById('narrativeFeedback');
    container.innerHTML = '';

    if (!sentenceEvaluations || sentenceEvaluations.length === 0) {
      container.innerHTML = '<div class="alert alert-info"><i class="fas fa-info-circle me-2"></i>No sentence-level evaluations available.</div>';
      return;
    }

    // Score legend
    const legend = document.createElement('div');
    legend.className = 'eval-legend';
    legend.innerHTML = `
      <span class="legend-item"><span class="legend-swatch" style="background:#0a6638"></span>Excellent (90+)</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#28a745"></span>Good (75–89)</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#d39e00"></span>Pass (60–74)</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#dc3545"></span>Insufficient (&lt;60)</span>
    `;
    container.appendChild(legend);

    // If no source text, fall back to flat list of annotated spans
    if (!originalDMPText || originalDMPText.trim().length === 0) {
      sentenceEvaluations.forEach(se => {
        const block = buildAnnotatedParagraph(se.sentence, [se]);
        container.appendChild(block);
      });
      return;
    }

    // Split original text into paragraphs with table/bullet awareness and annotate
    const paragraphs = splitIntoParagraphs(originalDMPText);
    paragraphs.forEach(para => {
      const block = buildAnnotatedParagraph(para, sentenceEvaluations);
      container.appendChild(block);
    });
  }

  /**
   * Split text into paragraphs with special handling for tables and bullet lists.
   * Tables are split into rows, bullet lists into individual bullets.
   */
  function splitIntoParagraphs(text) {
    // First split by double newlines (normal paragraphs)
    const blocks = text.split(/\n\n+/);

    const paragraphs = [];
    for (const block of blocks) {
      const trimmedBlock = block.trim();
      if (trimmedBlock.length < 10) continue;

      // Check if this block contains a table (markdown style with | separators)
      if (trimmedBlock.includes('|') && /\n\|/.test(trimmedBlock)) {
        // This is a multi-line table - split into rows
        const lines = trimmedBlock.split('\n');
        let inTable = false;
        let tableStart = -1;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('|') && line.endsWith('|')) {
            if (!inTable) {
              inTable = true;
              tableStart = i;
            }
            // Add table row as a paragraph (skip separator rows like |---|---|)
            if (!/^[\|:\-\s]+$/.test(line)) {
              paragraphs.push(line);
            }
          } else if (inTable) {
            // Table ended, reset
            inTable = false;
            // Add any non-table content before/after
            if (line.length > 10) {
              paragraphs.push(lines.slice(tableStart === 0 ? 0 : tableStart, i).join('\n'));
            }
          }
        }
      } else if (trimmedBlock.includes('\n- ') || trimmedBlock.includes('\n* ') || /^\s*[-*]\s/.test(trimmedBlock)) {
        // Bullet list - split into individual bullets
        const bulletPattern = /\n(?=[-*]\s)/;
        const bullets = trimmedBlock.split(bulletPattern);
        bullets.forEach(bullet => {
          const cleanBullet = bullet.trim();
          if (cleanBullet.length > 10) {
            paragraphs.push(cleanBullet);
          }
        });
      } else {
        // Regular paragraph
        paragraphs.push(trimmedBlock);
      }
    }

    return paragraphs;
  }

  /**
   * Build one annotated paragraph block (.doc-block)
   */
  function buildAnnotatedParagraph(paragraphText, sentenceEvaluations) {
    const block = document.createElement('div');
    block.className = 'doc-block';

    // Detect heading lines (markdown # syntax)
    const isHeading = /^#{1,4}\s/.test(paragraphText);
    const textEl = document.createElement(isHeading ? 'div' : 'p');
    textEl.className = isHeading ? 'doc-heading' : 'doc-paragraph';

    const displayText = isHeading ? paragraphText.replace(/^#{1,4}\s+/, '') : paragraphText;

    // Find which evaluated sentences appear in this paragraph
    const matches = matchSentencesInText(displayText, sentenceEvaluations);

    if (matches.length === 0) {
      // No annotated sentences — plain text, preserve soft line breaks
      displayText.split('\n').forEach((line, i, arr) => {
        textEl.appendChild(document.createTextNode(line));
        if (i < arr.length - 1) textEl.appendChild(document.createElement('br'));
      });
    } else {
      // Build interleaved plain + annotated spans
      let cursor = 0;
      matches.forEach(m => {
        if (m.start > cursor) {
          textEl.appendChild(document.createTextNode(displayText.slice(cursor, m.start)));
        }
        const span = document.createElement('span');
        span.className = 'eval-sentence ' + getStatusClass(m.se.score);
        span.textContent = displayText.slice(m.start, m.end);
        span.addEventListener('click', () => toggleDetailPanel(block, span, m.se));
        textEl.appendChild(span);
        cursor = m.end;
      });
      if (cursor < displayText.length) {
        textEl.appendChild(document.createTextNode(displayText.slice(cursor)));
      }
    }

    block.appendChild(textEl);

    return block;
  }

  /**
   * Show/hide sentence detail panel - inserted directly after the clicked span
   */
  function toggleDetailPanel(block, span, se) {
    const statusClass = getStatusClass(se.score);
    const isActive = span.classList.contains('active');

    // Remove any existing detail panels in this block
    block.querySelectorAll('.sentence-detail-panel').forEach(p => p.remove());

    // Deactivate all spans in this block
    block.querySelectorAll('.eval-sentence').forEach(s => s.classList.remove('active'));

    if (isActive) {
      // Toggle off - panel already removed
      return;
    }

    // Activate this span
    span.classList.add('active');

    // Create and insert panel directly after the clicked span
    const panel = document.createElement('div');
    const criteriaHtml = se.criteriaIds.map(cid => `<span class="criteria-tag">${cid}</span>`).join('');
    const suggestionHtml = se.suggestion && se.score < 75
      ? `<div class="detail-suggestion"><i class="fas fa-lightbulb text-warning me-1"></i><strong>Suggestion:</strong> ${escapeHtml(se.suggestion)}</div>`
      : '';

    panel.className = `sentence-detail-panel ${statusClass}`;
    panel.innerHTML = `
      <div class="detail-meta">
        <div class="criteria-tags">${criteriaHtml}</div>
        <span class="score-badge score-${statusClass} ms-1">${se.score}/100</span>
      </div>
      <div class="detail-explanation">${escapeHtml(se.explanation)}</div>
      ${suggestionHtml}
    `;

    // Insert panel directly after the span
    span.insertAdjacentElement('afterend', panel);
  }

  /**
   * Match evaluated paragraphs/sentences to positions in paragraph text.
   * Uses fuzzy matching for table rows and handles variations.
   * Returns sorted array of {start, end, se} with no overlaps.
   */
  function matchSentencesInText(text, sentenceEvaluations) {
    const matches = [];
    sentenceEvaluations.forEach(se => {
      const needle = typeof se.sentence === 'string' ? se.sentence.trim() : '';
      if (!needle || needle.length < 10) return;

      // Try exact match first
      let idx = text.indexOf(needle);

      // If no exact match, try fuzzy (first 50 chars)
      if (idx === -1 && needle.length > 50) {
        const prefix = needle.slice(0, 50);
        idx = text.indexOf(prefix);
      }

      // If still no match, try matching by key content words (for tables)
      if (idx === -1 && needle.includes('|')) {
        // Table row: try matching by cell values
        const cells = needle.split('|').filter(c => c.trim().length > 3);
        for (const cell of cells) {
          const cellText = cell.trim();
          idx = text.indexOf(cellText);
          if (idx !== -1) break;
        }
      }

      // If still no match, try last 50 chars (for truncated matches)
      if (idx === -1 && needle.length > 50) {
        const suffix = needle.slice(-50);
        idx = text.indexOf(suffix);
        if (idx !== -1) {
          idx = idx - (needle.length - 50); // Adjust to start position
          if (idx < 0) idx = 0;
        }
      }

      if (idx !== -1) {
        matches.push({ start: idx, end: idx + needle.length, se });
      }
    });

    // Sort by position, remove overlaps
    matches.sort((a, b) => a.start - b.start);
    const deduped = [];
    let lastEnd = 0;
    matches.forEach(m => {
      if (m.start >= lastEnd) {
        deduped.push(m);
        lastEnd = m.end;
      }
    });
    return deduped;
  }

  /**
   * Get status class based on score
   */
  function getStatusClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'pass';
    return 'insufficient';
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

  /**
   * Setup prompt editor listeners
   */
  function setupPromptEditorListeners() {
    const modal = document.getElementById('promptEditorModal');
    const saveBtn = document.getElementById('savePromptBtn');
    const resetBtn = document.getElementById('resetPromptBtn');

    if (!modal) {
      console.warn('[App] Prompt editor modal not found');
      return;
    }

    // Load prompt when modal opens
    modal.addEventListener('show.bs.modal', () => {
      const prompt = window.LLMService.loadPromptFromStorage();
      document.getElementById('systemRoleInput').value = prompt.systemRole;
      document.getElementById('criteriaContextInput').value = prompt.criteriaContext;
      document.getElementById('dmpContextInput').value = prompt.dmpContext;
      updateFullPromptPreview();
    });

    // Update preview on input (debounced)
    const inputs = ['systemRoleInput', 'criteriaContextInput', 'dmpContextInput'];
    let previewTimeout;
    inputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', () => {
          clearTimeout(previewTimeout);
          previewTimeout = setTimeout(updateFullPromptPreview, 500);
        });
      }
    });

    // Save prompt
    saveBtn.addEventListener('click', () => {
      const prompt = {
        systemRole: document.getElementById('systemRoleInput').value,
        criteriaContext: document.getElementById('criteriaContextInput').value,
        dmpContext: document.getElementById('dmpContextInput').value
      };
      window.LLMService.savePromptToStorage(prompt);

      // Visual feedback
      saveBtn.classList.remove('btn-primary');
      saveBtn.classList.add('btn-success');
      saveBtn.innerHTML = '<i class="fas fa-check me-1"></i>Saved!';
      setTimeout(() => {
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-primary');
        saveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Prompt';
      }, 2000);

      console.log('[App] Custom prompt saved');
    });

    // Reset to default
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all prompt sections to default values?')) {
        const defaultPrompt = window.LLMService.getDefaultPrompt();
        document.getElementById('systemRoleInput').value = defaultPrompt.systemRole;
        document.getElementById('criteriaContextInput').value = defaultPrompt.criteriaContext;
        document.getElementById('dmpContextInput').value = defaultPrompt.dmpContext;
        updateFullPromptPreview();
        console.log('[App] Prompt reset to default');
      }
    });
  }

  /**
   * Update full prompt preview
   */
  function updateFullPromptPreview() {
    const preview = document.getElementById('fullPromptPreview');
    if (!preview) return;

    const systemRole = document.getElementById('systemRoleInput').value;
    const criteriaContext = document.getElementById('criteriaContextInput').value;
    const dmpContext = document.getElementById('dmpContextInput').value;

    // Show with example placeholders
    const fullPrompt = `=== SYSTEM PROMPT ===\n${systemRole.replace('{phase}', 'proposal/early')}\n\n` +
                       `=== USER PROMPT ===\n${criteriaContext.replace('{criteriaText}', '[Evaluation criteria will be inserted here]')}\n\n` +
                       dmpContext.replace('{dmpText}', '[DMP document will be inserted here]');
    preview.value = fullPrompt;
  }

})();
