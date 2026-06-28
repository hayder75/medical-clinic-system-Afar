import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Search, Filter, UserCheck, UserX, Lock } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [passwordModal, setPasswordModal] = useState({ open: false, user: null, password: '' });
  const [cardProducts, setCardProducts] = useState([]);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullname: '',
    role: 'DOCTOR',
    email: '',
    phone: '',
    qualifications: [],
    specialty: '',
    consultationFee: '',
    licenseNumber: '',
    waiveConsultationFee: false,
    requiredCardType: 'GENERAL'
  });

  const roles = [
    { value: 'DOCTOR', label: 'Doctor' },
    { value: 'NURSE', label: 'Nurse' },
    { value: 'RECEPTIONIST', label: 'Receptionist' },
    { value: 'RADIOLOGIST', label: 'Radiologist' },
    { value: 'LAB_TECHNICIAN', label: 'Lab Technician' },
    { value: 'PHARMACIST', label: 'Pharmacist' },
    { value: 'BILLING_OFFICER', label: 'Billing Officer' },
    { value: 'PHARMACY_BILLING_OFFICER', label: 'Pharmacy Billing Officer' }
  ];

  const qualifications = [
    { value: 'General Doctor', label: 'General Doctor' },
    { value: 'Health Officer', label: 'Health Officer (HO)' },
    { value: 'Dentist', label: 'Dentist' },
    { value: 'Dermatology', label: 'Dermatology' },
    { value: 'Cardiologist', label: 'Cardiologist (Heart)' },
    { value: 'Ophthalmologist', label: 'Ophthalmologist (Eye Doctor)' }
  ];

  const qualificationToSpecialtyMap = {
    'General Doctor': 'general',
    'Health Officer': 'healthOfficer',
    'Dentist': 'dentist',
    'Dermatology': 'dermatology',
    'Cardiologist': 'general',
    'Ophthalmologist': 'general'
  };

  const specialties = [
    { value: 'general', label: 'General Doctor' },
    { value: 'dentist', label: 'Dentist' },
    { value: 'dermatology', label: 'Dermatology' },
    { value: 'healthOfficer', label: 'Health Officer (HO)' },
    { value: 'obgyn', label: 'OB/GYN' },
    { value: 'pediatrician', label: 'Pediatrician' },
    { value: 'internist', label: 'Internist' },
    { value: 'surgeon', label: 'Surgeon' },
    { value: 'orthopedic', label: 'Orthopedic' },
    { value: 'physiotherapist', label: 'Physiotherapist' }
  ];

  useEffect(() => {
    fetchStaff();
    fetchCardProducts();
  }, []);

  const fetchCardProducts = async () => {
    try {
      const response = await api.get('/admin/card-products');
      setCardProducts(response.data.cardProducts || []);
    } catch (error) {
      console.error('Error fetching card products:', error);
    }
  };

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setStaff(response.data.users || []);
    } catch (error) {
      toast.error('Failed to fetch staff data');
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validate doctor-specific fields
      if (formData.role === 'DOCTOR') {
        if ((!formData.qualifications || formData.qualifications.length === 0) && !formData.specialty) {
          toast.error('Please select a workspace profile or at least one qualification');
          return;
        }
        // Only require consultation fee if not waived
        if (!formData.waiveConsultationFee && (!formData.consultationFee || formData.consultationFee <= 0)) {
          toast.error('Please enter a valid consultation fee for doctors, or check "Waive Consultation Fee"');
          return;
        }
      }

      // Clean up form data before sending
      const cleanedData = {
        ...formData,
        qualifications: formData.role === 'DOCTOR' ? formData.qualifications : [],
        // Set consultation fee to 0 if waived, otherwise use the provided value
        consultationFee: formData.role === 'DOCTOR'
          ? (formData.waiveConsultationFee ? 0 : (formData.consultationFee ? parseFloat(formData.consultationFee) : undefined))
          : undefined,
        licenseNumber: formData.role === 'DOCTOR' && formData.licenseNumber ? formData.licenseNumber : undefined,
        waiveConsultationFee: formData.role === 'DOCTOR' ? (formData.waiveConsultationFee || false) : undefined,
        requiredCardType: formData.role === 'DOCTOR' ? (formData.requiredCardType || 'GENERAL') : undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined
      };

      // Remove empty strings and undefined values
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === '' || cleanedData[key] === undefined) {
          delete cleanedData[key];
        }
      });

      if (editingStaff) {
        await api.put(`/admin/users/${editingStaff.id}`, cleanedData);
        toast.success('Staff member updated successfully');
      } else {
        await api.post('/admin/users', cleanedData);
        toast.success('Staff member created successfully');
      }
      setShowModal(false);
      setEditingStaff(null);
      setFormData({
        username: '',
        password: '',
        fullname: '',
        role: 'DOCTOR',
        email: '',
        phone: '',
        qualifications: [],
        consultationFee: '',
        licenseNumber: '',
        waiveConsultationFee: false,
        requiredCardType: 'GENERAL'
      });
      fetchStaff();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to save staff member';
      const errorDetails = error.response?.data?.details;
      if (errorDetails && Array.isArray(errorDetails)) {
        const detailsMessage = errorDetails.map(d => d.message || d.path?.join('.')).join(', ');
        toast.error(`${errorMessage}: ${detailsMessage}`);
      } else {
        toast.error(errorMessage);
      }
      console.error('Error saving staff member:', error.response?.data || error);
    }
  };

  const handleEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      username: staffMember.username,
      password: '',
      fullname: staffMember.fullname || '',
      role: staffMember.role,
      email: staffMember.email || '',
      phone: staffMember.phone || '',
      qualifications: staffMember.qualifications || [],
      specialty: staffMember.specialty || '',
      consultationFee: staffMember.consultationFee || '',
      licenseNumber: staffMember.licenseNumber || '',
      waiveConsultationFee: staffMember.waiveConsultationFee || false,
      requiredCardType: staffMember.requiredCardType || 'GENERAL'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await api.delete(`/admin/users/${id}`);
        toast.success('Staff member deleted successfully');
        fetchStaff();
      } catch (error) {
        toast.error('Failed to delete staff member');
      }
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordModal.user || !passwordModal.password || passwordModal.password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    try {
      await api.put(`/admin/users/${passwordModal.user.id}/password`, { password: passwordModal.password });
      toast.success(`Password updated for ${passwordModal.user.fullname || passwordModal.user.username}`);
      setPasswordModal({ open: false, user: null, password: '' });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update password');
    }
  };

  const handleToggleStatus = async (member) => {
    const action = member.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} ${member.fullname || member.username}?`)) {
      return;
    }

    try {
      await api.patch(`/auth/toggle-status/${member.id}`, {
        isActive: !member.isActive
      });
      toast.success(`User ${action}d successfully`);
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.error || `Failed to ${action} user`);
    }
  };

  const handleQualificationChange = (qualification) => {
    setFormData(prev => {
      const wasSelected = prev.qualifications.includes(qualification);
      const newQualifications = wasSelected
        ? prev.qualifications.filter(q => q !== qualification)
        : [...prev.qualifications, qualification];

      let newSpecialty = prev.specialty;
      if (!wasSelected && !prev.specialty && qualificationToSpecialtyMap[qualification]) {
        newSpecialty = qualificationToSpecialtyMap[qualification];
      }

      return { ...prev, qualifications: newQualifications, specialty: newSpecialty };
    });
  };

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.fullname?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
    const matchesSpecialty = !specialtyFilter || member.specialty === specialtyFilter;
    return matchesSearch && matchesRole && matchesSpecialty;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Staff Management</h2>
          <p className="text-base sm:text-lg text-gray-600">Manage hospital staff members and their roles</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center text-base sm:text-lg px-4 sm:px-6 py-2 sm:py-3 w-full sm:w-auto justify-center"
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
          Add Staff Member
        </button>
      </div>

      {/* Filters */}
      <div className="card w-full">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400" />
              <input
                type="text"
                placeholder="Search staff..."
                className="input pl-12 text-lg py-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="sm:w-56">
            <select
              className="input text-lg py-3"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setSpecialtyFilter(''); }}
            >
              <option value="ALL">All Roles</option>
              {roles.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          {roleFilter === 'DOCTOR' && (
            <div className="sm:w-56">
              <select
                className="input text-lg py-3"
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
              >
                <option value="">All Specialties</option>
                {specialties.map(spec => (
                  <option key={spec.value} value={spec.value}>{spec.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Staff Table */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <table className="table w-full min-w-[800px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="text-sm sm:text-base" style={{ width: '15%' }}>Name</th>
              <th className="text-sm sm:text-base" style={{ width: '12%' }}>Username</th>
              <th className="text-sm sm:text-base" style={{ width: '12%' }}>Role</th>
              <th className="text-sm sm:text-base" style={{ width: '15%' }}>Qualifications</th>
              <th className="text-sm sm:text-base" style={{ width: '8%' }}>Fee</th>
              <th className="text-sm sm:text-base" style={{ width: '15%' }}>Email</th>
              <th className="text-sm sm:text-base" style={{ width: '11%' }}>Phone</th>
              <th className="text-sm sm:text-base" style={{ width: '12%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((member) => (
              <tr key={member.id} className={!member.isActive ? 'bg-red-50' : ''}>
                <td className="font-medium text-base break-words">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={!member.isActive ? 'text-red-700' : ''}>{member.fullname || 'N/A'}</span>
                    {!member.isActive && (
                      <span className="badge badge-error text-xs font-bold">INACTIVE</span>
                    )}
                  </div>
                </td>
                <td className={`text-base break-words ${!member.isActive ? 'text-red-600' : ''}`}>{member.username}</td>
                <td>
                  <span className={`badge text-sm ${!member.isActive ? 'badge-error' : 'badge-info'}`}>
                    {roles.find(r => r.value === member.role)?.label || member.role}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {member.qualifications?.map((qualification, index) => (
                      <span key={index} className="badge badge-secondary text-xs">
                        {qualification}
                      </span>
                    )) || 'N/A'}
                  </div>
                </td>
                <td className={`text-base ${!member.isActive ? 'text-red-600' : ''}`}>
                  {member.consultationFee ? `$${member.consultationFee}` : 'N/A'}
                </td>
                <td className={`text-base break-words ${!member.isActive ? 'text-red-600' : ''}`}>{member.email || 'N/A'}</td>
                <td className={`text-base ${!member.isActive ? 'text-red-600' : ''}`}>{member.phone || 'N/A'}</td>
                <td>
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => handleToggleStatus(member)}
                      className={`px-1.5 py-1 rounded text-xs font-medium flex items-center gap-0.5 whitespace-nowrap ${member.isActive
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                    >
                      {member.isActive ? (
                        <>
                          <UserX className="h-3 w-3" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3 w-3" />
                          <span>Activate</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(member)}
                      className="px-1.5 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-0.5 whitespace-nowrap"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setPasswordModal({ open: true, user: member, password: '' })}
                      className="px-1.5 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center gap-0.5 whitespace-nowrap"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Password</span>
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="px-1.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-0.5 whitespace-nowrap"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Password Change Modal */}
      {passwordModal.open && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Change Password</h3>
              <p className="text-gray-600 mb-4">
                Updating password for: <strong>{passwordModal.user?.fullname || passwordModal.user?.username}</strong>
              </p>
              <div>
                <label className="label text-lg">New Password *</label>
                <input
                  type="password"
                  className="input text-lg"
                  value={passwordModal.password}
                  onChange={(e) => setPasswordModal({ ...passwordModal, password: e.target.value })}
                  minLength={4}
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-1">Min 4 characters</p>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setPasswordModal({ open: false, user: null, password: '' })}
                  className="btn btn-secondary text-lg px-6 py-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePasswordChange}
                  className="btn btn-primary text-lg px-6 py-2 flex items-center gap-2"
                  disabled={passwordModal.password.length < 4}
                >
                  <Lock className="h-5 w-5" />
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label text-base sm:text-lg">Username *</label>
                    <input
                      type="text"
                      className="input text-base sm:text-lg w-full"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="label text-base sm:text-lg">Password {!editingStaff && '*'}</label>
                    <input
                      type="password"
                      className="input text-base sm:text-lg w-full"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      minLength={4}
                      required={!editingStaff}
                    />
                    {!editingStaff && (
                      <p className="text-sm text-gray-500 mt-1">Min 4 characters</p>
                    )}
                  </div>

                  <div>
                    <label className="label text-base sm:text-lg">Full Name</label>
                    <input
                      type="text"
                      className="input text-base sm:text-lg w-full"
                      value={formData.fullname}
                      onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label text-base sm:text-lg">Role *</label>
                    <select
                      className="input text-base sm:text-lg w-full"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                    >
                      {roles.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label text-base sm:text-lg">Email (optional)</label>
                    <input
                      type="email"
                      className="input text-base sm:text-lg w-full"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label text-base sm:text-lg">Phone</label>
                    <input
                      type="tel"
                      className="input text-base sm:text-lg w-full"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                {/* Doctor-specific fields */}
                {formData.role === 'DOCTOR' && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="col-span-1 md:col-span-3">
                      <label className="label text-base sm:text-lg">Workspace Profile</label>
                      <p className="text-sm text-gray-500 mb-1">Controls which features appear in this doctor's panel. Auto-detected from qualifications if left empty.</p>
                      <select
                        className="input text-base sm:text-lg w-full"
                        value={formData.specialty}
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                      >
                        <option value="">Auto-detect from qualifications</option>
                        {specialties.map((spec) => (
                          <option key={spec.value} value={spec.value}>{spec.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-1 md:col-span-3">
                      <label className="label text-base sm:text-lg">Qualifications</label>
                      <p className="text-sm text-gray-500 mb-1">Medical credentials — controls display title (Dr./Mr.) and triage filtering. Workspace Profile above is auto-detected from these.</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                        {qualifications.map((qualification) => (
                          <label key={qualification.value} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.qualifications.includes(qualification.value)}
                              onChange={() => handleQualificationChange(qualification.value)}
                              className="rounded border-gray-300 h-5 w-5"
                            />
                            <span className="text-sm sm:text-base">{qualification.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="label text-base sm:text-lg">Consultation Fee ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input text-base sm:text-lg w-full"
                        value={formData.consultationFee}
                        onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                        placeholder="0.00"
                        required={formData.role === 'DOCTOR' && !formData.waiveConsultationFee}
                        disabled={formData.waiveConsultationFee}
                      />
                      {formData.waiveConsultationFee && (
                        <p className="text-sm text-gray-500 mt-1">Fee waived</p>
                      )}
                    </div>

                    <div>
                      <label className="label text-base sm:text-lg">License Number</label>
                      <input
                        type="text"
                        className="input text-base sm:text-lg w-full"
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                        placeholder="Medical license number"
                      />
                    </div>

                    <div>
                      <label className="label text-base sm:text-lg">Required Card Type</label>
                      <select
                        className="input text-base sm:text-lg w-full"
                        value={formData.requiredCardType}
                        onChange={(e) => setFormData({ ...formData, requiredCardType: e.target.value })}
                      >
                        {cardProducts.filter(c => c.isActive).map(c => (
                          <option key={c.id} value={c.slug}>{c.name} (${c.actPrice} activation)</option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-500 mt-1">
                        When a patient is transferred to this doctor, their card will be upgraded to this type if needed
                      </p>
                    </div>

                    <div className="flex items-center pt-4 md:pt-8">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.waiveConsultationFee}
                          onChange={(e) => setFormData({ ...formData, waiveConsultationFee: e.target.checked })}
                          className="rounded border-gray-300 h-5 w-5"
                        />
                        <span className="text-base sm:text-lg font-medium text-gray-700">
                          Waive Consultation Fee
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingStaff(null);
                      setFormData({
                        username: '',
                        password: '',
                        fullname: '',
                        role: 'DOCTOR',
                        email: '',
                        phone: '',
                        qualifications: [],
                        specialty: '',
                        consultationFee: '',
                        licenseNumber: ''
                      });
                    }}
                    className="btn btn-secondary text-lg px-6 py-2"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary text-lg px-6 py-2">
                    {editingStaff ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
