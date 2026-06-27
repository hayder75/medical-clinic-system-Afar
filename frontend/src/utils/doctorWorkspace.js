export const DOCTOR_WORKSPACE_PROFILES = ['general', 'dentist', 'dermatology', 'healthOfficer', 'obgyn', 'pediatrician', 'internist', 'surgeon', 'orthopedic', 'physiotherapist'];

export const DOCTOR_WORKSPACE_PROFILE_LABELS = {
  general: 'General Doctor',
  dentist: 'Dentist',
  dermatology: 'Dermatology',
  healthOfficer: 'Health Officer',
  obgyn: 'OB/GYN',
  pediatrician: 'Pediatrician',
  internist: 'Internist',
  surgeon: 'Surgeon',
  orthopedic: 'Orthopedic',
  physiotherapist: 'Physiotherapist'
};

export const ACTIVE_DOCTOR_TAB_OPTIONS = [
  { id: 'triage', label: 'Triage' },
  { id: 'vitals', label: 'Vitals & History' },
  { id: 'patient-history', label: 'Patient History' },
  { id: 'images', label: 'Attached Images' },
  { id: 'procedures', label: 'Procedures' },
  { id: 'dental', label: 'Dental Chart' },
  { id: 'dental-services', label: 'Dental Services' },
  { id: 'notes', label: 'Diagnosis Notes' },
  { id: 'medications', label: 'Medications' },
  { id: 'compound-prescription', label: 'Compound Rx' },
  { id: 'emergency-drugs', label: 'Emergency Drugs' },
  { id: 'material-needs', label: 'Material Needs' },
  { id: 'lab', label: 'Lab Orders' },
  { id: 'radiology', label: 'Radiology Orders' },
  { id: 'nurse-services', label: 'Nurse Services' },
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'pregnancy', label: 'Pregnancy' },
  { id: 'growth-chart', label: 'Growth Chart' },
  { id: 'vaccination', label: 'Vaccination' },
  { id: 'development', label: 'Development' },
  { id: 'chronic-disease', label: 'Chronic Disease' },
  { id: 'surgical-notes', label: 'Surgical Notes' },
  { id: 'imaging-viewer', label: 'Imaging Viewer' },
  { id: 'body-chart', label: 'Body Chart' },
  { id: 'exercise-rx', label: 'Exercise Rx' },
  { id: 'outcome-scores', label: 'Outcome Scores' }
];

export const COMPLETED_DOCTOR_TAB_OPTIONS = [
  { id: 'triage', label: 'Triage' },
  { id: 'vitals', label: 'Vitals & History' },
  { id: 'patient-history', label: 'Patient History' },
  { id: 'images', label: 'Attached Images' },
  { id: 'procedures', label: 'Procedures' },
  { id: 'dental', label: 'Dental Chart' },
  { id: 'dental-services', label: 'Dental Services' },
  { id: 'notes', label: 'Diagnosis Notes' },
  { id: 'medications', label: 'Medications' },
  { id: 'compound-prescription', label: 'Compound Rx' },
  { id: 'emergency-drugs', label: 'Emergency Drugs' },
  { id: 'material-needs', label: 'Material Needs' },
  { id: 'lab', label: 'Lab Orders' },
  { id: 'radiology', label: 'Radiology Orders' },
  { id: 'nurse-services', label: 'Nurse Services' },
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'pregnancy', label: 'Pregnancy' },
  { id: 'growth-chart', label: 'Growth Chart' },
  { id: 'vaccination', label: 'Vaccination' },
  { id: 'development', label: 'Development' },
  { id: 'chronic-disease', label: 'Chronic Disease' },
  { id: 'surgical-notes', label: 'Surgical Notes' },
  { id: 'imaging-viewer', label: 'Imaging Viewer' },
  { id: 'body-chart', label: 'Body Chart' },
  { id: 'exercise-rx', label: 'Exercise Rx' },
  { id: 'outcome-scores', label: 'Outcome Scores' }
];

export const TRIAGE_DOCTOR_TAB_OPTIONS = [...ACTIVE_DOCTOR_TAB_OPTIONS];

export const DEFAULT_DOCTOR_WORKSPACE_CONFIG = {
  completedVisitsEnabled: true,
  triageQueueEnabled: true,
  activeTabVisibility: {
    general: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation'],
    dentist: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'dental', 'dental-services', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation'],
    dermatology: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation'],
    healthOfficer: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation'],
    obgyn: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation', 'pregnancy'],
    pediatrician: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation', 'growth-chart', 'vaccination', 'development'],
    internist: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation', 'chronic-disease'],
    surgeon: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation', 'surgical-notes', 'imaging-viewer'],
    orthopedic: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation', 'imaging-viewer'],
    physiotherapist: ['triage', 'vitals', 'patient-history', 'images', 'procedures', 'notes', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services', 'accommodation', 'body-chart', 'exercise-rx', 'outcome-scores']
  },
  completedTabVisibility: {
    general: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    dentist: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    dermatology: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    healthOfficer: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    obgyn: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    pediatrician: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    internist: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    surgeon: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    orthopedic: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    physiotherapist: COMPLETED_DOCTOR_TAB_OPTIONS.map((tab) => tab.id)
  },
  triageTabVisibility: {
    general: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    dentist: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    dermatology: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    healthOfficer: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    obgyn: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    pediatrician: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    internist: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    surgeon: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    orthopedic: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id),
    physiotherapist: TRIAGE_DOCTOR_TAB_OPTIONS.map((tab) => tab.id)
  }
};

const cloneConfig = (config) => ({
  completedVisitsEnabled: config.completedVisitsEnabled,
  triageQueueEnabled: config.triageQueueEnabled,
  activeTabVisibility: DOCTOR_WORKSPACE_PROFILES.reduce((result, profile) => {
    result[profile] = [...(config.activeTabVisibility[profile] || [])];
    return result;
  }, {}),
  completedTabVisibility: DOCTOR_WORKSPACE_PROFILES.reduce((result, profile) => {
    result[profile] = [...(config.completedTabVisibility[profile] || [])];
    return result;
  }, {}),
  triageTabVisibility: DOCTOR_WORKSPACE_PROFILES.reduce((result, profile) => {
    result[profile] = [...(config.triageTabVisibility[profile] || [])];
    return result;
  }, {})
});

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const normalizeTabList = (value, options, fallback) => {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set(options.map((option) => option.id));
  const unique = [];

  value.forEach((entry) => {
    const id = String(entry || '').trim();
    if (!allowed.has(id) || unique.includes(id)) {
      return;
    }
    unique.push(id);
  });

  return unique.length > 0 ? unique : [...fallback];
};

const normalizeTabVisibility = (value, options, defaults) => {
  const source = value && typeof value === 'object' ? value : {};

  return DOCTOR_WORKSPACE_PROFILES.reduce((result, profile) => {
    result[profile] = normalizeTabList(source[profile], options, defaults[profile]);
    return result;
  }, {});
};

export const normalizeDoctorWorkspaceConfig = (value) => {
  const defaults = cloneConfig(DEFAULT_DOCTOR_WORKSPACE_CONFIG);
  const source = value && typeof value === 'object' ? value : {};
  const isLegacyConfig = source.triageQueueEnabled === undefined && source.triageTabVisibility === undefined;

  const completedTabVisibility = isLegacyConfig
    ? defaults.completedTabVisibility
    : normalizeTabVisibility(source.completedTabVisibility, COMPLETED_DOCTOR_TAB_OPTIONS, defaults.completedTabVisibility);

  const triageTabVisibility = normalizeTabVisibility(
    source.triageTabVisibility,
    TRIAGE_DOCTOR_TAB_OPTIONS,
    defaults.triageTabVisibility
  );

  return {
    completedVisitsEnabled: normalizeBoolean(source.completedVisitsEnabled, true),
    triageQueueEnabled: normalizeBoolean(source.triageQueueEnabled, true),
    activeTabVisibility: normalizeTabVisibility(source.activeTabVisibility, ACTIVE_DOCTOR_TAB_OPTIONS, defaults.activeTabVisibility),
    completedTabVisibility,
    triageTabVisibility
  };
};

export const parseDoctorWorkspaceConfig = (rawValue) => {
  if (!rawValue) {
    return cloneConfig(DEFAULT_DOCTOR_WORKSPACE_CONFIG);
  }

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    return normalizeDoctorWorkspaceConfig(parsed);
  } catch (error) {
    console.warn('Failed to parse doctor workspace config:', error);
    return cloneConfig(DEFAULT_DOCTOR_WORKSPACE_CONFIG);
  }
};

export const getAllowedDoctorTabs = (config, profile, mode = 'active') => {
  const normalizedConfig = normalizeDoctorWorkspaceConfig(config);
  const normalizedProfile = DOCTOR_WORKSPACE_PROFILES.includes(profile) ? profile : 'general';
  const activeTabs = normalizedConfig.activeTabVisibility[normalizedProfile] || normalizedConfig.activeTabVisibility.general || [];
  const source = mode === 'completed'
    ? normalizedConfig.completedTabVisibility
    : mode === 'triage'
      ? normalizedConfig.triageTabVisibility
      : normalizedConfig.activeTabVisibility;

  const modeTabs = source[normalizedProfile] || source.general || [];

  if (mode === 'active') {
    return modeTabs;
  }

  return modeTabs.filter((tabId) => activeTabs.includes(tabId));
};

export const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};