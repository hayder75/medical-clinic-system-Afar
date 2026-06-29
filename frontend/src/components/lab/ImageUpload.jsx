import React, { useState, useRef } from 'react';
import { Image, X, Upload, Camera } from 'lucide-react';
import api from '../../services/api';

const ImageUpload = ({ onImagesChange, existingImages = [] }) => {
  const [images, setImages] = useState(existingImages);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const compressToBlob = (file, maxDimension = 1024, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = (maxDimension / width) * height;
                width = maxDimension;
              } else {
                width = (maxDimension / height) * width;
                height = maxDimension;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
          } catch { resolve(file); }
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('image', file, file.name);
    const response = await api.post('/labs/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.url;
  };

  const processFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return null;
    const blob = await compressToBlob(file, file === fileInputRef.current?.files?.[0] ? 1024 : 1920, 0.85);
    const uploadFile_obj = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    const url = await uploadFile(uploadFile_obj);
    return { id: Date.now() + Math.random(), url, name: file.name };
  };

  const handleGalleryFiles = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    const results = await Promise.all(files.map(f => processFile(f)));
    const valid = results.filter(Boolean);
    if (valid.length > 0) {
      const updated = [...images, ...valid];
      setImages(updated);
      onImagesChange(updated);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleCameraFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    const result = await processFile(file);
    if (result) {
      const updated = [...images, result];
      setImages(updated);
      onImagesChange(updated);
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeImage = (id) => {
    const updatedImages = images.filter(img => img.id !== id);
    setImages(updatedImages);
    onImagesChange(updatedImages);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
        >
          <Camera size={16} />
          Take Photo
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
        >
          <Upload size={16} />
          Upload from Gallery
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraFile}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleGalleryFiles}
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
                src={img.url || img.data || img} 
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
              src={img.url || img.data || img} 
              alt={`Lab result ${idx + 1}`}
              className="w-full h-16 object-cover rounded border cursor-pointer hover:opacity-90"
              onClick={() => window.open(img.url || img.data || img, '_blank')}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUpload;