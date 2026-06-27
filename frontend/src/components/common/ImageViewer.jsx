import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Eye } from 'lucide-react';
import { getImageUrl } from '../../utils/imageUrl';

const ImageViewer = ({ isOpen, onClose, images, currentIndex = 0 }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageIndex, setImageIndex] = useState(currentIndex);

  // Removed excessive debug logging

  useEffect(() => {
    setImageIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (images.length > 1) {
            setImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
          }
          break;
        case 'ArrowRight':
          if (images.length > 1) {
            setImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
          }
          break;
        case '+':
        case '=':
          setZoom(prev => Math.min(prev + 0.25, 3));
          break;
        case '-':
          setZoom(prev => Math.max(prev - 0.25, 0.25));
          break;
        case 'r':
        case 'R':
          setRotation(prev => (prev + 90) % 360);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length, onClose]);

  if (!isOpen || !images || images.length === 0) {
    return null;
  }

  const currentImage = images[imageIndex];

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = getImageUrl(currentImage.filePath || currentImage.fileUrl);
    link.download = currentImage.fileName || 'radiology-image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold">
              {currentImage.fileName || 'Radiology Image'}
            </h3>
            {images.length > 1 && (
              <span className="text-sm text-gray-300">
                {imageIndex + 1} of {images.length}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Navigation for multiple images */}
            {images.length > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                  disabled={images.length <= 1}
                >
                  ←
                </button>
                <button
                  onClick={() => setImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                  disabled={images.length <= 1}
                >
                  →
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Image Container */}
      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-16 lg:p-20 overflow-hidden">
        <img
          src={getImageUrl(currentImage.filePath || currentImage.fileUrl || currentImage.path)}
          alt={currentImage.fileName || currentImage.name || 'Radiology image'}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            cursor: zoom > 1 ? 'grab' : 'zoom-in'
          }}
          draggable={false}
          onError={(e) => {
            const imagePath = currentImage.filePath || currentImage.fileUrl || currentImage.path;
            console.error('[ImageViewer] Image load error:', {
              filePath: currentImage.filePath,
              fileUrl: currentImage.fileUrl,
              path: currentImage.path,
              finalUrl: getImageUrl(imagePath),
              image: currentImage
            });
            e.target.style.display = 'none';
            // Show error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'text-white text-center p-4';
            errorDiv.textContent = `Failed to load image. URL: ${getImageUrl(imagePath)}`;
            e.target.parentElement.appendChild(errorDiv);
          }}
          onLoad={() => {
            // Image loaded successfully
          }}
        />
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black bg-opacity-50 text-white p-4">
        <div className="flex items-center justify-center space-x-4">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="text-sm min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
              disabled={zoom >= 3}
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>

          {/* Rotate */}
          <button
            onClick={handleRotate}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
          >
            <RotateCw className="h-5 w-5" />
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
          >
            Reset
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="text-center text-xs text-gray-400 mt-2">
          Use mouse wheel to zoom • Arrow keys to navigate • R to rotate • ESC to close
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
