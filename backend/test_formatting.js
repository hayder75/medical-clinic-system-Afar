
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock formatMedicationName and formatEmergencyInstruction from the frontend logic
function formatMedicationName(name) {
    if (!name) return '';
    let cleanName = name.replace(/ tablet/gi, '')
        .replace(/ capsule/gi, '')
        .replace(/ syrup/gi, '')
        .replace(/ injection/gi, '');
    return cleanName.trim();
}

const MED_FORM_MAP = {
    'TABLET': 'tab',
    'CAPSULE': 'cap',
    'SYRUP': 'ml',
    'INJECTION': 'inj',
    'VIAL': 'vial',
    'AMPOULE': 'vial',
    'CREAM': 'app',
    'OINTMENT': 'app',
    'DROPS': 'gtt',
    'SUSPENSION': 'ml',
    'INHALER': 'puffs',
    'GEL': 'app',
    'LOTION': 'app',
    'SPRAY': 'spray',
    'POWDER': 'powder',
    'SUPPOSITORY': 'supp',
    'INFUSION': 'infusion',
};

const MED_ROUTE_MAP = {
    'PO': 'po',
    'ORAL': 'po',
    'IV': 'IV',
    'IM': 'IM',
    'SC': 'SC',
    'TOP': 'topical',
    'PR': 'PR',
};

const MED_FREQUENCY_MAP = {
    'OD': 'daily',
    'BD': 'twice daily',
    'TID': 'three times daily',
    'QID': 'four times daily',
    'PRN': 'as needed',
    'STAT': 'immediately',
    'AC': 'before meals',
    'PC': 'after meals',
    'HS': 'at bedtime',
    'BID': 'twice daily',
};

function formatEmergencyInstruction(med) {
    if (!med) return { instruction: '', dispense: '', special: '' };

    const amount = (med.frequency || '').trim();
    const form = (med.dosageForm || '').toUpperCase();
    const route = (med.route || '').toUpperCase();
    const freqCode = (med.frequencyPeriod || '').toUpperCase();
    const durationRaw = String(med.duration || '').trim();
    const durationPeriod = String(med.durationPeriod || '').trim();
    const instructions = med.instructions ? String(med.instructions).trim() : '';

    const formAbbr = MED_FORM_MAP[form] || form.toLowerCase() || '';
    const routeAbbr = MED_ROUTE_MAP[route] || route.toLowerCase() || '';
    const freqWords = MED_FREQUENCY_MAP[freqCode] || freqCode.toLowerCase() || '';

    let durationStr = '';
    if (durationRaw) {
        if (/^\d+$/.test(durationRaw)) {
            durationStr = `${durationRaw} days`;
        } else {
            durationStr = durationRaw;
            if (durationPeriod && !durationStr.toLowerCase().includes(durationPeriod.toLowerCase())) {
                durationStr += ` ${durationPeriod}`;
            }
        }
    }

    const mainLine = `${amount} ${formAbbr} ${routeAbbr} ${freqWords}${durationStr ? ` for ${durationStr}` : ''}`.replace(/\s+/g, ' ').trim();

    return {
        instruction: mainLine,
        dispense: '',
        special: instructions ? `Special: ${instructions}` : ''
    };
}

async function main() {
    const latestOrders = await prisma.emergencyDrugOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { service: true }
    });

    console.log("--- FORMATTING TEST ---");
    latestOrders.forEach((order, idx) => {
        // Simulated mapping from doctorController.js
        const med = {
            serviceName: order.service?.name || order.name,
            dosageForm: order.dosageForm,
            strength: order.strength,
            frequency: order.frequency,
            frequencyPeriod: order.frequencyPeriod,
            duration: order.duration,
            durationPeriod: order.durationPeriod,
            route: order.route,
            instructions: order.instructions,
            notes: order.notes
        };

        const medName = formatMedicationName(med.serviceName);
        const results = formatEmergencyInstruction(med);

        console.log(`Order ${idx + 1}: ${medName}${med.strength ? ' ' + med.strength : ''}`);
        console.log(`Instruction: ${results.instruction}`);
        if (results.special || med.notes) console.log(`Notes/Special: ${results.special || med.notes}`);
        console.log("------------------------");
    });
}

main().finally(() => prisma.$disconnect());
