const prisma = require('../config/database');

const DOCTOR_WORKSPACE_PROFILES = ['general', 'dentist', 'dermatology', 'healthOfficer', 'obgyn', 'pediatrician', 'internist', 'surgeon', 'orthopedic', 'physiotherapist'];
const DOCTOR_WORKSPACE_ACTIVE_TABS = [
  'triage',
  'vitals',
  'patient-history',
  'images',
  'procedures',
  'dental',
  'dental-services',
  'notes',
  'medications',
  'compound-prescription',
  'emergency-drugs',
  'material-needs',
  'lab',
  'radiology',
  'nurse-services',
  'accommodation',
  'pregnancy',
  'growth-chart',
  'vaccination',
  'development',
  'chronic-disease',
  'surgical-notes',
  'imaging-viewer',
  'body-chart',
  'exercise-rx',
  'outcome-scores'
];
const DOCTOR_WORKSPACE_COMPLETED_TABS = [
  'triage',
  'vitals',
  'patient-history',
  'images',
  'procedures',
  'dental',
  'dental-services',
  'notes',
  'medications',
  'compound-prescription',
  'emergency-drugs',
  'material-needs',
  'lab',
  'radiology',
  'nurse-services',
  'accommodation',
  'pregnancy',
  'growth-chart',
  'vaccination',
  'development',
  'chronic-disease',
  'surgical-notes',
  'imaging-viewer',
  'body-chart',
  'exercise-rx',
  'outcome-scores'
];

const DOCTOR_WORKSPACE_TRIAGE_TABS = [...DOCTOR_WORKSPACE_ACTIVE_TABS];

const createDefaultDoctorWorkspaceConfig = () => ({
  completedVisitsEnabled: true,
  triageQueueEnabled: true,
  activeTabVisibility: {
    general: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation'
    ],
    dentist: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'dental',
      'dental-services',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation'
    ],
    dermatology: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation'
    ],
    healthOfficer: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation'
    ],
    obgyn: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation',
      'pregnancy'
    ],
    pediatrician: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation',
      'growth-chart',
      'vaccination',
      'development'
    ],
    internist: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation',
      'chronic-disease'
    ],
    surgeon: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation',
      'surgical-notes',
      'imaging-viewer'
    ],
    orthopedic: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation',
      'imaging-viewer'
    ],
    physiotherapist: [
      'triage',
      'vitals',
      'patient-history',
      'images',
      'procedures',
      'notes',
      'medications',
      'compound-prescription',
      'emergency-drugs',
      'material-needs',
      'lab',
      'radiology',
      'nurse-services',
      'accommodation',
      'body-chart',
      'exercise-rx',
      'outcome-scores'
    ]
  },
  completedTabVisibility: {
    general: [...DOCTOR_WORKSPACE_COMPLETED_TABS],
    dentist: [...DOCTOR_WORKSPACE_COMPLETED_TABS],
    dermatology: [...DOCTOR_WORKSPACE_COMPLETED_TABS],
    healthOfficer: [...DOCTOR_WORKSPACE_COMPLETED_TABS],
    obgyn: [...DOCTOR_WORKSPACE_COMPLETED_TABS],
    pediatrician: [...DOCTOR_WORKSPACE_COMPLETED_TABS],
    internist: [...DOCTOR_WORKSPACE_COMPLETED_TABS],
    surgeon: [...DOCTOR_WORKSPACE_COMPLETED_TABS],
    orthopedic: [...DOCTOR_WORKSPACE_COMPLETED_TABS],
    physiotherapist: [...DOCTOR_WORKSPACE_COMPLETED_TABS]
  },
  triageTabVisibility: {
    general: [...DOCTOR_WORKSPACE_TRIAGE_TABS],
    dentist: [...DOCTOR_WORKSPACE_TRIAGE_TABS],
    dermatology: [...DOCTOR_WORKSPACE_TRIAGE_TABS],
    healthOfficer: [...DOCTOR_WORKSPACE_TRIAGE_TABS],
    obgyn: [...DOCTOR_WORKSPACE_TRIAGE_TABS],
    pediatrician: [...DOCTOR_WORKSPACE_TRIAGE_TABS],
    internist: [...DOCTOR_WORKSPACE_TRIAGE_TABS],
    surgeon: [...DOCTOR_WORKSPACE_TRIAGE_TABS],
    orthopedic: [...DOCTOR_WORKSPACE_TRIAGE_TABS],
    physiotherapist: [...DOCTOR_WORKSPACE_TRIAGE_TABS]
  }
});

const SYSTEM_SETTING_DEFAULTS = {
  cardExpiryPeriodDays: {
    value: '30',
    description: 'Number of days before a card expires after activation'
  },
  oldPatientRegistrationMode: {
    value: 'false',
    description: 'Enable old-patient registration mode for migration billing'
  },
  doctorWorkspaceConfig: {
    value: JSON.stringify(createDefaultDoctorWorkspaceConfig()),
    description: 'Doctor workspace configuration for completed-visit review and role-based tab visibility'
  },
  enableDoctorTransfer: {
    value: 'true',
    description: 'Enable/disable the doctor-to-doctor patient transfer feature'
  }
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const normalizeTabList = (value, allowedTabs, fallback) => {
  if (!Array.isArray(value)) return [...fallback];

  const allowedSet = new Set(allowedTabs);
  const normalized = [];

  value.forEach((entry) => {
    const tabId = String(entry || '').trim();
    if (!allowedSet.has(tabId) || normalized.includes(tabId)) {
      return;
    }
    normalized.push(tabId);
  });

  return normalized.length > 0 ? normalized : [...fallback];
};

const normalizeProfileTabVisibility = (value, allowedTabs, defaults) => {
  const source = value && typeof value === 'object' ? value : {};

  return DOCTOR_WORKSPACE_PROFILES.reduce((result, profile) => {
    result[profile] = normalizeTabList(source[profile], allowedTabs, defaults[profile]);
    return result;
  }, {});
};

const normalizeDoctorWorkspaceConfig = (value) => {
  const defaults = createDefaultDoctorWorkspaceConfig();
  const source = value && typeof value === 'object' ? value : {};
  const isLegacyConfig = source.triageQueueEnabled === undefined && source.triageTabVisibility === undefined;

  const completedTabVisibility = isLegacyConfig
    ? defaults.completedTabVisibility
    : normalizeProfileTabVisibility(
      source.completedTabVisibility,
      DOCTOR_WORKSPACE_COMPLETED_TABS,
      defaults.completedTabVisibility
    );

  const triageTabVisibility = normalizeProfileTabVisibility(
    source.triageTabVisibility,
    DOCTOR_WORKSPACE_TRIAGE_TABS,
    defaults.triageTabVisibility
  );

  return {
    completedVisitsEnabled: normalizeBoolean(source.completedVisitsEnabled, true),
    triageQueueEnabled: normalizeBoolean(source.triageQueueEnabled, true),
    activeTabVisibility: normalizeProfileTabVisibility(
      source.activeTabVisibility,
      DOCTOR_WORKSPACE_ACTIVE_TABS,
      defaults.activeTabVisibility
    ),
    completedTabVisibility,
    triageTabVisibility
  };
};

const parseDoctorWorkspaceConfig = (value) => {
  if (!value) {
    return createDefaultDoctorWorkspaceConfig();
  }

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return normalizeDoctorWorkspaceConfig(parsed);
  } catch (error) {
    console.warn('Invalid doctorWorkspaceConfig detected, falling back to defaults:', error.message);
    return createDefaultDoctorWorkspaceConfig();
  }
};

const resolveDoctorWorkspaceProfile = (user) => {
  const specialty = String(user?.specialty || '').toLowerCase().trim();
  const role = String(user?.role || '').toUpperCase();
  const qualifications = Array.isArray(user?.qualifications)
    ? user.qualifications.map((item) => String(item || '').toUpperCase())
    : [];

  const hasQualification = (matcher) => qualifications.some((item) => matcher(item));

  // Check explicit specialty first
  if (specialty && DOCTOR_WORKSPACE_PROFILES.includes(specialty)) {
    return specialty;
  }

  // Fall back to qualification-based detection
  if (
    role.includes('HEALTH_OFFICER') ||
    role === 'HO' ||
    hasQualification((item) => item.includes('HEALTH OFFICER') || item.includes('HEALTH_OFFICER') || item === 'HO')
  ) {
    return 'healthOfficer';
  }

  if (role === 'DERMATOLOGY' || hasQualification((item) => item.includes('DERM'))) {
    return 'dermatology';
  }

  if (role.includes('DENT') || hasQualification((item) => item.includes('DENT'))) {
    return 'dentist';
  }

  return 'general';
};

// Get all system settings
exports.getSystemSettings = async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findMany({
      orderBy: { key: 'asc' },
      include: {
        updatedBy: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        }
      }
    });

    // Convert to key-value object for easier access
    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.key] = {
        value: setting.value,
        description: setting.description,
        updatedAt: setting.updatedAt,
        updatedBy: setting.updatedBy
      };
    });

    res.json({ settings: settingsObject, raw: settings });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get a specific setting by key
exports.getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    let setting = await prisma.systemSettings.findUnique({
      where: { key },
      include: {
        updatedBy: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        }
      }
    });

    // If setting doesn't exist, return default
    if (!setting) {
      // Return default values for known settings
      if (SYSTEM_SETTING_DEFAULTS[key]) {
        return res.json({ setting: { key, ...SYSTEM_SETTING_DEFAULTS[key], value: SYSTEM_SETTING_DEFAULTS[key].value } });
      }
      
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ setting });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update a system setting
exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    const userId = req.user?.id;

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value is required' });
    }

    let persistedValue = value;
    let persistedDescription = description;

    // Validate cardExpiryPeriodDays is a positive number
    if (key === 'cardExpiryPeriodDays') {
      const days = parseInt(value);
      if (isNaN(days) || days <= 0) {
        return res.status(400).json({ error: 'Card expiry period must be a positive number of days' });
      }
    }

    if (key === 'oldPatientRegistrationMode') {
      const normalized = String(value).toLowerCase();
      if (!['true', 'false', '1', '0'].includes(normalized)) {
        return res.status(400).json({ error: 'oldPatientRegistrationMode must be true or false' });
      }
    }

    if (key === 'doctorWorkspaceConfig') {
      let parsedConfig;
      try {
        parsedConfig = typeof value === 'string' ? JSON.parse(value) : value;
      } catch (error) {
        return res.status(400).json({ error: 'doctorWorkspaceConfig must be valid JSON' });
      }

      persistedValue = JSON.stringify(normalizeDoctorWorkspaceConfig(parsedConfig));
      persistedDescription = description || SYSTEM_SETTING_DEFAULTS.doctorWorkspaceConfig.description;
    }

    if (persistedValue === undefined || persistedValue === null) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Upsert setting (create if doesn't exist, update if exists)
    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: {
        value: typeof persistedValue === 'string' ? persistedValue : persistedValue.toString(),
        description: persistedDescription || undefined,
        updatedById: userId,
        updatedAt: new Date()
      },
      create: {
        key,
        value: typeof persistedValue === 'string' ? persistedValue : persistedValue.toString(),
        description: persistedDescription || undefined,
        updatedById: userId
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        }
      }
    });

    res.json({
      message: 'Setting updated successfully',
      setting
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to get card expiry period (used by other controllers)
exports.getDoctorTransferEnabled = async () => {
  try {
    const setting = await prisma.systemSettings.findUnique({ where: { key: 'enableDoctorTransfer' } });
    if (!setting) return normalizeBoolean(SYSTEM_SETTING_DEFAULTS.enableDoctorTransfer.value);
    return normalizeBoolean(setting.value);
  } catch {
    return true;
  }
};

exports.getCardExpiryPeriodDays = async () => {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'cardExpiryPeriodDays' }
    });
    
    if (setting) {
      return parseInt(setting.value) || 30; // Default to 30 days
    }
    
    // If setting doesn't exist, create it with default value
    await prisma.systemSettings.create({
      data: {
        key: 'cardExpiryPeriodDays',
        value: '30',
        description: 'Number of days before a card expires after activation'
      }
    });
    
    return 30;
  } catch (error) {
    console.error('Error getting card expiry period:', error);
    return 30; // Default fallback
  }
};

exports.getOldPatientRegistrationMode = async () => {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'oldPatientRegistrationMode' }
    });

    if (setting) {
      return String(setting.value).toLowerCase() === 'true';
    }

    await prisma.systemSettings.create({
      data: {
        key: 'oldPatientRegistrationMode',
        value: 'false',
        description: 'Enable old-patient registration mode for migration billing'
      }
    });

    return false;
  } catch (error) {
    console.error('Error getting old patient registration mode:', error);
    return false;
  }
};

exports.getDoctorWorkspaceConfig = async () => {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'doctorWorkspaceConfig' }
    });

    if (setting) {
      return parseDoctorWorkspaceConfig(setting.value);
    }

    const defaultConfig = createDefaultDoctorWorkspaceConfig();
    await prisma.systemSettings.create({
      data: {
        key: 'doctorWorkspaceConfig',
        value: JSON.stringify(defaultConfig),
        description: SYSTEM_SETTING_DEFAULTS.doctorWorkspaceConfig.description
      }
    });

    return defaultConfig;
  } catch (error) {
    console.error('Error getting doctor workspace config:', error);
    return createDefaultDoctorWorkspaceConfig();
  }
};

exports.resolveDoctorWorkspaceProfile = resolveDoctorWorkspaceProfile;
exports.createDefaultDoctorWorkspaceConfig = createDefaultDoctorWorkspaceConfig;
exports.normalizeDoctorWorkspaceConfig = normalizeDoctorWorkspaceConfig;
exports.DOCTOR_WORKSPACE_PROFILES = DOCTOR_WORKSPACE_PROFILES;
exports.DOCTOR_WORKSPACE_ACTIVE_TABS = DOCTOR_WORKSPACE_ACTIVE_TABS;
exports.DOCTOR_WORKSPACE_COMPLETED_TABS = DOCTOR_WORKSPACE_COMPLETED_TABS;
exports.DOCTOR_WORKSPACE_TRIAGE_TABS = DOCTOR_WORKSPACE_TRIAGE_TABS;

