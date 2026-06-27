import React, { useState, useEffect } from 'react';
import { Upload, X, FileImage, FileText, Trash2, Eye } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ImageViewer from './ImageViewer';
import { getImageUrl } from '../../utils/imageUrl';

const PatientAttachedImagesSection = ({
  visitId,
  patientId,
  title = "Attached Medical Images",
  canUpload = true,
  // ImageViewer props for external state management
  onImageClick = null,
  imageViewerOpen = false,
  setImageViewerOpen = null
}) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImages, setCurrentImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [description, setDescription] = useState('');

  // Fetch images only when visitId changes and ImageViewer is not open
  useEffect(() => {
    if (visitId && !showImageViewer) {
      const fetchImages = async () => {
        try {
          setLoading(true);
          const response = await api.get(`/patient-attached-images/visit/${visitId}`);
          setImages(response.data.attachedImages || []);
        } catch (error) {
          console.error('Error fetching attached images:', error);
          if (error.response?.status !== 404) {
            toast.error('Failed to fetch attached images');
          }
        } finally {
          setLoading(false);
        }
      };

      fetchImages();
    }
  }, [visitId, showImageViewer]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only image files (JPEG, PNG, GIF) and PDF files are allowed');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('visitId', visitId);
    formData.append('patientId', patientId);
    formData.append('description', description);

    try {
      setUploading(true);
      const response = await api.post('/patient-attached-images/upload', formData);

      toast.success('Image uploaded successfully');
      setDescription('');
      event.target.value = ''; // Clear file input

      // Refresh images list
      const refreshResponse = await api.get(`/patient-attached-images/visit/${visitId}`);
      setImages(refreshResponse.data.attachedImages || []);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      await api.delete(`/patient-attached-images/${imageId}`);
      toast.success('Image deleted successfully');

      // Refresh images list
      const refreshResponse = await api.get(`/patient-attached-images/visit/${visitId}`);
      setImages(refreshResponse.data.attachedImages || []);
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleImageClick = (image, index) => {
    // Convert images to format expected by ImageViewer
    const viewerImages = images.map(img => ({
      fileUrl: getImageUrl(img.filePath) || '',
      fileName: img.fileName,
      description: img.description
    }));

    if (onImageClick) {
      // Use external state management (for Patient Queue)
      onImageClick(viewerImages, index);
    } else {
      // Use internal state management (for other components)
      setCurrentImages(viewerImages);
      setCurrentImageIndex(index);
      setShowImageViewer(true);
    }
  };

  const handleCloseImageViewer = () => {
    setShowImageViewer(false);
    setCurrentImages([]);
    setCurrentImageIndex(0);
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) {
      return <FileText className="h-5 w-5 text-gray-500" />;
    }
    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-5 w-5 text-blue-500" />;
    } else if (mimeType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Upload className="h-5 w-5 mr-2" />
          {title}
        </h3>
        <span className="text-sm text-gray-500">
          {images.length} file{images.length !== 1 ? 's' : ''} attached
        </span>
      </div>

      {/* Upload Section */}
      {canUpload && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <div className="space-y-4">
            <div>
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                Upload X-rays, CT scans, lab reports, or other medical documents
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: JPEG, PNG, GIF, PDF (Max 10MB)
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Description (optional) - e.g., 'Chest X-ray', 'Blood test results'"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer transition-colors">
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Choose File'}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Images List */}
      {loading ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-500 mt-2">Loading images...</p>
        </div>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <div key={image.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {getFileIcon(image.mimeType)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate" title={image.fileName}>
                      {image.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(image.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  {image.mimeType && image.mimeType.startsWith('image/') && (
                    <button
                      onClick={() => handleImageClick(image, index)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="View in full size"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  {canUpload && (
                    <button
                      onClick={() => handleDeleteImage(image.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Show image preview for images */}
              {image.mimeType && image.mimeType.startsWith('image/') && image.filePath && (
                <div className="mb-2">
                  <img
                    src={getImageUrl(image.filePath)}
                    alt={image.fileName}
                    className="w-full h-32 object-cover rounded border"
                    onError={(e) => {
                      console.error('Image load error:', image.filePath);
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {image.description && (
                <p className="text-xs text-gray-600 mb-2">{image.description}</p>
              )}

              <p className="text-xs text-gray-400">
                Uploaded {new Date(image.uploadedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <FileImage className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No images attached yet</p>
          <p className="text-xs">Upload medical documents to help with diagnosis</p>
        </div>
      )}

      {/* Image Viewer - Only render if using internal state management */}
      {!onImageClick && (
        <ImageViewer
          isOpen={showImageViewer}
          onClose={handleCloseImageViewer}
          images={currentImages}
          currentIndex={currentImageIndex}
        />
      )}
    </div>
  );
};

export default PatientAttachedImagesSection;