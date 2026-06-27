import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { User, Phone, Mail, MapPin, Heart, Calendar, CreditCard, Search, UserPlus, Clock, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import PatientAttachedImagesSection from '../../components/common/PatientAttachedImagesSection';
import BankMethodSelect from '../../components/common/BankMethodSelect';

const PatientRegistration = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState(null);
  const [visit, setVisit] = useState(null);
  const [billing, setBilling] = useState(null);
  const [step, setStep] = useState(1); // 1: Registration Type, 2: Search/Register, 3: Billing, 4: Payment
  const [insurances, setInsurances] = useState([]);
  const [cardProducts, setCardProducts] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    transNumber: ''
  });
  const [selectedInsurance, setSelectedInsurance] = useState('');
  const [paymentErrors, setPaymentErrors] = useState({});
  const [uploadingProof, setUploadingProof] = useState(false);
  const [paymentProofPath, setPaymentProofPath] = useState('');

  // New state for patient search
  const [registrationType, setRegistrationType] = useState(''); // 'new' or 'existing'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('name'); // 'name', 'id', 'phone'
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Age-based date generation
  const [dateInputType, setDateInputType] = useState('date'); // 'date' or 'age'
  const [ageInput, setAgeInput] = useState('');

  // Pre-registration data from URL
  const preRegistrationData = {
    name: searchParams.get('name'),
    phone: searchParams.get('phone'),
    notes: searchParams.get('notes'),
    priority: searchParams.get('priority')
  };

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm();

  useEffect(() => {
    fetchInsurances();
    fetchCardProducts();

    // Pre-fill form if coming from pre-registration
    if (preRegistrationData.name && preRegistrationData.phone) {
      setValue('name', preRegistrationData.name);
      setValue('mobile', preRegistrationData.phone);
      setRegistrationType('new');
      setStep(2);

      // Show notification about pre-registration
      toast.success(`Pre-registration data loaded for ${preRegistrationData.name}`);
    }
  }, []); // Remove dependencies to prevent infinite loop

  const fetchInsurances = async () => {
    try {
      const response = await api.get('/billing/insurances');
      setInsurances(response.data.insurances || []);
    } catch (error) {
      console.error('Error fetching insurances:', error);
    }
  };

  const fetchCardProducts = async () => {
    try {
      const response = await api.get('/admin/card-products');
      setCardProducts(response.data.cardProducts || []);
    } catch (error) {
      console.error('Error fetching card products:', error);
    }
  };

  // Generate date of birth from age
  const generateDateFromAge = (age) => {
    if (!age || age < 0 || age > 120) return null;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const birthYear = currentYear - age;

    // Generate random month (1-12) and day (1-28 to avoid month-end issues)
    const randomMonth = Math.floor(Math.random() * 12) + 1;
    const randomDay = Math.floor(Math.random() * 28) + 1;

    // Create the date
    const generatedDate = new Date(birthYear, randomMonth - 1, randomDay);

    // Format as YYYY-MM-DD for input field
    const formattedDate = generatedDate.toISOString().split('T')[0];

    return formattedDate;
  };

  // Handle age input change
  const handleAgeChange = (age) => {
    setAgeInput(age);
    if (age && age > 0 && age <= 120) {
      const generatedDate = generateDateFromAge(parseInt(age));
      if (generatedDate) {
        setValue('dob', generatedDate);
        // Only show notification when user finishes typing (not on every keystroke)
        const timeoutId = setTimeout(() => {
          toast.success(`Generated date: ${generatedDate} (Age: ${age})`);
        }, 1000); // 1 second delay

        // Clear previous timeout
        if (window.ageTimeout) {
          clearTimeout(window.ageTimeout);
        }
        window.ageTimeout = timeoutId;
      }
    }
  };

  // Search for existing patients
  const searchPatients = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      toast.error('Please enter at least 2 characters to search');
      return;
    }

    try {
      setSearchLoading(true);
      const response = await api.get('/patients/search', {
        params: {
          query: searchQuery,
          type: searchType
        }
      });

      setSearchResults(response.data.patients || []);
      setShowSearchResults(true);

      if (response.data.patients.length === 0) {
        toast.info('No patients found with that search criteria');
      }
    } catch (error) {
      console.error('Error searching patients:', error);
      toast.error('Error searching patients');
    } finally {
      setSearchLoading(false);
    }
  };

  // Select a patient from search results
  const selectPatient = async (patient) => {
    try {
      setLoading(true);

      // First check if patient can create a new visit
      const statusResponse = await api.get(`/billing/check-visit-status/${patient.id}`);

      if (!statusResponse.data.canCreateVisit) {
        // If card needs activation, trigger card activation billing flow
        if (statusResponse.data.needsCardActivation) {
          try {
            const activateResponse = await api.post('/reception/activate-card', {
              patientId: patient.id,
              notes: 'Card activation for repeat patient visit'
            });

            const response = await api.get(`/patients/${patient.id}/for-visit`);
            setSelectedPatient(response.data.patient);
            setPatient(response.data.patient);
            setShowSearchResults(false);
            setSearchQuery('');

            setBilling(activateResponse.data.billing);
            setVisit(null); // Visit will be auto-created after payment
            setStep(3); // Go to billing/payment step
            toast.success('Card activation billing created. Please complete payment to activate card and create visit.');
            return;
          } catch (activateError) {
            console.error('Error activating card:', activateError);
            toast.error(activateError.response?.data?.error || 'Failed to create card activation billing');
            return;
          }
        }

        toast.error(`${statusResponse.data.reason}. ${statusResponse.data.suggestion || 'Please complete the current visit first.'}`);
        return;
      }

      const response = await api.get(`/patients/${patient.id}/for-visit`);

      setSelectedPatient(response.data.patient);
      setPatient(response.data.patient);
      setShowSearchResults(false);
      setSearchQuery('');

      // Create visit for existing patient (card is active, no billing needed)
      const visitResponse = await api.post('/billing/create-visit', {
        patientId: patient.id,
        type: 'REGULAR',
        notes: 'Repeat patient visit'
      });

      setVisit(visitResponse.data.visit);
      if (visitResponse.data.billing) {
        setBilling(visitResponse.data.billing);
        setStep(3); // Skip to billing step
        toast.success('Patient found! Bill created successfully');
      } else {
        setBilling(null);
        setStep(4); // Skip to success since no bill is required
        toast.success('Patient found! Visit created and sent to triage (No fee required)');
      }

    } catch (error) {
      console.error('Error selecting patient:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else if (error.response?.data?.reason) {
        toast.error(`${error.response.data.reason}. ${error.response.data.suggestion || 'Please complete the current visit first.'}`);
      } else {
        toast.error('Error creating visit for patient');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);

      // Register patient
      const patientResponse = await api.post('/billing/register', {
        name: data.name,
        type: data.type,
        cardType: data.cardType || 'GENERAL',
        dob: data.dob,
        gender: data.gender,
        mobile: data.mobile,
        email: data.email,
        address: data.address,
        emergencyContact: data.emergencyContact,
        bloodType: data.bloodType,
        maritalStatus: data.maritalStatus,
        disabilityStatus: data.disabilityStatus || null,
        insuranceId: data.insuranceId || null
      });

      setPatient(patientResponse.data.patient);
      setVisit(patientResponse.data.visit);
      if (patientResponse.data.billing) {
        setBilling(patientResponse.data.billing);
        setStep(3); // Skip to billing step
      } else {
        setBilling(null);
        setStep(4);
      }
      toast.success('Patient registered successfully!');

    } catch (error) {
      // Handle duplicate patient error
      if (error.response?.status === 409) {
        const errorData = error.response.data;
        toast.error(errorData.error);

        // Show suggestion to search for existing patient
        if (errorData.existingPatient) {
          setRegistrationType('existing');
          setSearchQuery(errorData.existingPatient.mobile || errorData.existingPatient.name);
          setSearchType(errorData.existingPatient.mobile ? 'phone' : 'name');
          setStep(2);
        }
      } else {
        toast.error(error.response?.data?.error || 'Failed to register patient');
      }
    } finally {
      setLoading(false);
    }
  };

  // Clean payment validation
  const validatePayment = () => {
    const errors = {};

    if (!paymentMethod) {
      errors.paymentMethod = 'Please select a payment method';
    }

    if (paymentMethod === 'BANK') {
      if (!bankDetails.bankName.trim()) {
        errors.bankName = 'Bank name is required for bank transfers';
      }
    }

    if (paymentMethod === 'INSURANCE' && !selectedInsurance) {
      errors.insuranceId = 'Please select an insurance provider';
    }

    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePayment = async () => {
    // Clear previous errors
    setPaymentErrors({});

    // Validate payment form
    if (!validatePayment()) {
      toast.error('Please fix the form errors');
      return;
    }

    if (!billing) {
      toast.error('No billing information available. Please try registering again.');
      return;
    }

    try {
      setLoading(true);

      const paymentData = {
        billingId: billing.id,
        amount: Number(billing.totalAmount),
        type: paymentMethod,
        bankName: bankDetails.bankName || null,
        transNumber: bankDetails.transNumber || null,
        insuranceId: selectedInsurance || null,
        notes: `Payment method: ${paymentMethod}`,
        paymentProofPath: paymentProofPath || null
      };

      const response = await api.post('/billing/payments', paymentData);

      toast.success('Payment processed successfully!');
      setStep(4);

    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.response?.data?.error || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentProofUpload = async (file) => {
    if (!file) return;
    try {
      setUploadingProof(true);
      const formData = new FormData();
      formData.append('paymentProof', file);
      const response = await api.post('/billing/payments/upload-proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPaymentProofPath(response.data?.file?.path || '');
      toast.success('Payment proof uploaded');
    } catch (error) {
      console.error('Error uploading payment proof:', error);
      toast.error(error.response?.data?.error || 'Failed to upload payment proof');
    } finally {
      setUploadingProof(false);
    }
  };

  const resetForm = () => {
    reset();
    setPatient(null);
    setVisit(null);
    setBilling(null);
    setStep(1);
    setPaymentMethod('');
    setBankDetails({ bankName: '', transNumber: '' });
    setSelectedInsurance('');
    setPaymentProofPath('');
    setPaymentErrors({});
    setRegistrationType('');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPatient(null);
    setShowSearchResults(false);
  };

  if (step === 1) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card">
          <div className="text-center mb-8">
            <User className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900">Patient Registration</h1>
            <p className="text-gray-600">Choose how to proceed with patient registration</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* New Patient Registration */}
            <div
              className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${registrationType === 'new'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
              onClick={() => setRegistrationType('new')}
            >
              <div className="text-center">
                <UserPlus className="h-12 w-12 text-primary-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">New Patient</h3>
                <p className="text-gray-600 mb-4">Register a completely new patient in the system</p>
                <div className="text-sm text-gray-500">
                  <p>• First time visiting</p>
                  <p>• Complete registration required</p>
                  <p>• New patient ID generated</p>
                </div>
              </div>
            </div>

            {/* Existing Patient Search */}
            <div
              className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${registrationType === 'existing'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
              onClick={() => setRegistrationType('existing')}
            >
              <div className="text-center">
                <Search className="h-12 w-12 text-primary-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Repeat Patient</h3>
                <p className="text-gray-600 mb-4">Search for an existing patient and create a new visit</p>
                <div className="text-sm text-gray-500">
                  <p>• Patient already in system</p>
                  <p>• Search by name, ID, or phone</p>
                  <p>• Create new visit only</p>
                </div>
              </div>
            </div>
          </div>

          {registrationType && (
            <div className="flex justify-center">
              <button
                onClick={() => setStep(2)}
                className="btn btn-primary btn-lg"
              >
                Continue with {registrationType === 'new' ? 'New Patient' : 'Repeat Patient'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 2) {
    // New Patient Registration Form
    if (registrationType === 'new') {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="card">
            <div className="text-center mb-8">
              <UserPlus className="h-12 w-12 text-primary-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900">New Patient Registration</h1>
              <p className="text-gray-600">Register a new patient in the system</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Full Name *</label>
                  <input
                    type="text"
                    className="input"
                    {...register('name', { required: 'Name is required' })}
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="label">Date of Birth *</label>
                  <div className="space-y-3">
                    {/* Input Type Toggle */}
                    <div className="flex space-x-4">
                      <button
                        type="button"
                        onClick={() => setDateInputType('date')}
                        className={`px-3 py-1 rounded text-sm ${dateInputType === 'date'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        📅 Enter Date
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateInputType('age')}
                        className={`px-3 py-1 rounded text-sm ${dateInputType === 'age'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        👴 Enter Age
                      </button>
                    </div>

                    {/* Date Input */}
                    {dateInputType === 'date' && (
                      <input
                        type="date"
                        className="input"
                        {...register('dob', { required: 'Date of birth is required' })}
                      />
                    )}

                    {/* Age Input */}
                    {dateInputType === 'age' && (
                      <div className="space-y-2">
                        <input
                          type="number"
                          className="input"
                          placeholder="Enter age (e.g., 25)"
                          min="0"
                          max="120"
                          value={ageInput}
                          onChange={(e) => handleAgeChange(e.target.value)}
                        />
                        <p className="text-xs text-gray-600">
                          💡 For illiterate patients: Enter their age and we'll generate a random date
                        </p>
                        {ageInput && (
                          <div className="p-2 bg-green-50 rounded text-sm text-green-700">
                            ✅ Generated date will be automatically filled below
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.dob && <p className="text-red-500 text-sm mt-1">{errors.dob.message}</p>}
                </div>

                <div>
                  <label className="label">Gender *</label>
                  <select className="input" {...register('gender', { required: 'Gender is required' })}>
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender.message}</p>}
                </div>

                <div>
                  <label className="label">Patient Type *</label>
                  <select className="input" {...register('type', { required: 'Patient type is required' })}>
                    <option value="">Select Type</option>
                    <option value="REGULAR">Regular</option>
                    <option value="STAFF">Staff</option>
                    <option value="CHARITY">Charity</option>
                  </select>
                  {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
                </div>

                <div>
                  <label className="label">Card Type *</label>
                  <select className="input" {...register('cardType', { required: 'Card type is required' })}>
                    <option value="">Select Card Type</option>
                    {cardProducts.filter(c => c.isActive).map(c => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                  {errors.cardType && <p className="text-red-500 text-sm mt-1">{errors.cardType.message}</p>}
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Mobile Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="tel"
                      className="input pl-10"
                      placeholder="0912345678"
                      {...register('mobile', {
                        required: 'Mobile number is required',
                        pattern: {
                          value: /^[0-9]{10}$/,
                          message: 'Please enter a valid 10-digit mobile number'
                        }
                      })}
                    />
                  </div>
                  {errors.mobile && <p className="text-red-500 text-sm mt-1">{errors.mobile.message}</p>}
                </div>

                <div>
                  <label className="label">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      className="input pl-10"
                      placeholder="patient@email.com"
                      {...register('email', {
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Please enter a valid email address'
                        }
                      })}
                    />
                  </div>
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="label">Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <textarea
                    className="input pl-10"
                    rows="3"
                    placeholder="Enter full address"
                    {...register('address', { required: 'Address is required' })}
                  />
                </div>
                {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address.message}</p>}
              </div>

              {/* Medical Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Marital Status</label>
                  <select className="input" {...register('maritalStatus')}>
                    <option value="">Select Status</option>
                    <option value="SINGLE">Single</option>
                    <option value="MARRIED">Married</option>
                    <option value="DIVORCED">Divorced</option>
                    <option value="WIDOWED">Widowed</option>
                  </select>
                </div>

                <div>
                  <label className="label">Insurance ID</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Optional"
                    {...register('insuranceId')}
                  />
                </div>

                <div>
                  <label className="label">Disability Status</label>
                  <select className="input" {...register('disabilityStatus')}>
                    <option value="">Select Disability Status</option>
                    <option value="NO_DISABILITY">No Disability</option>
                    <option value="VISION_LOSS">Vision Loss</option>
                    <option value="HEARING_LOSS">Hearing Loss</option>
                    <option value="MOBILITY_IMPAIRMENT">Mobility Impairment</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="label">Emergency Contact</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Name - Phone Number (Optional)"
                  {...register('emergencyContact')}
                />
                <p className="text-xs text-gray-500 mt-1">Optional - can be filled later by nurse</p>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-secondary"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-outline"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Registering...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    // Existing Patient Search Form
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card">
          <div className="text-center mb-8">
            <Search className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900">Search Existing Patient</h1>
            <p className="text-gray-600">Find an existing patient to create a new visit</p>
          </div>

          <div className="space-y-6">
            {/* Search Form */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="label">Search Type</label>
                  <select
                    className="input"
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                  >
                    <option value="name">By Name</option>
                    <option value="id">By Patient ID</option>
                    <option value="phone">By Phone Number</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Search Query</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder={
                        searchType === 'name' ? 'Enter patient name...' :
                          searchType === 'id' ? 'Enter patient ID (e.g., PAT-2025-01)...' :
                            'Enter phone number...'
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
                    />
                    <button
                      type="button"
                      onClick={searchPatients}
                      disabled={searchLoading || !searchQuery.trim()}
                      className="btn btn-primary"
                    >
                      {searchLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Results */}
            {showSearchResults && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Search Results ({searchResults.length} found)
                </h3>

                {searchResults.length > 0 ? (
                  <div className="space-y-3">
                    {searchResults.map((patient) => (
                      <div
                        key={patient.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors cursor-pointer"
                        onClick={() => selectPatient(patient)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <User className="h-8 w-8 text-primary-600" />
                              <div>
                                <h4 className="font-semibold text-gray-900">{patient.name}</h4>
                                <p className="text-sm text-gray-600">
                                  ID: {patient.id} • {patient.mobile} • {patient.type}
                                </p>
                                {patient.email && (
                                  <p className="text-sm text-gray-500">{patient.email}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectPatient(patient);
                              }}
                              disabled={loading}
                              className="btn btn-primary btn-sm"
                            >
                              {loading ? 'Creating...' : 'Create Visit'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No patients found matching your search criteria</p>
                    <p className="text-sm">Try a different search term or search type</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="btn btn-secondary"
              >
                Back
              </button>
              <button
                onClick={resetForm}
                className="btn btn-outline"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card">
          <div className="text-center mb-8">
            <CreditCard className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900">Payment Required</h1>
            <p className="text-gray-600">Complete payment to proceed with registration</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Patient Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Patient Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{patient?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Patient ID:</span>
                  <span className="font-medium font-mono">{patient?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium capitalize">{patient?.type?.toLowerCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mobile:</span>
                  <span className="font-medium">{patient?.mobile}</span>
                </div>
              </div>
            </div>

            {/* Billing Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Billing Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Billing ID:</span>
                  <span className="font-medium font-mono">{billing?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Service:</span>
                  <span className="font-medium">{billing?.notes || 'Card Registration / Activation'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium">{billing?.totalAmount} ETB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="badge badge-warning">Pending</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-4">Payment Methods</h4>

            {/* Payment Method Selection */}
            <div className="mb-6">
              <label className="label">Payment Method *</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`btn ${paymentMethod === 'CASH' ? 'btn-success' : 'btn-outline'}`}
                  disabled={loading}
                >
                  Cash Payment
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK')}
                  className={`btn ${paymentMethod === 'BANK' ? 'btn-primary' : 'btn-outline'}`}
                  disabled={loading}
                >
                  Bank Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('INSURANCE')}
                  className={`btn ${paymentMethod === 'INSURANCE' ? 'btn-secondary' : 'btn-outline'}`}
                  disabled={loading}
                >
                  Insurance
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CHARITY')}
                  className={`btn ${paymentMethod === 'CHARITY' ? 'btn-warning' : 'btn-outline'}`}
                  disabled={loading}
                >
                  Charity
                </button>
              </div>
              {paymentErrors.paymentMethod && (
                <p className="text-red-500 text-sm mt-1">{paymentErrors.paymentMethod}</p>
              )}
            </div>

            {/* Bank Transfer Details */}
            {paymentMethod === 'BANK' && (
              <div className="space-y-4 mb-6">
                <h5 className="font-medium text-gray-900">Bank Transfer Details</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Bank Name *</label>
                    <BankMethodSelect
                      className={`input ${paymentErrors.bankName ? 'border-red-500' : ''}`}
                      value={bankDetails.bankName}
                      onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                    />
                    {paymentErrors.bankName && (
                      <p className="text-red-500 text-sm mt-1">{paymentErrors.bankName}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Transaction Number</label>
                    <input
                      type="text"
                      className={`input ${paymentErrors.transNumber ? 'border-red-500' : ''}`}
                      value={bankDetails.transNumber}
                      onChange={(e) => setBankDetails({ ...bankDetails, transNumber: e.target.value })}
                      placeholder="Enter transaction number"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional reference number from the bank or wallet.</p>
                    {paymentErrors.transNumber && (
                      <p className="text-red-500 text-sm mt-1">{paymentErrors.transNumber}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Payment Proof Screenshot (Optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="input"
                      disabled={uploadingProof}
                      onChange={(e) => handlePaymentProofUpload(e.target.files?.[0])}
                    />
                    {uploadingProof && <p className="text-xs text-blue-600 mt-1">Uploading proof...</p>}
                    {paymentProofPath && <p className="text-xs text-green-700 mt-1">Proof attached: {paymentProofPath}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Insurance Selection */}
            {paymentMethod === 'INSURANCE' && (
              <div className="space-y-4 mb-6">
                <h5 className="font-medium text-gray-900">Select Insurance Provider</h5>
                <select
                  className={`input ${paymentErrors.insuranceId ? 'border-red-500' : ''}`}
                  value={selectedInsurance}
                  onChange={(e) => setSelectedInsurance(e.target.value)}
                >
                  <option value="">Select Insurance Provider</option>
                  {insurances.map((insurance) => (
                    <option key={insurance.id} value={insurance.id}>
                      {insurance.name} ({insurance.code})
                    </option>
                  ))}
                </select>
                {paymentErrors.insuranceId && (
                  <p className="text-red-500 text-sm mt-1">{paymentErrors.insuranceId}</p>
                )}
              </div>
            )}

            {/* Attached Medical Images Section */}
            {visit && patient && (
              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <PatientAttachedImagesSection
                  visitId={visit.id}
                  patientId={patient.id}
                  title="Attached Medical Images (Optional)"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Upload X-rays, lab reports, or other medical documents the patient brought from other hospitals
                </p>
              </div>
            )}

            {/* Process Payment Button */}
            {paymentMethod && (
              <div className="flex justify-end">
                <button
                  onClick={handlePayment}
                  className="btn btn-primary"
                  disabled={loading || (paymentMethod === 'INSURANCE' && !selectedInsurance)}
                >
                  {loading ? 'Processing...' : 'Process Payment'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center">
          <div className="mb-6">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{billing ? 'Registration Complete!' : 'Visit Created!'}</h1>
            <p className="text-gray-600 mt-2">{billing ? 'Patient has been successfully registered and payment processed' : 'Patient visit created and sent to triage (card is active, no fee required)'}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Patient Details */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Patient Details</h3>
              <div className="space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-600">Patient ID:</span>
                  <span className="font-medium font-mono">{patient?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{patient?.name}</span>
                </div>
                {visit && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Visit ID:</span>
                    <span className="font-medium font-mono">{visit?.visitUid || visit?.id}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="badge badge-success">
                    {billing ? 'Registered & Paid' : 'Sent to Triage'}
                  </span>
                </div>
                {billing && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment:</span>
                    <span className="font-medium text-green-600">ETB {billing?.totalAmount}</span>
                  </div>
                )}
                {!billing && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fee:</span>
                    <span className="font-medium text-green-600">No fee (Card Active)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Next Steps</h3>
              <div className="space-y-3 text-left">
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-blue-600 text-sm font-medium">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Vital Checkup</p>
                    <p className="text-sm text-gray-600">Proceed to nurse station for vital signs measurement</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-blue-600 text-sm font-medium">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Triage Assessment</p>
                    <p className="text-sm text-gray-600">Nurse will assess urgency and assign priority</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-blue-600 text-sm font-medium">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Doctor Assignment</p>
                    <p className="text-sm text-gray-600">Wait for doctor assignment based on qualification</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => window.location.href = '/billing/queue'}
                className="btn btn-primary btn-lg flex items-center"
              >
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                View Billing Queue
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={resetForm}
                className="btn btn-outline"
              >
                Register Another Patient
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PatientRegistration;
