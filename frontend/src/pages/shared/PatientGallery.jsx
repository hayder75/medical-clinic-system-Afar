import React, { useState, useEffect } from 'react';
import { Search, Upload, X, Image as ImageIcon, Calendar, User, Trash2, Eye, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ImageViewer from '../../components/common/ImageViewer';
import { getImageUrl } from '../../utils/imageUrl';

const PatientGallery = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientVisits, setPatientVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [visitImages, setVisitImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageType, setImageType] = useState('BEFORE');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  // Image viewer state
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);

  // Search for patients
  const handleSearch = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await api.get(`/patients/search?query=${query}`);
      setSearchResults(response.data.patients || []);
    } catch (error) {
      console.error('Error searching patients:', error);
      toast.error('Failed to search patients');
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only search if there's a query and it's different from the selected patient's name
      if (searchQuery && (!selectedPatient || searchQuery !== selectedPatient.name)) {
        handleSearch(searchQuery);
      } else if (!searchQuery) {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedPatient]);

  // Select a patient
  const selectPatient = async (patient) => {
    setSelectedPatient(patient);
    setSearchQuery(patient.name);
    setSearchResults([]); // Explicitly clear search results
    setSelectedVisit(null);
    setVisitImages([]);
    setSelectedFile(null);
    setPreviewUrl(null);
    await fetchPatientVisits(patient.id);
  };

  // Fetch patient visits
  const fetchPatientVisits = async (patientId) => {
    try {
      setLoading(true);
      const response = await api.get(`/visits/patient/${patientId}`);
      setPatientVisits(response.data.visits || []);
    } catch (error) {
      console.error('Error fetching patient visits:', error);
      toast.error('Failed to load patient visits');
    } finally {
      setLoading(false);
    }
  };

  // Select a visit
  const selectVisit = async (visit) => {
    setSelectedVisit(visit);
    await fetchVisitImages(visit.id);
  };

  // Fetch images for selected visit
  const fetchVisitImages = async (visitId) => {
    try {
      setLoading(true);
      const response = await api.get(`/gallery/visit/${visitId}`);
      setVisitImages(response.data.images || []);
    } catch (error) {
      console.error('Error fetching visit images:', error);
      toast.error('Failed to load visit images');
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Upload image
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an image');
      return;
    }

    if (!selectedVisit) {
      toast.error('Please select a visit');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('patientId', selectedPatient.id);
      formData.append('visitId', selectedVisit.id);
      formData.append('imageType', imageType);
      if (description) {
        formData.append('description', description);
      }

      await api.post('/gallery/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Image uploaded successfully!');

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setDescription('');
      setImageType('BEFORE');

      // Refresh images
      await fetchVisitImages(selectedVisit.id);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  // Delete image
  const handleDelete = async (imageId) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      await api.delete(`/gallery/${imageId}`);
      toast.success('Image deleted successfully');
      await fetchVisitImages(selectedVisit.id);
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error(error.response?.data?.error || 'Failed to delete image');
    }
  };

  // Open image viewer
  const openImageViewer = (image) => {
    const imagesArray = visitImages.map(img => ({ filePath: getImageUrl(img.filePath) }));
    const currentIndex = visitImages.findIndex(img => img.id === image.id);
    setCurrentImage({ images: imagesArray, currentIndex });
    setImageViewerOpen(true);
  };

  // Close image viewer
  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setCurrentImage(null);
  };

  const getStatusColor = (status) => {
    const colors = {
      WAITING_FOR_TRIAGE: 'bg-yellow-100 text-yellow-800',
      TRIAGED: 'bg-blue-100 text-blue-800',
      WAITING_FOR_DOCTOR: 'bg-indigo-100 text-indigo-800',
      UNDER_DOCTOR_REVIEW: 'bg-purple-100 text-purple-800',
      SENT_TO_LAB: 'bg-orange-100 text-orange-800',
      SENT_TO_RADIOLOGY: 'bg-pink-100 text-pink-800',
      SENT_TO_BOTH: 'bg-red-100 text-red-800',
      AWAITING_RESULTS_REVIEW: 'bg-teal-100 text-teal-800',
      SENT_TO_PHARMACY: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--dark)' }}>
          Patient Gallery
        </h1>
        <p className="text-gray-600 mt-2">
          Upload and manage before/after images for patient visits
        </p>
      </div>

      {/* Patient Search */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--dark)' }}>
          Search Patient
        </h2>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, or phone..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2"
            style={{ borderColor: 'var(--primary)', '--tw-ring-color': 'var(--primary)' }}
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => selectPatient(patient)}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                >
                  <div className="font-medium">{patient.name}</div>
                  <div className="text-sm text-gray-600">
                    ID: {patient.id} • Phone: {patient.mobile || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Patient & Visits */}
      {selectedPatient && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--dark)' }}>
            Select Visit
          </h2>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="font-medium">{selectedPatient.name}</div>
            <div className="text-sm text-gray-600">ID: {selectedPatient.id}</div>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'var(--primary)' }}></div>
            </div>
          ) : patientVisits.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No visits found for this patient</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {patientVisits.map((visit) => (
                <div
                  key={visit.id}
                  onClick={() => selectVisit(visit)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedVisit?.id === visit.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-sm">{visit.visitUid}</div>
                    {visit.isEmergency && (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                        Emergency
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(visit.date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(visit.status)}`}>
                      {visit.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Section */}
      {selectedVisit && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--dark)' }}>
            Upload Image
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upload Form */}
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="BEFORE"
                      checked={imageType === 'BEFORE'}
                      onChange={(e) => setImageType(e.target.value)}
                      className="mr-2"
                    />
                    <span>Before</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="AFTER"
                      checked={imageType === 'AFTER'}
                      onChange={(e) => setImageType(e.target.value)}
                      className="mr-2"
                    />
                    <span>After</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="OTHER"
                      checked={imageType === 'OTHER'}
                      onChange={(e) => setImageType(e.target.value)}
                      className="mr-2"
                    />
                    <span>Other</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2"
                  style={{ borderColor: 'var(--primary)', '--tw-ring-color': 'var(--primary)' }}
                  placeholder="Add notes about this image..."
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full px-4 py-2 text-white rounded-lg font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 mr-2" />
                    Upload Image
                  </>
                )}
              </button>
            </div>

            {/* Preview */}
            <div>
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-70 text-white text-xs rounded">
                    {imageType}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg text-gray-400">
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                    <p>No image selected</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gallery */}
      {selectedVisit && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--dark)' }}>
            Visit Gallery ({visitImages.length})
          </h2>

          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'var(--primary)' }}></div>
            </div>
          ) : visitImages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No images uploaded for this visit yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {visitImages.map((image) => (
                <div key={image.id} className="relative group">
                  <img
                    src={getImageUrl(image.filePath)}
                    alt={image.imageType}
                    className="w-full h-48 object-cover rounded-lg border cursor-pointer"
                    onClick={() => openImageViewer(image)}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      console.error('Failed to load image:', image.filePath);
                    }}
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center gap-2">
                    <button
                      onClick={() => openImageViewer(image)}
                      className="opacity-0 group-hover:opacity-100 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-opacity"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(image.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Type Badge */}
                  <div className={`absolute top-2 left-2 px-2 py-1 text-xs font-medium rounded ${image.imageType === 'BEFORE' ? 'bg-orange-500 text-white' : image.imageType === 'AFTER' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                    {image.imageType}
                  </div>

                  {/* Info */}
                  <div className="mt-2">
                    <div className="text-xs text-gray-600 flex items-center">
                      <User className="h-3 w-3 mr-1" />
                      {image.uploadedBy.fullname}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(image.createdAt).toLocaleDateString()}
                    </div>
                    {image.description && (
                      <div className="text-xs text-gray-600 mt-1 truncate">
                        {image.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Viewer */}
      {imageViewerOpen && currentImage && (
        <ImageViewer
          isOpen={imageViewerOpen}
          onClose={closeImageViewer}
          images={currentImage.images}
          currentIndex={currentImage.currentIndex}
        />
      )}
    </div>
  );
};

export default PatientGallery;

