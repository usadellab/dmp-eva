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

      // Show warning for showcase models
      const showcaseModels = ['liquid/lfm2.5-1.2b', 'qwen/qwen3-1.7b'];
      if (showcaseModels.includes(e.target.value)) {
        // Only show warning once per session
        if (!sessionStorage.getItem('showcaseModelWarningShown')) {
          alert('⚠️ Showcase Model Notice\n\nThis model is provided for demonstration purposes only.\n\nIt is a small parameter model that may not produce accurate evaluation results or cover all criteria. For reliable DMP evaluations, please use larger models like Qwen3 235B, GLM 4.7, or Mistral Ministral 3 3B.');
          sessionStorage.setItem('showcaseModelWarningShown', 'true');
        }
      }
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
   * Update sentence-level feedback section
   */
  function updateSentenceFeedback(sentenceEvaluations, originalDMPText) {
    const container = document.getElementById('narrativeFeedback');
    container.innerHTML = '';

    // Create header
    const header = document.createElement('div');
    header.className = 'feedback-header mb-3';
    header.innerHTML = `
      <h6><i class="fas fa-file-alt me-2"></i>DMP Document Evaluation</h6>
      <p class="text-muted small">Click sentences to see detailed evaluation</p>
    `;
    container.appendChild(header);

    // Check if we have sentence evaluations
    if (!sentenceEvaluations || sentenceEvaluations.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'alert alert-info';
      noResults.innerHTML = '<i class="fas fa-info-circle me-2"></i>No sentence-level evaluations available. Using legacy feedback format.';
      container.appendChild(noResults);
      return;
    }

    // Build accordion cards
    sentenceEvaluations.forEach((se, index) => {
      const card = createSentenceCard(se, index);
      container.appendChild(card);
    });
  }

  /**
   * Create a sentence accordion card
   */
  function createSentenceCard(se, index) {
    const section = document.createElement('div');
    const statusClass = getStatusClass(se.score);
    const needsSuggestion = se.score < 75;

    section.className = 'sentence-card-accordion';
    section.innerHTML = `
      <div class="sentence-header ${statusClass}">
        <span class="sentence-preview">${escapeHtml(se.sentence)}</span>
        <span class="expand-indicator"><i class="fas fa-chevron-right"></i></span>
      </div>
      <div class="sentence-body">
        <div class="sentence-meta">
          <div class="criteria-tags">
            ${se.criteriaIds.map(cid => `<span class="criteria-tag">${cid}</span>`).join('')}
          </div>
          <div class="score-display">
            <span class="score-badge ${statusClass}">${se.score}/100</span>
          </div>
        </div>
        <div class="explanation">${escapeHtml(se.explanation)}</div>
        ${needsSuggestion && se.suggestion ? `
          <div class="improvement-suggestion">
            <i class="fas fa-lightbulb text-warning me-2"></i>
            <strong>Suggestion:</strong> ${escapeHtml(se.suggestion)}
          </div>
        ` : ''}
      </div>
    `;

    // Click handler
    const headerEl = section.querySelector('.sentence-header');
    headerEl.addEventListener('click', () => {
      section.classList.toggle('expanded');
    });

    return section;
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
   * Get status color based on score
   */
  function getStatusColorByScore(score) {
    if (score >= 90) return '#0a6638';
    if (score >= 75) return '#28a745';
    if (score >= 60) return '#ffc107';
    return '#dc3545';
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
