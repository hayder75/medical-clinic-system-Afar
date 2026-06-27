import React, { useState, useRef } from 'react';
import { Image, X, Upload } from 'lucide-react';

const ImageUpload = ({ onImagesChange, existingImages = [] }) => {
  const [images, setImages] = useState(existingImages);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const newImage = {
            id: Date.now() + Math.random(),
            data: reader.result, // base64
            name: file.name,
            type: file.type
          };
          const updatedImages = [...images, newImage];
          setImages(updatedImages);
          onImagesChange(updatedImages);
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset input
    e.target.value = '';
  };

  const removeImage = (id) => {
    const updatedImages = images.filter(img => img.id !== id);
    setImages(updatedImages);
    onImagesChange(updatedImages);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
        >
          <Upload size={16} />
          Add Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        {images.length > 0 && (
          <span className="text-xs text-gray-500">({images.length} image(s) attached)</span>
        )}
      </div>
      
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map(img => (
            <div key={img.id} className="relative group">
              <img 
                src={img.data} 
                alt={img.name} 
                className="w-full h-20 object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Display component for doctor view
export const ImageGallery = ({ images = [] }) => {
  if (!images || images.length === 0) return null;
  
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-gray-600 mb-1">Attached Images:</p>
      <div className="grid grid-cols-4 gap-2">
        {images.map((img, idx) => (
          <div key={idx} className="relative">
            <img 
              src={img.data || img} 
              alt={`Lab result ${idx + 1}`}
              className="w-full h-16 object-cover rounded border cursor-pointer hover:opacity-90"
              onClick={() => window.open(img.data || img, '_blank')}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUpload;