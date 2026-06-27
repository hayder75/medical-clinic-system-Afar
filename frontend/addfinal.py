with open('src/pages/lab/LabOrders.jsx', 'r') as f:
    content = f.read()

search = '''            </div>

            <div className=flex justify-end mt-6 pt-4 border-t>
              <button
                onClick={handleCloseServiceTemplate}
                className=px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors
              >
                Save & Close
              </button>
            </div>'''

replace = '''            </div>

            {/* Image Upload Section - Always visible */}
            <div className=mt-6 p-4 bg-blue-50 rounded-lg>
              <h4 className=font-medium text-gray-900 mb-3>Attach Lab Images (Optional)</h4>
              <ImageUpload
                onImagesChange={(images) => {
                  setLabImages(prev => ({ ...prev, [selectedService]: images }));
                }}
                existingImages={labImages[selectedService] || []}
              />
            </div>

            <div className=flex justify-end mt-6 pt-4 border-t>
              <button
                onClick={handleCloseServiceTemplate}
                className=px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors
              >
                Save & Close
              </button>
            </div>'''

content = content.replace(search, replace)

with open('src/pages/lab/LabOrders.jsx', 'w') as f:
    f.write(content)
print('Done')
