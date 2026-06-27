import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { getImageUrl } from '../../utils/imageUrl';

const ImagingViewerTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchImages = async () => {
    try {
      const res = await api.get(`/specialty/images/${patientId}`);
      if (res.data.success) setImages(res.data.images);
    } catch (err) {
      console.error('Error fetching images:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchImages(); }, [patientId]);

  const isImageFile = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading images...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Patient Images</h3>
        <span className="text-sm text-gray-500">{images.length} images</span>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No images found for this patient.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img) => (
              <div key={img.id} className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow" style={{ borderColor: '#E5E7EB' }} onClick={() => setSelectedImage(img)}>
                <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {isImageFile(img.fileName) ? (
                    <img src={getImageUrl(img.filePath)} alt={img.description || 'Patient image'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-gray-400 text-sm text-center px-2">
                      <div className="text-3xl mb-1">&#128196;</div>
                      {img.fileName}
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate">{img.description || img.fileName || 'No description'}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(img.uploadedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>

          {selectedImage && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setSelectedImage(null)}>
              <div className="max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
                  <div>
                    <h4 className="font-medium">{selectedImage.description || selectedImage.fileName || 'Image'}</h4>
                    <p className="text-xs text-gray-500">
                      {new Date(selectedImage.uploadedAt).toLocaleString()}
                      {selectedImage.uploadedBy && ` by ${selectedImage.uploadedBy}`}
                    </p>
                  </div>
                  <button onClick={() => setSelectedImage(null)} className="text-white bg-gray-800 hover:bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center">&times;</button>
                </div>
                <div className="p-4 max-h-[70vh] overflow-auto flex items-center justify-center">
                  {isImageFile(selectedImage.fileName) ? (
                    <img src={getImageUrl(selectedImage.filePath)} alt={selectedImage.description || ''} className="max-w-full max-h-[65vh] object-contain" />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-500">File cannot be previewed: {selectedImage.fileName}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ImagingViewerTab;
