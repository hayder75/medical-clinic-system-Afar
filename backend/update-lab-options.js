/**
 * Update Lab Test Result Field Options
 * 
 * This script updates:
 * 1. Blood Film - Add Malaria Parasite field with "No H/P Seen" option
 * 2. Stool Examination - Update ova/parasite options to use "No O/P Seen"
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateLabTemplateOptions() {
    console.log('🔄 Starting lab template options update...\n');

    try {
        // 1. Update Blood Film test - Add/Update Malaria Parasite field
        const bloodFilmTest = await prisma.labTest.findFirst({
            where: { code: 'PBF001' },
            include: { resultFields: true }
        });

        if (bloodFilmTest) {
            console.log(`✅ Found Blood Film test: ${bloodFilmTest.name} (${bloodFilmTest.code})`);

            // Check if malaria_parasite field exists
            const malariaField = bloodFilmTest.resultFields.find(f =>
                f.fieldName === 'malaria_parasite' ||
                f.label.toLowerCase().includes('malaria')
            );

            if (malariaField) {
                // Update existing field
                let options = malariaField.options;
                if (typeof options === 'string') {
                    options = JSON.parse(options);
                }
                if (!Array.isArray(options)) {
                    options = [];
                }

                // Add "No H/P Seen" at the beginning
                if (!options.includes('No H/P Seen')) {
                    options = ['No H/P Seen', ...options.filter(o => o !== 'Not Seen' && o !== '')];
                }

                await prisma.labTestResultField.update({
                    where: { id: malariaField.id },
                    data: { options: options }
                });
                console.log(`   ✅ Updated Malaria Parasite field options: ${JSON.stringify(options)}`);
            } else {
                // Create new malaria_parasite field
                const maxOrder = Math.max(...bloodFilmTest.resultFields.map(f => f.displayOrder), 0);

                await prisma.labTestResultField.create({
                    data: {
                        testId: bloodFilmTest.id,
                        fieldName: 'malaria_parasite',
                        label: 'Malaria Parasite',
                        fieldType: 'select',
                        options: ['No H/P Seen', 'P. falciparum', 'P. vivax', 'P. malariae', 'P. ovale', 'Mixed'],
                        isRequired: false,
                        displayOrder: maxOrder + 1
                    }
                });
                console.log(`   ✅ Created new Malaria Parasite field with "No H/P Seen" as default option`);
            }

            // Also update the "result" field if it exists to include "No H/P Seen"
            const resultField = bloodFilmTest.resultFields.find(f => f.fieldName === 'result');
            if (resultField && !resultField.options) {
                await prisma.labTestResultField.update({
                    where: { id: resultField.id },
                    data: {
                        fieldType: 'select',
                        options: ['No H/P Seen', 'P. falciparum (+)', 'P. falciparum (++)', 'P. falciparum (+++)', 'P. vivax (+)', 'P. vivax (++)', 'P. vivax (+++)', 'Mixed infection']
                    }
                });
                console.log(`   ✅ Updated Result field with malaria-specific options including "No H/P Seen"`);
            }
        } else {
            console.log('⚠️ Blood Film test not found');
        }

        console.log('');

        // 2. Update Stool Examination - Update ova and parasite fields
        const stoolTest = await prisma.labTest.findFirst({
            where: { code: 'STOOL001' },
            include: { resultFields: true }
        });

        if (stoolTest) {
            console.log(`✅ Found Stool test: ${stoolTest.name} (${stoolTest.code})`);

            // Update OVA field
            const ovaField = stoolTest.resultFields.find(f => f.fieldName === 'ova');
            if (ovaField) {
                await prisma.labTestResultField.update({
                    where: { id: ovaField.id },
                    data: {
                        options: ['No O/P Seen', 'Seen']
                    }
                });
                console.log(`   ✅ Updated OVA field options: ["No O/P Seen", "Seen"]`);
            }

            // Update Parasite field
            const parasiteField = stoolTest.resultFields.find(f => f.fieldName === 'parasite');
            if (parasiteField) {
                await prisma.labTestResultField.update({
                    where: { id: parasiteField.id },
                    data: {
                        options: ['No O/P Seen', 'Seen']
                    }
                });
                console.log(`   ✅ Updated Parasite field options: ["No O/P Seen", "Seen"]`);
            }
        } else {
            console.log('⚠️ Stool Examination test not found');
        }

        console.log('\n✅ Lab template options update completed!');

    } catch (error) {
        console.error('❌ Error updating lab template options:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the update
updateLabTemplateOptions()
    .then(() => {
        console.log('\n🎉 Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });
