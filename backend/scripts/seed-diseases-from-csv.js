const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(v);
};

const normalizeFrequency = (value) => {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (v === 'IMMEDIATE' || v === 'WEEKLY' || v === 'NONE') return v;
  return null;
};

// Minimal CSV parser with quote handling.
const parseCsvLine = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current);
  return cells.map((c) => c.trim());
};

const getValue = (row, headers, names) => {
  for (const name of names) {
    const idx = headers.indexOf(name);
    if (idx >= 0) return row[idx] || '';
  }
  return '';
};

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error('Usage: node scripts/seed-diseases-from-csv.js <path-to-csv>');
    console.error('CSV headers expected: code,name,category,isReportable,reportFrequency');
    process.exit(1);
  }

  const csvPath = path.resolve(process.cwd(), inputArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    console.error('CSV must contain a header and at least one row.');
    process.exit(1);
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const required = ['code', 'name'];
  for (const req of required) {
    if (!headers.includes(req)) {
      console.error(`Missing required header: ${req}`);
      process.exit(1);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`Seeding diseases from: ${csvPath}`);

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const code = getValue(row, headers, ['code']).trim();
    const name = getValue(row, headers, ['name']).trim();

    if (!code || !name) {
      skipped += 1;
      continue;
    }

    const category = getValue(row, headers, ['category']).trim() || null;
    const isReportable = toBool(getValue(row, headers, ['isReportable']), false);
    const reportFrequency = normalizeFrequency(getValue(row, headers, ['reportFrequency'])) || (isReportable ? 'WEEKLY' : null);

    const existing = await prisma.disease.findUnique({ where: { code } });

    await prisma.disease.upsert({
      where: { code },
      update: {
        name,
        category,
        isReportable,
        reportFrequency
      },
      create: {
        code,
        name,
        category,
        isReportable,
        reportFrequency
      }
    });

    if (existing) updated += 1;
    else created += 1;
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
