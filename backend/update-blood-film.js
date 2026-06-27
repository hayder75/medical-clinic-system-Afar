/**
 * Update Blood Film for Malaria Test Template
 * 
 * New structure:
 * - Test: Blood Film for Malaria
 * - Result (required): Negative, Positive
 * - If Positive: Species (multi-select)
 * - Optional: Parasite Density (1+ to 4+)
 * - Remark (auto-generated, editable)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateBloodFilmTemplate() {
    console.log('🔄 Updating Blood Film for Malaria template...\n');

    try {
        // Find the Blood Film test (could be PICT001 or PBF001)
        const bloodFilmTest = await prisma.labTest.findFirst({
            where: {
                OR: [
                    { code: 'PICT001' },
                    { code: 'PBF001' },
                    { name: { contains: 'Blood Film', mode: 'insensitive' } },
                    { name: { contains: 'Malaria', mode: 'insensitive' } }
                ]
            },
            include: { resultFields: true }
        });

        if (!bloodFilmTest) {
            console.log('⚠️ Blood Film test not found');
            return;
        }

        console.log(`✅ Found Blood Film test: ${bloodFilmTest.name} (${bloodFilmTest.code})`);

        // Delete existing result fields to rebuild them
        await prisma.labTestResultField.deleteMany({
            where: { testId: bloodFilmTest.id }
        });
        console.log('   🗑️  Deleted old result fields');

        // Create new result fields based on the requirements
        const newFields = [
            {
                fieldName: 'result',
                label: 'Result',
                fieldType: 'select',
                unit: null,
                normalRange: null,
                options: ['Negative', 'Positive'],
                isRequired: true,
                displayOrder: 1
            },
            {
                fieldName: 'species',
                label: 'Species (if Positive)',
                fieldType: 'multiselect',
                unit: null,
                normalRange: null,
                options: [
                    'Plasmodium falciparum',
                    'Plasmodium vivax',
                    'Plasmodium ovale',
                    'Plasmodium malariae',
                    'Mixed infection',
                    'Species not identified'
                ],
                isRequired: false,
                displayOrder: 2
            },
            {
                fieldName: 'parasite_density',
                label: 'Parasite Density',
                fieldType: 'select',
                unit: null,
                normalRange: null,
                options: ['1+', '2+', '3+', '4+'],
                isRequired: false,
                displayOrder: 3
            },
            {
                fieldName: 'remark',
                label: 'Remark',
                fieldType: 'textarea',
                unit: null,
                normalRange: null,
                options: null,
                isRequired: false,
                displayOrder: 4
            }
        ];

        await prisma.labTestResultField.createMany({
            data: newFields.map(field => ({
                testId: bloodFilmTest.id,
                ...field
            }))
        });

        console.log('   ✅ Created new result fields:');
        newFields.forEach(field => {
            console.log(`      - ${field.label} (${field.fieldType}${field.options ? ', ' + field.options.length + ' options' : ''})`);
        });

        // Also update the test name to be more descriptive
        await prisma.labTest.update({
            where: { id: bloodFilmTest.id },
            data: { name: 'Blood Film for Malaria' }
        });

        console.log(`   ✅ Updated test name to "Blood Film for Malaria"`);

        console.log('\n✅ Blood Film for Malaria template updated successfully!');

    } catch (error) {
        console.error('❌ Error updating Blood Film template:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the update
updateBloodFilmTemplate()
    .then(() => {
        console.log('\n🎉 Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });
