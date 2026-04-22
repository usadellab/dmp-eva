// =============================================================================
// API CONFIGURATION MODULE
// Manages API profiles and fetch configuration generation
// =============================================================================

(function(window) {
  'use strict';

  // =============================================================================
  // URL OBFUSCATION UTILITIES
  // Simple base64 encoding to hide URL from casual inspection
  // =============================================================================

  /**
   * Obfuscate a URL using base64 encoding
   * @param {string} url - URL to obfuscate
   * @returns {string} - Base64 encoded string
   */
  function obfuscateURL(url) {
    return btoa(url);
  }

  /**
   * Deobfuscate a URL from base64 encoding
   * @param {string} encoded - Base64 encoded string
   * @returns {string} - Original URL or input if not valid base64
   */
  function deobfuscateURL(encoded) {
    try {
      return atob(encoded);
    } catch {
      return encoded; // Return as-is if not valid base64
    }
  }

  // =============================================================================
  // DEFAULT PROFILES
  // =============================================================================

  const DEFAULT_PROFILES = {
    dataplan: {
      name: 'DataPLANT',
      endpoint: 'aHR0cHM6Ly9oLmRhdGFwbGFuLnRvcC92MS9jaGF0L2NvbXBsZXRpb25z',
      requiresAPIKey: false,
      authHeaderTemplate: '',
      additionalHeaders: {
        'Content-Type': 'application/json',
        'Host': 'h.dataplan.top',
        'institution': 'IBG-4'
      },
      modelParamName: 'model',
      messagesParamName: 'messages',
      temperature: 0.3,
      maxTokens: 8000,
      responseFormat: 'json_object',
      streamEnabled: true
    },
    together: {
      name: 'Together.ai (Default)',
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      authHeaderTemplate: 'Bearer {API_KEY}',
      additionalHeaders: {
        'Content-Type': 'application/json'
      },
      modelParamName: 'model',
      messagesParamName: 'messages',
      temperature: 0.3,
      maxTokens: 8000,
      responseFormat: 'json_object',
      streamEnabled: true
    },
    openai: {
      name: 'OpenAI Compatible',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      authHeaderTemplate: 'Bearer {API_KEY}',
      additionalHeaders: {
        'Content-Type': 'application/json'
      },
      modelParamName: 'model',
      messagesParamName: 'messages',
      temperature: 0.3,
      maxTokens: 8000,
      responseFormat: 'json_object',
      streamEnabled: true
    },
    lmstudio: {
      name: 'LM Studio (Local)',
      endpoint: 'http://localhost:1234/v1/chat/completions',
      requiresAPIKey: false,
      authHeaderTemplate: '',
      additionalHeaders: {
        'Content-Type': 'application/json'
      },
      modelParamName: 'model',
      messagesParamName: 'messages',
      temperature: 0.3,
      maxTokens: 16000,
      responseFormat: null,  // LM Studio doesn't support response_format
      streamEnabled: true
    }
  };

  // =============================================================================
  // STORAGE KEYS
  // =============================================================================

  const STORAGE_KEYS = {
    ACTIVE_PROFILE: 'apiActiveProfile',
    CUSTOM_PROFILES: 'apiCustomProfiles'
  };

  // =============================================================================
  // PROFILE MANAGEMENT
  // =============================================================================

  /**
   * Get the active profile ID
   * @returns {string} - Profile ID (together, openai, or custom profile name)
   */
  function getActiveProfileId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE) || 'dataplan';
  }

  /**
   * Set the active profile ID
   * @param {string} profileId - Profile ID to set as active
   */
  function setActiveProfileId(profileId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);
  }

  /**
   * Get all custom profiles
   * @returns {Object} - Object containing custom profiles
   */
  function getCustomProfiles() {
    const profiles = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROFILES);
    return profiles ? JSON.parse(profiles) : {};
  }

  /**
   * Save custom profiles to localStorage
   * @param {Object} profiles - Object containing custom profiles
   */
  function saveCustomProfiles(profiles) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PROFILES, JSON.stringify(profiles));
  }

  /**
   * Get a specific profile by ID
   * @param {string} profileId - Profile ID
   * @returns {Object|null} - Profile configuration or null if not found
   */
  function getProfile(profileId) {
    // Check default profiles first
    if (DEFAULT_PROFILES[profileId]) {
      return { ...DEFAULT_PROFILES[profileId] };
    }

    // Check custom profiles
    const customProfiles = getCustomProfiles();
    if (customProfiles[profileId]) {
      return { ...customProfiles[profileId] };
    }

    return null;
  }

  /**
   * Get the currently active profile
   * @returns {Object} - Active profile configuration
   */
  function getActiveProfile() {
    const profileId = getActiveProfileId();
    const profile = getProfile(profileId);

    // Fallback to default if profile not found
    return profile || { ...DEFAULT_PROFILES.dataplan };
  }

  /**
   * Save a custom profile
   * @param {string} profileId - Profile ID
   * @param {Object} config - Profile configuration
   * @returns {boolean} - Success status
   */
  function saveProfile(profileId, config) {
    // Cannot overwrite default profiles
    if (DEFAULT_PROFILES[profileId]) {
      console.error('Cannot overwrite default profile:', profileId);
      return false;
    }

    const customProfiles = getCustomProfiles();
    customProfiles[profileId] = config;
    saveCustomProfiles(customProfiles);
    return true;
  }

  /**
   * Delete a custom profile
   * @param {string} profileId - Profile ID to delete
   * @returns {boolean} - Success status
   */
  function deleteProfile(profileId) {
    // Cannot delete default profiles
    if (DEFAULT_PROFILES[profileId]) {
      console.error('Cannot delete default profile:', profileId);
      return false;
    }

    const customProfiles = getCustomProfiles();
    if (customProfiles[profileId]) {
      delete customProfiles[profileId];
      saveCustomProfiles(customProfiles);

      // If deleted profile was active, switch to default
      if (getActiveProfileId() === profileId) {
        setActiveProfileId('dataplan');
      }

      return true;
    }

    return false;
  }

  /**
   * Get all available profiles (default + custom)
   * @returns {Object} - Object containing all profiles with their IDs as keys
   */
  function getAllProfiles() {
    const customProfiles = getCustomProfiles();
    return { ...DEFAULT_PROFILES, ...customProfiles };
  }

  /**
   * Check if a profile is a custom profile (not default)
   * @param {string} profileId - Profile ID
   * @returns {boolean}
   */
  function isCustomProfile(profileId) {
    return !DEFAULT_PROFILES[profileId] && getCustomProfiles()[profileId] !== undefined;
  }

  // =============================================================================
  // FETCH CONFIGURATION GENERATION
  // =============================================================================

  /**
   * Generate fetch configuration from a profile
   * @param {Object} profile - Profile configuration
   * @param {string} apiKey - API key to use
   * @param {string} model - Model identifier
   * @param {Array} messages - Chat messages array
   * @returns {Object} - Fetch configuration (url, options)
   */
  function generateFetchConfig(profile, apiKey, model, messages) {
    // Deobfuscate endpoint if needed
    const endpoint = deobfuscateURL(profile.endpoint);

    // Build headers - only add auth if profile requires it
    const headers = { ...profile.additionalHeaders };
    if (profile.requiresAPIKey !== false && apiKey) {
      const authHeader = profile.authHeaderTemplate.replace('{API_KEY}', apiKey);
      headers['Authorization'] = authHeader;
    }

    // Build request body
    const body = {
      [profile.modelParamName]: model,
      [profile.messagesParamName]: messages
    };

    // Add max tokens if specified
    if (profile.maxTokens) {
      body.max_tokens = profile.maxTokens;
    }

    // Add response format if specified
    if (profile.responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    // Add streaming if enabled in profile
    if (profile.streamEnabled !== false) {
      body.stream = true;
    }

    return {
      url: endpoint,
      options: {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      }
    };
  }

  /**
   * Generate a preview of the fetch code for display
   * @param {Object} profile - Profile configuration
   * @returns {string} - Formatted JavaScript code string
   */
  function generateFetchPreview(profile) {
    // Deobfuscate endpoint for preview display
    const endpoint = deobfuscateURL(profile.endpoint);

    // Build headers - only add auth if profile requires it
    const headers = { ...profile.additionalHeaders };
    if (profile.requiresAPIKey !== false) {
      const authHeader = profile.authHeaderTemplate.replace('{API_KEY}', 'YOUR_API_KEY');
      headers['Authorization'] = authHeader;
    }

    const body = {
      [profile.modelParamName]: 'SELECTED_MODEL',
      [profile.messagesParamName]: [
        { role: 'system', content: 'SYSTEM_PROMPT' },
        { role: 'user', content: 'USER_PROMPT' }
      ]
    };

    if (profile.responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    if (profile.streamEnabled !== false) {
      body.stream = true;
    }

    const code = `fetch('${endpoint}', {
  method: 'POST',
  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ')},
  body: JSON.stringify(${JSON.stringify(body, null, 4).replace(/\n/g, '\n    ')})
})`;

    return code;
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  window.APIConfig = {
    // Profile management
    getActiveProfileId,
    setActiveProfileId,
    getProfile,
    getActiveProfile,
    saveProfile,
    deleteProfile,
    getAllProfiles,
    isCustomProfile,

    // Fetch configuration
    generateFetchConfig,
    generateFetchPreview,

    // URL utilities
    obfuscateURL,
    deobfuscateURL,

    // Constants
    DEFAULT_PROFILES
  };

})(window);
