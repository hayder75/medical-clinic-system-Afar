const fs = require('fs');
const content = fs.readFileSync('src/pages/lab/LabOrders.jsx', 'utf8');

// Add import after the first import
let updated = content.replace(
  'import { TestTube',
  'import ImageUpload from "./../components/lab/ImageUpload";\nimport { TestTube'
);

// Add state after showCBCAdditionalFields
updated = updated.replace(
  'const [showCBCAdditionalFields, setShowCBCAdditionalFields] = useState({});',
  'const [showCBCAdditionalFields, setShowCBCAdditionalFields] = useState({});\n  const [labImages, setLabImages] = useState({});'
);

// Find the location after test info and add ImageUpload
const insertAfter = 'testResults[selectedService].labTest.group && (';
const insertCode = `

                  {/* Image Upload Section */}
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <ImageUpload
                      onImagesChange={(images) => {
                        setLabImages(prev => ({ ...prev, [selectedService]: images }));
                      }}
                      existingImages={labImages[selectedService] || []}
                    />
                  </div>
`;

updated = updated.replace(insertAfter, insertAfter + insertCode);

fs.writeFileSync('src/pages/lab/LabOrders.jsx', updated);
console.log('Done');