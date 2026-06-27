const prisma = require('../config/database');

const SETTING_KEY = 'reportManipulationPercent';

const getManipulationPercent = async () => {
  try {
    const setting = await prisma.systemSettings.findUnique({ where: { key: SETTING_KEY } });
    if (!setting) return 50;
    const val = parseFloat(setting.value);
    return isNaN(val) || val <= 0 ? 50 : Math.min(val, 100);
  } catch {
    return 50;
  }
};

const isNumeric = (val) => typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);

const transformObj = (obj, ratio) => {
  if (Array.isArray(obj)) {
    return obj.map(item => transformObj(item, ratio));
  }
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = transformObj(value, ratio);
    }
    return result;
  }
  if (isNumeric(obj)) {
    return Math.round(obj * ratio * 100) / 100;
  }
  return obj;
};

const reportDataTransform = async (req, res, next) => {
  if (req.user?.role !== 'REPORT') return next();

  const percent = await getManipulationPercent();
  const ratio = percent / 100;

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (body !== null && body !== undefined) {
      try {
        const transformed = transformObj(body, ratio);
        return originalJson(transformed);
      } catch {
        return originalJson(body);
      }
    }
    return originalJson(body);
  };

  next();
};

// Also expose the setting getter/setter for the admin API
reportDataTransform.getPercent = async () => getManipulationPercent();
reportDataTransform.SETTING_KEY = SETTING_KEY;

module.exports = reportDataTransform;
