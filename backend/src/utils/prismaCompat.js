const extractMissingColumn = (error) => {
  if (!error) return null;

  if (error.code === 'P2022' && error.meta?.column) {
    const raw = String(error.meta.column);
    return raw.split('.').pop().replace(/[^A-Za-z0-9_]/g, '');
  }

  const message = String(error.message || '');
  const match = message.match(/column\s+`([^`]+)`\s+does not exist/i)
    || message.match(/column\s+"([^"]+)"\s+does not exist/i)
    || message.match(/column\s+'([^']+)'\s+does not exist/i);

  if (!match) return null;
  const raw = match[1] || '';
  return raw.split('.').pop().replace(/[^A-Za-z0-9_]/g, '');
};

const safeCreatePatient = async (prisma, data, options = {}) => {
  const payload = { ...data };
  const droppedColumns = [];
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 8;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await prisma.patient.create({ data: payload });
    } catch (error) {
      const missingColumn = extractMissingColumn(error);
      if (!missingColumn || !(missingColumn in payload)) {
        throw error;
      }

      droppedColumns.push(missingColumn);
      delete payload[missingColumn];

      console.warn(
        `[PrismaCompat] Missing Patient column "${missingColumn}"; retrying create without it. Dropped so far: ${droppedColumns.join(', ')}`
      );
    }
  }

  throw new Error('Patient creation failed after schema-compat retries');
};

module.exports = {
  safeCreatePatient,
};
