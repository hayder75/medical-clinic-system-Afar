import React, { useState, useRef } from 'react';
import { Image, X, Upload, Camera } from 'lucide-react';
import api from '../../services/api';
import { getImageUrl } from '../../utils/imageUrl';
import toast from 'react-hot-toast';

const ImageUpload = ({ onImagesChange, existingImages = [] }) => {
  const [images, setImages] = useState(existingImages);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const compressToBlob = (file, maxDimension = 1024, quality = 0.7) => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => { resolve(file); }, 8000);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      (async () => {
        try {
          let bitmap;
          try { bitmap = await createImageBitmap(file); } catch { bitmap = null; }
          if (!bitmap) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                try {
                  let { width, height } = img;
                  if (width > maxDimension || height > maxDimension) {
                    if (width > height) { height = (maxDimension / width) * height; width = maxDimension; }
                    else { width = (maxDimension / height) * width; height = maxDimension; }
                  }
                  canvas.width = width; canvas.height = height;
                  ctx.drawImage(img, 0, 0, width, height);
                  canvas.toBlob((blob) => { clearTimeout(timeout); resolve(blob || file); }, 'image/jpeg', quality);
                } catch { clearTimeout(timeout); resolve(file); }
              };
              img.onerror = () => { clearTimeout(timeout); resolve(file); };
              img.src = e.target.result;
            };
            reader.onerror = () => { clearTimeout(timeout); resolve(file); };
            reader.readAsDataURL(file);
            return;
          }
          let { width, height } = bitmap;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) { height = (maxDimension / width) * height; width = maxDimension; }
            else { width = (maxDimension / height) * width; height = maxDimension; }
          }
          canvas.width = width; canvas.height = height;
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
          canvas.toBlob((blob) => { clearTimeout(timeout); resolve(blob || file); }, 'image/jpeg', quality);
        } catch { clearTimeout(timeout); resolve(file); }
      })();
    });
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('image', file, file.name);
    const response = await api.post('/labs/images/upload', formData);
    return response.data.url;
  };

  const processFile = async (file) => {
    if (!file) return null;
    try {
      const isGallery = file === fileInputRef.current?.files?.[0];
      const maxDim = isGallery ? 1024 : 800;
      const qualityVal = isGallery ? 0.7 : 0.7;
      console.time('compress-' + file.name);
      const blob = await compressToBlob(file, maxDim, qualityVal);
      console.timeEnd('compress-' + file.name);
      const uploadFile_obj = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
      console.log('Uploading file size:', (uploadFile_obj.size / 1024).toFixed(1) + 'KB');
      const url = await uploadFile(uploadFile_obj);
      return { id: Date.now() + Math.random(), url, name: file.name };
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Image upload failed: ' + (err.response?.data?.error || err.message));
      return null;
    }
  };

  const handleGalleryFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    toast.success('Compressing ' + files.length + ' image(s)...');
    const results = await Promise.all(files.map(f => processFile(f)));
    const valid = results.filter(Boolean);
    if (valid.length > 0) {
      const updated = [...images, ...valid];
      setImages(updated);
      onImagesChange(updated);
      toast.success(valid.length + ' image(s) uploaded!');
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleCameraFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      toast.success('Compressing photo...');
      const result = await processFile(file);
      if (result) {
        const updated = [...images, result];
        setImages(updated);
        onImagesChange(updated);
        toast.success('Photo uploaded successfully!');
      } else {
        toast.error('Photo upload failed');
      }
    } catch (err) {
      console.error('Camera upload error:', err);
      toast.error('Failed to upload photo');
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
    <div className="space-y-2 relative">
      {uploading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-600 font-medium">Uploading image...</span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm disabled:opacity-50"
        >
          <Camera size={16} />
          Take Photo
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm disabled:opacity-50"
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
                src={img.url ? getImageUrl(img.url) : (img.data || img)} 
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
              src={img.url ? getImageUrl(img.url) : (img.data || img)} 
              alt={`Lab result ${idx + 1}`}
              className="w-full h-16 object-cover rounded border cursor-pointer hover:opacity-90"
              onClick={() => window.open(img.url ? getImageUrl(img.url) : (img.data || img), '_blank')}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUpload;