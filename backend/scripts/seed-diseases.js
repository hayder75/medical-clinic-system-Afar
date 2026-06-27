const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const diseases = [
    // Immediately Reportable
    { code: 'AFP', name: 'Acute Flaccid Paralysis (Polio)', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'ANT', name: 'Anthrax', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'AVI', name: 'Avian Human Influenza', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'CHO', name: 'Cholera', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'GUI', name: 'Dracunculiasis (Guinea Worm Disease)', category: 'NTD', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'MEA', name: 'Measles', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'NTE', name: 'Neonatal Tetanus', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'H1N1', name: 'Pandemic Influenza A (H1N1)', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'RAB', name: 'Rabies', category: 'NTD', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'SARS', name: 'Severe Acute Respiratory Syndrome (SARS)', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'SMA', name: 'Smallpox', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'VHF', name: 'Viral Hemorrhagic Fever', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },
    { code: 'YEL', name: 'Yellow Fever', category: 'Communicable', isReportable: true, reportFrequency: 'IMMEDIATE' },

    // Weekly Reportable
    { code: 'DYS', name: 'Dysentery', category: 'Communicable', isReportable: true, reportFrequency: 'WEEKLY' },
    { code: 'MAL_PF', name: 'Malaria (P. falciparum)', category: 'Vector-borne', isReportable: true, reportFrequency: 'WEEKLY' },
    { code: 'MAL_PV', name: 'Malaria (P. vivax)', category: 'Vector-borne', isReportable: true, reportFrequency: 'WEEKLY' },
    { code: 'MAL_CLI', name: 'Malaria (Clinical)', category: 'Vector-borne', isReportable: true, reportFrequency: 'WEEKLY' },
    { code: 'NUT_SAM', name: 'Severe Acute Malnutrition', category: 'Nutritional', isReportable: true, reportFrequency: 'WEEKLY' },
    { code: 'MEN', name: 'Meningitis', category: 'Communicable', isReportable: true, reportFrequency: 'WEEKLY' },
    { code: 'REL', name: 'Relapsing Fever', category: 'Communicable', isReportable: true, reportFrequency: 'WEEKLY' },
    { code: 'TYP', name: 'Typhoid Fever', category: 'Communicable', isReportable: true, reportFrequency: 'WEEKLY' },
    { code: 'TYS', name: 'Epidemic Typhus', category: 'Communicable', isReportable: true, reportFrequency: 'WEEKLY' },

    // Common Diseases (Non-Reportable or Routine)
    { code: 'PNE', name: 'Pneumonia', category: 'Respiratory', isReportable: false, reportFrequency: 'NONE' },
    { code: 'URI', name: 'Acute Upper Respiratory Infection', category: 'Respiratory', isReportable: false, reportFrequency: 'NONE' },
    { code: 'UTI', name: 'Urinary Tract Infection', category: 'Genitourinary', isReportable: false, reportFrequency: 'NONE' },
    { code: 'GAS', name: 'Gastritis / PUD', category: 'Digestive', isReportable: false, reportFrequency: 'NONE' },
    { code: 'HTN', name: 'Hypertension', category: 'NCD', isReportable: false, reportFrequency: 'NONE' },
    { code: 'DM', name: 'Diabetes Mellitus', category: 'NCD', isReportable: false, reportFrequency: 'NONE' },
    { code: 'AST', name: 'Asthma', category: 'NCD', isReportable: false, reportFrequency: 'NONE' },
    { code: 'TB_PUL', name: 'Tuberculosis (Pulmonary)', category: 'Communicable', isReportable: false, reportFrequency: 'NONE' }, // Usually reportable via TB program
    { code: 'TB_EP', name: 'Tuberculosis (Extra-pulmonary)', category: 'Communicable', isReportable: false, reportFrequency: 'NONE' },
    { code: 'HIV', name: 'HIV/AIDS', category: 'Communicable', isReportable: false, reportFrequency: 'NONE' }, // Specific program reporting
    { code: 'DIA_WD', name: 'Diarrhea with Dehydration', category: 'Communicable', isReportable: false, reportFrequency: 'NONE' },
    { code: 'DIA_NOD', name: 'Diarrhea without Dehydration', category: 'Communicable', isReportable: false, reportFrequency: 'NONE' },
    { code: 'IP', name: 'Intestinal Parasites', category: 'Communicable', isReportable: false, reportFrequency: 'NONE' },
    { code: 'SKI', name: 'Skin Infection', category: 'Dermatological', isReportable: false, reportFrequency: 'NONE' },
    { code: 'DEN', name: 'Dental Caries', category: 'Dental', isReportable: false, reportFrequency: 'NONE' },
    { code: 'EYE', name: 'Eye Infection / Conjunctivitis', category: 'Ophthalmological', isReportable: false, reportFrequency: 'NONE' },
    { code: 'EAR', name: 'Otitis Media / Ear Infection', category: 'ENT', isReportable: false, reportFrequency: 'NONE' },
    { code: 'TON', name: 'Tonsillitis', category: 'Respiratory', isReportable: false, reportFrequency: 'NONE' },
    { code: 'BRO', name: 'Bronchitis', category: 'Respiratory', isReportable: false, reportFrequency: 'NONE' },
    { code: 'ANE', name: 'Anemia', category: 'Nutritional', isReportable: false, reportFrequency: 'NONE' },
    { code: 'RHE', name: 'Rheumatism / Joint Pain', category: 'Musculoskeletal', isReportable: false, reportFrequency: 'NONE' },
    { code: 'TRA', name: 'Trauma / Injury', category: 'Injury', isReportable: false, reportFrequency: 'NONE' }
];

async function main() {
    console.log('🌱 Seeding diseases...');

    for (const disease of diseases) {
        await prisma.disease.upsert({
            where: { code: disease.code },
            update: disease,
            create: disease,
        });
    }

    console.log(`✅ Seeded ${diseases.length} diseases.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
