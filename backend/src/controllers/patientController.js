const prisma = require('../config/database');
const { Prisma } = require('@prisma/client');
const validators = require('../utils/validators');

exports.getPatients = async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      where: { status: 'Active' },
      select: { id: true, name: true, type: true, status: true },
    });
    res.json(patients);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: { vitals: true, history: true, appointments: true, files: true },
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Search patients by various criteria
exports.searchPatients = async (req, res) => {
  try {
    const { query, type } = req.query;
    console.log('🔍 Patient search request:', { query, type });

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters long' });
    }

    const searchTerm = query.trim();
    console.log('🔍 Search term:', searchTerm);

    // For patient history search, don't filter by status to show all patients
    let whereClause = {};

    // Build search conditions based on search type
    if (type === 'id') {
      whereClause.id = {
        contains: searchTerm,
        mode: 'insensitive'
      };
    } else if (type === 'phone') {
      whereClause.mobile = {
        contains: searchTerm,
        mode: 'insensitive'
      };
    } else {
      // Default to name search or general search
      // Search with multiple patterns to catch similar names and handle typos
      const searchPatterns = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { name: { startsWith: searchTerm, mode: 'insensitive' } },
        { id: { contains: searchTerm, mode: 'insensitive' } },
        { mobile: { contains: searchTerm, mode: 'insensitive' } }
      ];

      // If search term is 3+ characters, also try searching for similar patterns
      // This helps with typos and similar spellings (e.g., "hayd" vs "hady", "test" vs "tets")
      if (searchTerm.length >= 3) {
        // Try searching with first 3 characters to catch similar names
        const firstThree = searchTerm.substring(0, 3).toLowerCase();
        searchPatterns.push({
          name: {
            contains: firstThree,
            mode: 'insensitive'
          }
        });
        searchPatterns.push({
          name: {
            startsWith: firstThree,
            mode: 'insensitive'
          }
        });

        // For 4+ character searches, try common character variations
        // This handles cases like "hayd" vs "hady" or "test" vs "tets"
        if (searchTerm.length >= 4) {
          // Try variations by swapping last two characters or similar patterns
          // For "hayd" (4 chars), also try "hady" (swapped last two)
          const lastTwo = searchTerm.slice(-2).toLowerCase();
          const swappedLastTwo = lastTwo.split('').reverse().join('');
          const firstPart = searchTerm.substring(0, searchTerm.length - 2).toLowerCase();
          const variation1 = firstPart + swappedLastTwo;

          if (variation1 !== searchTerm.toLowerCase()) {
            searchPatterns.push({
              name: {
                contains: variation1,
                mode: 'insensitive'
              }
            });
            searchPatterns.push({
              name: {
                startsWith: variation1,
                mode: 'insensitive'
              }
            });
          }

          // Also try without the last character (for cases like "hayd" -> "hay")
          if (searchTerm.length > 4) {
            const withoutLast = searchTerm.substring(0, searchTerm.length - 1).toLowerCase();
            searchPatterns.push({
              name: {
                contains: withoutLast,
                mode: 'insensitive'
              }
            });
            searchPatterns.push({
              name: {
                startsWith: withoutLast,
                mode: 'insensitive'
              }
            });
          }
        }
      }

      whereClause.OR = searchPatterns;
    }

    // Search patients directly - include all patients for history search (no status filter)
    // Remove status from whereClause if it exists
    const searchWhereClause = { ...whereClause };
    delete searchWhereClause.status;

    console.log('🔍 Search whereClause:', JSON.stringify(searchWhereClause, null, 2));

    // Use raw SQL for more flexible name matching (handles trailing spaces)
    // First try Prisma query
    let patients = await prisma.patient.findMany({
      where: searchWhereClause,
      select: {
        id: true,
        name: true,
        type: true,
        mobile: true,
        email: true,
        dob: true,
        gender: true,
        bloodType: true,
        status: true,
        cardStatus: true,
        cardActivatedAt: true,
        cardExpiryDate: true,
        createdAt: true
      },
      orderBy: { name: 'asc' },
      take: 20
    });

    // If no results and we're searching by name, try raw SQL with trimmed names
    // This handles trailing spaces in patient names and similar spellings
    if (patients.length === 0 && searchTerm.length >= 2) {
      console.log('🔍 No results with Prisma, trying raw SQL with trimmed names...');
      try {
        const searchPattern = `%${searchTerm}%`;
        const searchPatternStart = `${searchTerm}%`;
        const firstThree = searchTerm.length >= 3 ? searchTerm.substring(0, 3) : null;
        const firstThreePattern = firstThree ? `%${firstThree}%` : null;
        const firstThreeStart = firstThree ? `${firstThree}%` : null;

        let rawQuery = `
          SELECT id, name, type, mobile, email, "dob", gender, "bloodType", status, "cardStatus", "cardActivatedAt", "cardExpiryDate", "createdAt"
          FROM "Patient"
          WHERE 
            LOWER(TRIM(name)) LIKE LOWER($1)
            OR LOWER(TRIM(name)) LIKE LOWER($2)
            OR LOWER(id) LIKE LOWER($1)
            OR LOWER(mobile) LIKE LOWER($1)
        `;
        const params = [searchPattern, searchPatternStart];

        if (firstThreePattern) {
          rawQuery += ` OR LOWER(TRIM(name)) LIKE LOWER($${params.length + 1})`;
          params.push(firstThreePattern);
        }
        if (firstThreeStart) {
          rawQuery += ` OR LOWER(TRIM(name)) LIKE LOWER($${params.length + 1})`;
          params.push(firstThreeStart);
        }

        // For 4+ character searches, try variations (e.g., "hayd" vs "hady", "test" vs "tets")
        if (searchTerm.length >= 4) {
          const lastTwo = searchTerm.slice(-2).toLowerCase();
          const swappedLastTwo = lastTwo.split('').reverse().join('');
          const firstPart = searchTerm.substring(0, searchTerm.length - 2).toLowerCase();
          const variation1 = firstPart + swappedLastTwo;

          if (variation1 !== searchTerm.toLowerCase()) {
            rawQuery += ` OR LOWER(TRIM(name)) LIKE LOWER($${params.length + 1})`;
            params.push(`%${variation1}%`);
            rawQuery += ` OR LOWER(TRIM(name)) LIKE LOWER($${params.length + 1})`;
            params.push(`${variation1}%`);
          }
        }

        rawQuery += ` ORDER BY name ASC LIMIT 20`;

        const rawPatients = await prisma.$queryRawUnsafe(rawQuery, ...params);

        if (rawPatients && rawPatients.length > 0) {
          console.log('🔍 Found patients with raw SQL:', rawPatients.length);
          patients = rawPatients.map(p => ({
            ...p,
            name: p.name?.trim() || p.name
          }));
        }
      } catch (rawError) {
        console.error('🔍 Raw SQL search error:', rawError.message);
      }
    }

    // Filter and trim patient names (remove trailing spaces)
    patients = patients.map(patient => ({
      ...patient,
      name: patient.name?.trim() || patient.name
    }));

    console.log('🔍 Found patients (first query):', patients.length);
    if (patients.length > 0) {
      console.log('🔍 Sample patient:', { id: patients[0].id, name: patients[0].name, status: patients[0].status });
    }

    // If no patients found, try searching by visit ID
    if (patients.length === 0) {
      console.log('🔍 No patients found, trying visit search...');
      const visits = await prisma.visit.findMany({
        where: {
          visitUid: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              type: true,
              mobile: true,
              email: true,
              dob: true,
              gender: true,
              bloodType: true,
              status: true,
              cardStatus: true,
              cardActivatedAt: true,
              cardExpiryDate: true,
              createdAt: true
            }
          }
        },
        take: 20
      });

      console.log('🔍 Found visits:', visits.length);

      // Include all patients from visits, not just Active ones
      patients = visits.map(visit => visit.patient).filter((patient, index, self) =>
        patient && self.findIndex(p => p.id === patient.id) === index
      );

      console.log('🔍 Patients from visits:', patients.length);
    }

    console.log('🔍 Final patients count:', patients.length);
    console.log('🔍 Final patients:', patients.map(p => ({ id: p.id, name: p.name, status: p.status })));


    res.json({
      patients,
      count: patients.length,
      query: searchTerm,
      type: type || 'general'
    });
  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get patient with recent visits for returning patient workflow
exports.getPatientForVisit = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        name: true,
        type: true,
        mobile: true,
        email: true,
        dob: true,
        gender: true,
        bloodType: true,
        maritalStatus: true,
        address: true,
        emergencyContact: true,
        insuranceId: true,
        status: true
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get recent visits (last 5)
    const recentVisits = await prisma.visit.findMany({
      where: { patientId },
      select: {
        id: true,
        visitUid: true,
        status: true,
        createdAt: true,
        completedAt: true,
        notes: true,
        diagnosis: true,
        diagnosisDetails: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      patient,
      recentVisits,
      message: 'Patient found successfully'
    });
  } catch (error) {
    console.error('Error getting patient for visit:', error);
    res.status(500).json({ error: error.message });
  }
};