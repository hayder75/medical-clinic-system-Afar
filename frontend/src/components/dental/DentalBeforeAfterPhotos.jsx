import React, { useState, useEffect } from 'react';
import { Camera, Upload, X, Eye, Download, ArrowLeft, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ImageViewer from '../common/ImageViewer';
import { getImageUrl } from '../../utils/imageUrl';

const DentalBeforeAfterPhotos = ({ visitId, patientId }) => {
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('comparison'); // 'comparison', 'before', 'after'

  useEffect(() => {
    if (visitId) {
      fetchPhotos();
    }
  }, [visitId]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/dental-photos/visit/${visitId}`);
      setBeforePhotos(response.data.beforePhotos || []);
      setAfterPhotos(response.data.afterPhotos || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
      setBeforePhotos([]);
      setAfterPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('visitId', visitId);
    formData.append('patientId', patientId);
    formData.append('photoType', 'AFTER');
    formData.append('description', 'Dental after photo');

    try {
      setUploading(true);
      await api.post('/dental-photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('After photo uploaded successfully');
      await fetchPhotos(); // Refresh photos
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploading(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      await api.delete(`/dental-photos/${photoId}`);
      toast.success('Photo deleted successfully');
      await fetchPhotos(); // Refresh photos
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete photo');
    }
  };

  const handleImageClick = (photoIndex) => {
    setCurrentImageIndex(photoIndex);
    setShowImageViewer(true);
  };

  const downloadImage = (photo) => {
    const link = document.createElement('a');
    link.href = getImageUrl(photo.filePath);
    link.download = photo.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const PhotoGrid = ({ photos, type, showUpload = false }) => (
    <div className="space-y-4">
      {showUpload && (
        <div className="flex justify-end">
          <label className="btn btn-primary btn-sm cursor-pointer">
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? 'Uploading...' : 'Upload After Photo'}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      )}
      
      {photos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Camera className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No {type.toLowerCase()} photos uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative group">
              <div
                className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleImageClick(index)}
              >
                <img
                  src={getImageUrl(photo.filePath)}
                  alt={photo.description || photo.fileName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
              </div>
              
              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImageClick(index);
                      }}
                      className="p-2 bg-white bg-opacity-90 rounded-full hover:bg-opacity-100 transition-all"
                      title="View"
                    >
                      <Eye className="h-4 w-4 text-gray-700" />
                    </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(photo);
                    }}
                    className="p-2 bg-white bg-opacity-90 rounded-full hover:bg-opacity-100 transition-all"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-gray-700" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePhoto(photo.id);
                    }}
                    className="p-2 bg-red-500 bg-opacity-90 rounded-full hover:bg-opacity-100 transition-all"
                    title="Delete"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Photo info */}
              <div className="mt-2">
                <p className="text-xs text-gray-600 truncate" title={photo.fileName}>
                  {photo.fileName}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(photo.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const ComparisonView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Before Photos */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <ArrowLeft className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-blue-600">Before Treatment</h3>
          </div>
          <PhotoGrid photos={beforePhotos} type="Before" />
        </div>

        {/* After Photos */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <ArrowRight className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-green-600">After Treatment</h3>
          </div>
          <PhotoGrid photos={afterPhotos} type="After" showUpload={true} />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Treatment Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Before Photos:</span>
            <span className="ml-2 font-medium">{beforePhotos.length}</span>
          </div>
          <div>
            <span className="text-gray-600">After Photos:</span>
            <span className="ml-2 font-medium">{afterPhotos.length}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Camera className="h-5 w-5 mr-2" />
            Dental Before & After Photos
          </h3>
        </div>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading photos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Camera className="h-5 w-5 mr-2" />
            Dental Before & After Photos
          </h3>
          
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'comparison'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Comparison
            </button>
            <button
              onClick={() => setActiveTab('before')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'before'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Before ({beforePhotos.length})
            </button>
            <button
              onClick={() => setActiveTab('after')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'after'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              After ({afterPhotos.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'comparison' && <ComparisonView />}
        {activeTab === 'before' && <PhotoGrid photos={beforePhotos} type="Before" />}
        {activeTab === 'after' && <PhotoGrid photos={afterPhotos} type="After" showUpload={true} />}
      </div>

      {/* Image Viewer */}
      <ImageViewer
        isOpen={showImageViewer}
        onClose={() => setShowImageViewer(false)}
        images={[...beforePhotos, ...afterPhotos].map(photo => ({
          fileUrl: getImageUrl(photo.filePath),
          fileName: photo.fileName,
          description: photo.description
        }))}
        currentIndex={currentImageIndex}
      />
    </>
  );
};

export default DentalBeforeAfterPhotos;
