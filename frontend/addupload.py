import re
with open("src/pages/lab/LabOrders.jsx", "r") as f:
    content = f.read()
search = "</div>\n                  )}\n\n                  <div className=\"grid grid-cols-1"
if search in content:
    replace = "</div>\n                  )}\n\n                  {/** Image Upload Section */}\n                  <div className=\"mt-4 p-4 bg-blue-50 rounded-lg\">\n                    <h4 className=\"font-medium text-gray-900 mb-3\">Attach Lab Images</h4>\n                    <ImageUpload\n                      onImagesChange={(images) => {\n                        setLabImages(prev => ({ ...prev, [selectedService]: images }));\n                      }}\n                      existingImages={labImages[selectedService] || []}\n                    />\n                  </div>\n\n                  <div className=\"grid grid-cols-1"
    content = content.replace(search, replace)
    print("Done")
with open("src/pages/lab/LabOrders.jsx", "w") as f:
    f.write(content)
