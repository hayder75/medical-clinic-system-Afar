import React, { useState, useEffect, useCallback, useRef } from 'react';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import { useNavigate } from 'react-router-dom';
import { 
  Phone, 
  User, 
  Search, 
  Plus, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  X,
  Play,
  Pause,
  RotateCcw,
  Filter,
  Users,
  Calendar,
  PhoneCall
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PreRegistration = () => {
  const navigate = useNavigate();
  const [virtualQueue, setVirtualQueue] = useState([]);
  const [stats, setStats] = useState({ byStatus: {}, byPriority: {} });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const searchPatientApi = useCallback(async (query, signal) => {
    const response = await api.get(`/pre-registration/search-patients?query=${query}&type=name`, { signal });
    return response.data.patients || [];
  }, []);

  const {
    query: patientSearchQuery,
    setQuery: setPatientSearchQuery,
    results: patientSearchResults,
    setResults: setPatientSearchResults,
    loading: searchingPatient
  } = useDebouncedSearch(searchPatientApi, { delay: 300, minChars: 2 });

  const searchInputRef = useRef(null);
  const prevSearching = useRef(false);
  useEffect(() => {
    if (prevSearching.current && !searchingPatient && patientSearchQuery.length >= 2) {
      searchInputRef.current?.focus();
    }
    prevSearching.current = searchingPatient;
  }, [searchingPatient, patientSearchQuery]);

  // Add form state
  const [addForm, setAddForm] = useState({
    name: '',
    phone: '',
    priority: 3,
    notes: '',
    patientId: null
  });

  useEffect(() => {
    fetchVirtualQueue();
  }, []);

  const fetchVirtualQueue = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pre-registration/list');
      if (response.data.success) {
        setVirtualQueue(response.data.virtualQueue);
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching virtual queue:', error);
      toast.error('Failed to fetch Pre-Registration queue');
    } finally {
      setLoading(false);
    }
  };

  const searchVirtualQueue = async () => {
    if (!searchQuery.trim()) {
      fetchVirtualQueue();
      return;
    }

    try {
      const response = await api.get(`/pre-registration/search?query=${searchQuery}&type=${searchType}`);
      if (response.data.success) {
        setVirtualQueue(response.data.results);
      }
    } catch (error) {
      console.error('Error searching virtual queue:', error);
      toast.error('Failed to search Pre-Registration queue');
    }
  };

  const handleAddToQueue = async () => {
    try {
      // Prepare form data - only include patientId if it's not null
      const formData = {
        name: addForm.name,
        phone: addForm.phone,
        priority: addForm.priority,
        notes: addForm.notes
      };
      
      // Only add patientId if it exists
      if (addForm.patientId) {
        formData.patientId = addForm.patientId;
      }

      const response = await api.post('/pre-registration/add', formData);
      if (response.data.success) {
        toast.success('Patient added to Pre-Registration queue');
        setShowAddModal(false);
        setAddForm({ name: '', phone: '', priority: 3, notes: '', patientId: null });
        setSelectedPatient(null);
        fetchVirtualQueue();
      }
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Patient already has a pending Pre-Registration entry');
      } else {
        toast.error('Failed to add patient to queue');
      }
    }
  };

  const handleProcessQueue = async (virtualQueueId) => {
    try {
      const response = await api.post('/pre-registration/process', { virtualQueueId });
      if (response.data.success) {
        if (response.data.action === 'visit_created') {
          toast.success('Visit created successfully! Patient can proceed to triage.');
        } else if (response.data.action === 'redirect_to_registration') {
          toast.success('Redirecting to patient registration...');
          
          // Redirect to registration with pre-filled data
          const params = new URLSearchParams({
            name: response.data.virtualQueueData.name,
            phone: response.data.virtualQueueData.phone,
            notes: response.data.virtualQueueData.notes || '',
            priority: response.data.virtualQueueData.priority || '3'
          });
          
          navigate(`/reception/patients?${params.toString()}`);
        }
        fetchVirtualQueue();
      }
    } catch (error) {
      toast.error('Failed to process Pre-Registration entry');
    }
  };

  const handleCancelQueue = async (virtualQueueId) => {
    try {
      const response = await api.post('/pre-registration/cancel', { virtualQueueId });
      if (response.data.success) {
        toast.success('Pre-Registration entry cancelled');
        fetchVirtualQueue();
      }
    } catch (error) {
      toast.error('Failed to cancel Pre-Registration entry');
    }
  };

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setAddForm({
      name: patient.name,
      phone: patient.mobile || '',
      priority: 3,
      notes: '',
      patientId: patient.id
    });
    setShowPatientSearch(false);
    setPatientSearchQuery('');
    setPatientSearchResults([]);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'text-red-600 bg-red-100';
      case 2: return 'text-yellow-600 bg-yellow-100';
      case 3: return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 1: return 'URGENT';
      case 2: return 'PRIORITY';
      case 3: return 'NORMAL';
      default: return 'UNKNOWN';
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pre-Registration Queue</h1>
          <p className="text-gray-600">Manage patients who called ahead to reserve their spot</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add to Queue
        </button>
      </div>

      {/* Important Notice */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Reception Pre-Registration</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Add patients who called ahead to reserve their spot</li>
                <li>Process entries to create visits or redirect to registration</li>
                <li>Patients with existing records will have visits created directly</li>
                <li>New patients will be redirected to registration with pre-filled data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-blue-600">{stats.byStatus.pending || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Urgent</p>
              <p className="text-2xl font-bold text-red-600">{stats.byPriority.priority_1 || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Priority</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.byPriority.priority_2 || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.byStatus.completed || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="input"
          >
            <option value="name">Name</option>
            <option value="phone">Phone</option>
          </select>
          <button
            onClick={searchVirtualQueue}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                fetchVirtualQueue();
              }}
              className="btn btn-secondary"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Queue List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Pre-Registration Queue</h3>
          <p className="text-sm text-gray-600">Patients are ordered by priority: Urgent → Priority → Normal</p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {virtualQueue.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <PhoneCall className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No patients in Pre-Registration queue</p>
            </div>
          ) : (
            virtualQueue.map((item, index) => (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        #{index + 1}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                        {getPriorityText(item.priority)}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {item.name}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Phone className="w-4 h-4 mr-1" />
                          {item.phone}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatTime(item.createdAt)}
                        </span>
                        {item.patient && (
                          <span className="flex items-center text-green-600">
                            <User className="w-4 h-4 mr-1" />
                            Existing Patient
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-sm text-gray-500 mt-1">
                          Notes: {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleProcessQueue(item.id)}
                      className="btn btn-success btn-sm"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Process
                    </button>
                    <button
                      onClick={() => handleCancelQueue(item.id)}
                      className="btn btn-danger btn-sm"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add to Queue Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add to Pre-Registration Queue</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Patient Search */}
              <div>
                <label className="label">
                  Search Existing Patient (Optional)
                </label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by name..."
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    className="input"
                  />
                  {patientSearchQuery.length >= 2 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {patientSearchResults.map((patient) => (
                        <div
                          key={patient.id}
                          onClick={() => selectPatient(patient)}
                          className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                        >
                          <div className="font-medium">{patient.name}</div>
                          <div className="text-sm text-gray-600">
                            {patient.mobile && `Phone: ${patient.mobile}`}
                            {patient.mobile && patient.id && ' • '}
                            {patient.id && `ID: ${patient.id}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="label">
                  Patient Name *
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="label">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="input"
                  required
                />
              </div>

              {/* Priority */}
              <div>
                <label className="label">
                  Priority
                </label>
                <select
                  value={addForm.priority}
                  onChange={(e) => setAddForm({ ...addForm, priority: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={3}>Normal</option>
                  <option value={2}>Priority</option>
                  <option value={1}>Urgent</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="label">
                  Notes (Optional)
                </label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  rows={3}
                  className="input"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToQueue}
                disabled={!addForm.name || !addForm.phone}
                className="btn btn-primary"
              >
                Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreRegistration;
