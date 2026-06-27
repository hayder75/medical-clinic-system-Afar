import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, CreditCard, Wallet, TrendingUp, TrendingDown, Search, X, Calendar, FileText, ArrowLeft, ChevronDown, ChevronUp, Clock, CheckCircle, AlertTriangle, User, Receipt, Printer } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import BankMethodSelect from '../common/BankMethodSelect';

const PatientAccounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, CREDIT, ADVANCE, NONE
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, CREDIT, ADVANCE
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [modalType, setModalType] = useState(''); // 'deposit', 'payment', 'return-money', 'add-credit', 'adjust', 'view'

  useEffect(() => {
    fetchAccounts();
  }, [filter]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/accounts?type=${filter}`);
      setAccounts(response.data.accounts || []);
    } catch (error) {
      toast.error('Failed to fetch accounts');
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (account, type) => {
    setSelectedAccount(account);
    setModalType(type);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAccount(null);
    setModalType('');
    fetchAccounts();
  };

  const handleDeleteAccount = async (account) => {
    if (!account?.id) return;
    if (!window.confirm(`Delete the patient account for ${account.patient?.name || 'this patient'}? This will remove it from both admin and billing views.`)) {
      return;
    }

    try {
      await api.delete(`/accounts/${account.id}`);
      toast.success('Patient account deleted successfully');
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting patient account:', error);
      toast.error(error.response?.data?.error || 'Failed to delete patient account');
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      account.patient?.name?.toLowerCase().includes(term) ||
      account.patient?.id?.toLowerCase().includes(term) ||
      (account.patient?.mobile && account.patient.mobile.includes(term));

    if (activeTab === 'ALL') {
      return matchesSearch;
    } else {
      return matchesSearch && (account.accountType === activeTab || account.accountType === 'BOTH');
    }
  });

  const stats = {
    total: accounts.length,
    credit: accounts.filter(a => ['CREDIT', 'BOTH'].includes(a.accountType)).length,
    advance: accounts.filter(a => ['ADVANCE', 'BOTH'].includes(a.accountType)).length,
    totalDebt: accounts.filter(a => ['CREDIT', 'BOTH'].includes(a.accountType)).reduce((sum, a) => sum + (a.debtOwed || 0), 0),
    totalAdvance: accounts.filter(a => ['ADVANCE', 'BOTH'].includes(a.accountType) && a.balance > 0).reduce((sum, a) => sum + a.balance, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Patient Accounts Management</h2>
          <p className="text-gray-600">Manage credit and advance payment accounts</p>
        </div>
        {['ADMIN', 'BILLING_OFFICER'].includes(user?.role) && (
          <button
            onClick={() => handleOpenModal(null, 'create')}
            className="btn btn-primary flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Account
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <CreditCard className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Credit Accounts</p>
              <p className="text-2xl font-bold text-red-600">{stats.credit}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Total Debt: {stats.totalDebt.toFixed(2)} ETB</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Advance Accounts</p>
              <p className="text-2xl font-bold text-green-600">{stats.advance}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Total Balance: {stats.totalAdvance.toFixed(2)} ETB</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                className="input pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
            >
              All Accounts
            </button>
            <button
              onClick={() => setActiveTab('CREDIT')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'CREDIT' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
            >
              Credit Users
            </button>
            <button
              onClick={() => setActiveTab('ADVANCE')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'ADVANCE' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
            >
              Advance Payment Users
            </button>
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Phone</th>
                <th>Account Type</th>
                <th>Balance</th>
                <th>Debt</th>
                <th>Total Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.id}>
                  <td className="font-medium">{account.patient?.name || 'N/A'}</td>
                  <td>{account.patient?.mobile || 'N/A'}</td>
                  <td>
                    <span className={`badge ${['CREDIT', 'BOTH'].includes(account.accountType) && account.debtOwed > 0 ? 'badge-error' :
                      ['ADVANCE', 'BOTH'].includes(account.accountType) && account.balance > 0 ? 'badge-success' :
                        'badge-info'
                      }`}>
                      {account.accountType === 'BOTH' ? 'ADVANCE + CREDIT' : account.accountType || 'NONE'}
                    </span>
                  </td>
                  <td>
                    <div>
                      <span className={`font-semibold ${['CREDIT', 'BOTH'].includes(account.accountType)
                        ? (account.balance > 0 ? 'text-blue-600' : 'text-gray-600')
                        : (account.balance < 0 ? 'text-red-600' :
                          account.balance > 0 ? 'text-green-600' : 'text-gray-600')
                        }`}>
                        {account.balance.toFixed(2)} ETB
                      </span>
                      {Number(account.pendingDepositAmount || 0) > 0 && (
                        <p className="text-xs font-medium text-amber-600 mt-1">
                          Pending billing acceptance: {Number(account.pendingDepositAmount).toFixed(2)} ETB
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    {['CREDIT', 'BOTH'].includes(account.accountType) ? (
                      <span className="font-semibold text-lg text-red-600">
                        {(account.debtOwed || 0).toFixed(2)} ETB
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td>{account.totalUsed.toFixed(2)} ETB</td>
                  <td>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleOpenModal(account, 'view')}
                        className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm font-medium"
                      >
                        Details
                      </button>
                      {['ADVANCE', 'BOTH'].includes(account.accountType) && (
                        <button
                          onClick={() => handleOpenModal(account, 'deposit')}
                          className="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm"
                        >
                          Add Deposit
                        </button>
                      )}
                      {['CREDIT', 'BOTH'].includes(account.accountType) && (
                        <>
                          <button
                            onClick={() => handleOpenModal(account, 'add-credit')}
                            className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm"
                          >
                            Add Credit
                          </button>
                          {(account.debtOwed || 0) > 0 && (
                            <button
                              onClick={() => handleOpenModal(account, 'return-money')}
                              className="px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm"
                            >
                              Return Money
                            </button>
                          )}
                        </>
                      )}
                      {user?.role === 'ADMIN' && ['ADVANCE', 'BOTH'].includes(account.accountType) && (
                        <button
                          onClick={() => handleOpenModal(account, 'adjust')}
                          className="px-2 py-1 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded text-sm"
                        >
                          Edit Money
                        </button>
                      )}
                      {user?.role === 'ADMIN' && (
                        <button
                          onClick={() => handleDeleteAccount(account)}
                          className="px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm"
                        >
                          Delete Account
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <AccountModal
          account={selectedAccount}
          type={modalType}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

// Modal Component
const AccountModal = ({ account, type, onClose }) => {
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'CASH',
    bankName: '',
    transNumber: '',
    notes: '',
    patientId: '',
    accountType: 'ADVANCE',
    searchPatient: ''
  });
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Search patients
  const searchPatients = async () => {
    if (formData.searchPatient.trim().length < 2) {
      setPatients([]);
      return;
    }

    try {
      setSearchingPatients(true);
      const response = await api.get(`/patients/search?query=${formData.searchPatient}`);
      const patientsList = response.data.patients || response.data || [];
      setPatients(patientsList);
    } catch (error) {
      console.error('Error searching patients:', error);
      setPatients([]);
    } finally {
      setSearchingPatients(false);
    }
  };

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setFormData({ ...formData, patientId: patient.id, searchPatient: patient.name });
    setPatients([]);
  };

  // Debounced search
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      // Only search if user typed at least 2 chars AND hasn't selected a patient yet
      if (type === 'create' && formData.searchPatient.trim().length >= 2 && !formData.patientId) {
        searchPatients();
      } else {
        setPatients([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [formData.searchPatient, type, formData.patientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (type === 'create' && !formData.patientId) {
      toast.error('Please select a patient');
      return;
    }

    if (type !== 'create' && (!formData.amount || parseFloat(formData.amount) <= 0)) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);

      if (type === 'create') {
        const response = await api.post('/accounts', {
          patientId: formData.patientId,
          accountType: formData.accountType,
          initialDeposit: formData.amount ? parseFloat(formData.amount) : 0
        });
        toast.success(response.data?.message || 'Account saved successfully');
      } else if (type === 'deposit') {
        const response = await api.post('/accounts/deposit', {
          accountId: account.id,
          patientId: account.patientId,
          amount: parseFloat(formData.amount),
          paymentMethod: formData.paymentMethod,
          bankName: formData.bankName || undefined,
          transNumber: formData.transNumber || undefined,
          notes: formData.notes || undefined
        });
        toast.success(response.data?.message || 'Deposit handled successfully');
      } else if (type === 'add-credit') {
        const response = await api.post('/accounts/deposit', {
          accountId: account.id,
          patientId: account.patientId,
          amount: parseFloat(formData.amount),
          paymentMethod: formData.paymentMethod,
          bankName: formData.bankName || undefined,
          transNumber: formData.transNumber || undefined,
          notes: formData.notes || 'Credit limit increased',
          isCreditAdd: true
        });
        toast.success(response.data?.message || 'Credit limit increased successfully');
      } else if (type === 'adjust') {
        const response = await api.post('/accounts/adjust', {
          accountId: account.id,
          patientId: account.patientId,
          amount: parseFloat(formData.amount),
          reason: formData.notes || 'Balance updated by admin'
        });
        toast.success(response.data?.message || 'Account money updated successfully');
      } else if (type === 'return-money' || type === 'payment') {
        const response = await api.post('/accounts/payment', {
          accountId: account.id,
          patientId: account.patientId,
          amount: parseFloat(formData.amount),
          paymentMethod: formData.paymentMethod,
          bankName: formData.bankName || undefined,
          transNumber: formData.transNumber || undefined,
          notes: formData.notes || undefined,
          isCreditPayment: true
        });
        toast.success(response.data?.message || 'Payment returned successfully');
      }

      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to process');
    } finally {
      setLoading(false);
    }
  };

  // For view mode, use the full-page detail view
  if (type === 'view') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
          <AccountDetailedView account={account} onClose={onClose} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {type === 'create' ? 'Create Account' :
                type === 'deposit' ? 'Add Deposit' :
                  type === 'add-credit' ? 'Add Credit' :
                    type === 'adjust' ? 'Edit Account Money' :
                      type === 'return-money' ? 'Return Money to Clear Debt' :
                        'Accept Payment'}
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {type === 'create' && (
              <>
                <div>
                  <label className="label">Search Patient *</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="input"
                      placeholder="Type patient name to search..."
                      value={formData.searchPatient}
                      onChange={(e) => setFormData({ ...formData, searchPatient: e.target.value, patientId: '', selectedPatient: null })}
                    />
                    {searchingPatients && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      </div>
                    )}
                  </div>
                  {patients.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                      {patients.map((patient) => (
                        <div
                          key={patient.id}
                          onClick={() => selectPatient(patient)}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                        >
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-xs text-gray-500">{patient.id} | {patient.mobile || 'No phone'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedPatient && (
                    <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm font-medium text-blue-700">Selected: {selectedPatient.name}</p>
                    </div>
                  )}
                  {!formData.patientId && formData.searchPatient.length >= 2 && !searchingPatients && patients.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No patients found. Try a different search.</p>
                  )}
                </div>

                <div>
                  <label className="label">Account Type *</label>
                  <select
                    className="input"
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    required
                  >
                    <option value="ADVANCE">Advance Payment Option</option>
                    <option value="CREDIT">Deferred Payment (Credit) Option</option>
                    <option value="BOTH">Standard Package (Advance + Credit)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Initial Deposit (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for credit accounts</p>
                </div>
              </>
            )}

            {type !== 'create' && type !== 'adjust' && (
              <>
                <div>
                  <label className="label">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Payment Method *</label>
                  <select
                    className="input"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    required
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>

                {formData.paymentMethod === 'BANK' && (
                  <>
                    <div>
                      <label className="label">Bank Name</label>
                      <BankMethodSelect
                        className="input"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Transaction Number</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.transNumber}
                        onChange={(e) => setFormData({ ...formData, transNumber: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="input"
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </>
            )}

            {type === 'adjust' && (
              <>
                <div>
                  <label className="label">New Balance Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Reason *</label>
                  <textarea
                    className="input"
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Explain why the account balance is being changed"
                    required
                  />
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DETAILED ACCOUNT VIEW COMPONENT
// ==========================================
const AccountDetailedView = ({ account, onClose }) => {
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview'); // overview, billings, transactions, deposits
  const [expandedBillings, setExpandedBillings] = useState(new Set());
  const [viewMode, setViewMode] = useState('credit'); // 'advance' or 'credit' — only for BOTH accounts

  useEffect(() => {
    fetchDetailedHistory();
  }, [account.id]);

  const fetchDetailedHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/accounts/${account.id}/detailed-history`);
      setDetailData(response.data);
    } catch (error) {
      console.error('Error fetching detailed history:', error);
      toast.error('Failed to load account details');
    } finally {
      setLoading(false);
    }
  };

  const toggleBilling = (billingId) => {
    setExpandedBillings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(billingId)) {
        newSet.delete(billingId);
      } else {
        newSet.add(billingId);
      }
      return newSet;
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'DEPOSIT': return 'text-green-700 bg-green-50 border-green-200';
      case 'PAYMENT': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'DEBT': return 'text-red-700 bg-red-50 border-red-200';
      case 'DEDUCTION': case 'USAGE': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'ADJUSTMENT': return 'text-purple-700 bg-purple-50 border-purple-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'DEPOSIT': return <TrendingUp className="h-4 w-4" />;
      case 'PAYMENT': return <DollarSign className="h-4 w-4" />;
      case 'DEBT': return <TrendingDown className="h-4 w-4" />;
      case 'DEDUCTION': case 'USAGE': return <Receipt className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryLabel = (cat) => {
    const labels = {
      'DENTAL': 'Dental', 'LAB': 'Laboratory', 'RADIOLOGY': 'Radiology',
      'NURSE': 'Nurse Service', 'CONSULTATION': 'Consultation',
      'MEDICATION': 'Medication', 'ACCOMMODATION': 'Accommodation'
    };
    return labels[cat] || cat;
  };

  const getCategoryColor = (cat) => {
    const colors = {
      'DENTAL': 'bg-indigo-100 text-indigo-700',
      'LAB': 'bg-blue-100 text-blue-700',
      'RADIOLOGY': 'bg-purple-100 text-purple-700',
      'NURSE': 'bg-teal-100 text-teal-700',
      'CONSULTATION': 'bg-cyan-100 text-cyan-700',
      'MEDICATION': 'bg-amber-100 text-amber-700',
      'ACCOMMODATION': 'bg-rose-100 text-rose-700',
    };
    return colors[cat] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Loading account details...</p>
      </div>
    );
  }

  if (!detailData) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 font-medium">Failed to load account details</p>
        <button onClick={onClose} className="mt-4 btn btn-secondary">Close</button>
      </div>
    );
  }

  const { summary, transactions, billings, deposits } = detailData;
  const isBoth = account.accountType === 'BOTH';
  const isCredit = ['CREDIT', 'BOTH'].includes(account.accountType);
  const isAdvance = ['ADVANCE', 'BOTH'].includes(account.accountType);

  // For BOTH accounts, filter transactions by the subAccount field from the database
  const filteredTransactions = isBoth
    ? transactions.filter(tx => {
      if (viewMode === 'advance') return tx.subAccount === 'ADVANCE';
      return tx.subAccount === 'CREDIT';
    })
    : transactions;

  // Filter billings based on viewMode by finding associated transactions
  const filteredBillings = isBoth
    ? billings.filter(b => {
      const hasAdvanceTx = transactions.some(tx => tx.billingId === b.id && tx.subAccount === 'ADVANCE');
      const hasCreditTx = transactions.some(tx => tx.billingId === b.id && tx.subAccount === 'CREDIT');

      if (viewMode === 'advance') return hasAdvanceTx;
      if (viewMode === 'credit') return hasCreditTx || b.isDeferred;
      return true;
    })
    : billings;

  // Count helpers
  const advanceTransactionCount = transactions.filter(t => t.subAccount === 'ADVANCE').length;
  const creditTransactionCount = transactions.filter(t => t.subAccount === 'CREDIT').length;

  const handlePrint = () => {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked! Please allow popups for this site.');
      return;
    }

    // Group billings by visit for compact view
    const groupedBillings = filteredBillings.reduce((acc, billing) => {
      const visitId = billing.visitId || billing.visit?.id || billing.id;
      if (!acc[visitId]) {
        acc[visitId] = {
          visitUid: billing.visit?.visitUid || `Bill #${billing.id.substring(0, 8)}`,
          visitDate: billing.visit?.date || billing.createdAt,
          billings: [],
          totalAmount: 0,
          totalPaid: 0
        };
      }
      acc[visitId].billings.push(billing);
      acc[visitId].totalAmount += billing.totalAmount;
      acc[visitId].totalPaid += billing.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      return acc;
    }, {});

    const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Account Statement - ${account.patient?.name}</title>
        <style>
          @media print { @page { size: A4; margin: 8mm; } }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 10px; color: #000; font-size: 10pt; }
          .container { max-width: 100%; }
          .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 2px solid #2563eb; }
          .clinic-name { font-size: 14pt; font-weight: bold; color: #1e40af; }
          .clinic-tagline { font-size: 8pt; color: #666; }
          .report-title { font-size: 12pt; font-weight: bold; }
          .patient-info { margin-bottom: 10px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 9pt; }
          .patient-info td { padding: 2px 8px; }
          .info-label { font-weight: bold; color: #666; }
          .summary-box { display: flex; gap: 8px; margin-bottom: 12px; }
          .summary-card { flex: 1; padding: 6px; border: 1px solid #e2e8f0; text-align: center; font-size: 9pt; }
          .summary-card.blue { background: #eff6ff; }
          .summary-card.red { background: #fef2f2; }
          .summary-card.green { background: #f0fdf4; }
          .summary-card.orange { background: #fff7ed; }
          .summary-label { font-size: 7pt; font-weight: bold; text-transform: uppercase; }
          .summary-value { font-size: 11pt; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 8pt; }
          th { background: #f1f5f9; padding: 4px 6px; text-align: left; font-weight: bold; border-bottom: 1px solid #000; font-size: 8pt; }
          td { padding: 3px 6px; border-bottom: 1px solid #e2e8f0; }
          .amount-positive { color: #16a34a; font-weight: bold; }
          .amount-negative { color: #dc2626; font-weight: bold; }
          .section-title { font-size: 10pt; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #2563eb; padding-bottom: 2px; }
          .footer { margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <div class="clinic-name">${window.__CS__?.name || 'Clinic'}</div>
              <div class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</div>
            </div>
            <div>
              <div class="report-title">Account Statement</div>
              <div style="font-size: 9pt; color: #666;">${currentDate}</div>
            </div>
          </div>

          <table class="patient-info" style="width: 100%;">
            <tr>
              <td><span class="info-label">Patient:</span> ${account.patient?.name || 'N/A'}</td>
              <td><span class="info-label">Phone:</span> ${account.patient?.mobile || 'N/A'}</td>
            </tr>
            <tr>
              <td><span class="info-label">Patient ID:</span> ${account.patient?.id || 'N/A'}</td>
              <td><span class="info-label">Account Type:</span> ${account.accountType}</td>
            </tr>
          </table>

          <div class="summary-box">
            <div class="summary-card blue">
              <div class="summary-label" style="color: #2563eb;">Balance</div>
              <div class="summary-value">${summary.currentBalance.toFixed(2)}</div>
            </div>
            ${isCredit ? `
            <div class="summary-card red">
              <div class="summary-label" style="color: #dc2626;">Debt Owed</div>
              <div class="summary-value">${summary.currentDebt.toFixed(2)}</div>
            </div>
            ` : ''}
            <div class="summary-card green">
              <div class="summary-label" style="color: #16a34a;">Deposited</div>
              <div class="summary-value">${summary.totalDeposited.toFixed(2)}</div>
            </div>
            <div class="summary-card orange">
              <div class="summary-label" style="color: #ea580c;">Used</div>
              <div class="summary-value">${summary.totalUsed.toFixed(2)}</div>
            </div>
            ${isCredit ? `
            <div class="summary-card green">
              <div class="summary-label" style="color: #059669;">Debt Paid</div>
              <div class="summary-value">${summary.totalDebtPaid.toFixed(2)}</div>
            </div>
            ` : ''}
          </div>

          <div class="section-title">Billing History</div>
          <table>
            <thead>
              <tr>
                <th>Visit</th>
                <th>Date</th>
                <th>Services</th>
                <th style="text-align: right;">Total</th>
                <th style="text-align: right;">Paid</th>
                <th style="text-align: right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(groupedBillings).map(group => `
              <tr>
                <td>${group.visitUid}</td>
                <td>${new Date(group.visitDate).toLocaleDateString()}</td>
                <td>${group.billings.reduce((sum, b) => sum + (b.services?.length || 0), 0)} items</td>
                <td style="text-align: right;">${group.totalAmount.toFixed(2)}</td>
                <td style="text-align: right;" class="amount-positive">${group.totalPaid.toFixed(2)}</td>
                <td style="text-align: right;" class="${group.totalAmount - group.totalPaid > 0 ? 'amount-negative' : 'amount-positive'}">${(group.totalAmount - group.totalPaid).toFixed(2)}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>

          ${transactions && transactions.length > 0 ? `
          <div class="section-title">Transactions</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map(tx => `
              <tr>
                <td>${new Date(tx.createdAt).toLocaleDateString()}</td>
                <td>${tx.type}</td>
                <td>${tx.description || tx.notes || '-'}</td>
                <td style="text-align: right;" class="${tx.type === 'DEPOSIT' || tx.type === 'PAYMENT' ? 'amount-positive' : 'amount-negative'}">
                  ${tx.type === 'DEPOSIT' || tx.type === 'PAYMENT' ? '+' : '-'}${tx.amount.toFixed(2)}
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          ${deposits && deposits.length > 0 ? `
          <div class="section-title">Deposits</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>By</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${deposits.map(dep => `
              <tr>
                <td>${new Date(dep.createdAt).toLocaleDateString()}</td>
                <td>${dep.paymentMethod}</td>
                <td>${dep.depositedBy?.fullname || 'N/A'}</td>
                <td style="text-align: right;" class="amount-positive">+${dep.amount.toFixed(2)}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          <div class="footer">
            <div>Thank you for choosing ${window.__CS__?.name || 'Clinic'}!</div>
            <div>Generated: ${currentDate}</div>
          </div>
        </div>
      </body>
    </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handlePrintGroupedBilling = (group) => {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const doctorName = group.doctor?.fullname || 'Unassigned';
    const totalPaid = group.totalPaid;
    const remaining = group.totalAmount - group.totalPaid;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked! Please allow popups for this site.');
      return;
    }

    const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Visit Bill - ${account.patient?.name}</title>
        <style>
          @media print { @page { size: A4; margin: 8mm; } }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 10px; color: #000; font-size: 10pt; }
          .container { max-width: 100%; }
          .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 2px solid #2563eb; }
          .clinic-name { font-size: 14pt; font-weight: bold; color: #1e40af; }
          .clinic-tagline { font-size: 8pt; color: #666; }
          .report-title { font-size: 12pt; font-weight: bold; }
          .info-box { margin-bottom: 10px; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 9pt; }
          .info-label { font-weight: bold; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9pt; }
          th { background: #f1f5f9; padding: 4px 6px; text-align: left; font-weight: bold; border-bottom: 1px solid #000; }
          td { padding: 3px 6px; border-bottom: 1px solid #e2e8f0; }
          .amount-positive { color: #16a34a; font-weight: bold; }
          .amount-negative { color: #dc2626; font-weight: bold; }
          .summary-row td { background: #f1f5f9; font-weight: bold; }
          .footer { margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <div class="clinic-name">${window.__CS__?.name || 'Clinic'}</div>
              <div class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</div>
            </div>
            <div>
              <div class="report-title">Visit Bill</div>
              <div style="font-size: 9pt; color: #666;">${currentDate}</div>
            </div>
          </div>

          <table class="info-box" style="width: 100%;">
            <tr>
              <td><span class="info-label">Patient:</span> ${account.patient?.name || 'N/A'}</td>
              <td><span class="info-label">Phone:</span> ${account.patient?.mobile || 'N/A'}</td>
            </tr>
            <tr>
              <td><span class="info-label">Patient ID:</span> ${account.patient?.id || 'N/A'}</td>
              <td><span class="info-label">Visit:</span> ${group.visitUid}</td>
            </tr>
            <tr>
              <td><span class="info-label">Date:</span> ${new Date(group.visitDate).toLocaleDateString()}</td>
              <td><span class="info-label">Doctor:</span> Dr. ${doctorName}</td>
            </tr>
          </table>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Service</th>
                <th>Category</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${group.billings.flatMap(billing => billing.services || []).map((service, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${service.service?.name || 'Unknown'}</td>
                <td>${service.service?.category || 'Other'}</td>
                <td style="text-align: center;">${service.quantity}</td>
                <td style="text-align: right;">${service.unitPrice.toFixed(2)}</td>
                <td style="text-align: right;">${service.totalPrice.toFixed(2)}</td>
              </tr>
              `).join('')}
              <tr class="summary-row">
                <td colspan="4"></td>
                <td style="text-align: right;">TOTAL:</td>
                <td style="text-align: right;">${group.totalAmount.toFixed(2)}</td>
              </tr>
              ${totalPaid > 0 ? `
              <tr>
                <td colspan="4"></td>
                <td style="text-align: right;" class="amount-positive">PAID:</td>
                <td style="text-align: right;" class="amount-positive">${totalPaid.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${remaining > 0 ? `
              <tr>
                <td colspan="4"></td>
                <td style="text-align: right;" class="amount-negative">BALANCE:</td>
                <td style="text-align: right;" class="amount-negative">${remaining.toFixed(2)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>

          ${group.billings.flatMap(b => b.payments || []).length > 0 ? `
          <table>
            <thead>
              <tr>
                <th colspan="3">Payment History</th>
              </tr>
            </thead>
            <tbody>
              ${group.billings.flatMap(billing =>
      (billing.payments || []).map(payment => `
                <tr>
                  <td>${new Date(payment.createdAt).toLocaleDateString()}</td>
                  <td>${payment.type} ${payment.bankName || ''}</td>
                  <td style="text-align: right;" class="amount-positive">+${payment.amount.toFixed(2)}</td>
                </tr>
                `)
    ).join('')}
            </tbody>
          </table>
          ` : ''}

          <div class="footer">
            <div>Thank you for choosing ${window.__CS__?.name || 'Clinic'}!</div>
            <div>Generated: ${currentDate}</div>
          </div>
        </div>
      </body>
    </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <>
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-blue-50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${isBoth ? 'bg-indigo-500' : isCredit ? 'bg-red-500' : 'bg-green-500'}`}>
            {account.patient?.name?.charAt(0) || 'P'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{account.patient?.name}</h2>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{account.patient?.mobile || 'No phone'}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isBoth ? 'bg-indigo-100 text-indigo-700' : isCredit ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {isBoth ? 'ADVANCE + CREDIT' : account.accountType} Account
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm font-medium flex items-center gap-1"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* View Mode Switcher for BOTH accounts */}
      {isBoth && (
        <div className="px-6 py-3 bg-indigo-50 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Viewing Account As:</p>
            <div className="flex bg-white rounded-lg border border-indigo-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setViewMode('credit')}
                className={`px-4 py-2 text-sm font-semibold transition-all ${viewMode === 'credit' ? 'bg-red-600 text-white shadow-inner' : 'text-gray-600 hover:bg-red-50'}`}
              >
                📋 Credit Account
              </button>
              <button
                onClick={() => setViewMode('advance')}
                className={`px-4 py-2 text-sm font-semibold transition-all ${viewMode === 'advance' ? 'bg-green-600 text-white shadow-inner' : 'text-gray-600 hover:bg-green-50'}`}
              >
                💰 Advance Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending acceptance notice */}
      {Number(account.pendingDepositAmount || 0) > 0 && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <p className="text-sm font-medium text-amber-800">
            ETB {Number(account.pendingDepositAmount).toFixed(2)} is waiting for billing acceptance. This money is not usable until billing accepts it and records it in daily cash.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="px-6 py-4 bg-white border-b flex-shrink-0">
        {/* Advance View Summary (shown if ADVANCE-only or BOTH in advance mode) */}
        {(!isBoth || viewMode === 'advance') && isAdvance && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-green-50 border border-green-100">
              <p className="text-[10px] font-bold uppercase text-green-500 tracking-wider">Advance Balance</p>
              <p className={`text-xl font-black ${summary.currentBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {summary.currentBalance.toFixed(2)} ETB
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-[10px] font-bold uppercase text-blue-500 tracking-wider">Total Deposited</p>
              <p className="text-xl font-black text-blue-700">{summary.totalDeposited.toFixed(2)} ETB</p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-100">
              <p className="text-[10px] font-bold uppercase text-orange-500 tracking-wider">Total Used</p>
              <p className="text-xl font-black text-orange-700">{summary.totalUsed.toFixed(2)} ETB</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Advance Transactions</p>
              <p className="text-xl font-black text-slate-700">
                {isBoth ? filteredTransactions.length : advanceTransactionCount}
              </p>
            </div>
          </div>
        )}

        {/* Credit View Summary (shown if CREDIT-only or BOTH in credit mode) */}
        {(!isBoth || viewMode === 'credit') && isCredit && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
              <p className="text-[10px] font-bold uppercase text-purple-500 tracking-wider">Credit Limit</p>
              <p className="text-xl font-black text-purple-700">{(summary.creditLimit || 0).toFixed(2)} ETB</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-[10px] font-bold uppercase text-red-500 tracking-wider">Outstanding Debt</p>
              <p className="text-xl font-black text-red-700">{summary.currentDebt.toFixed(2)} ETB</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-[10px] font-bold uppercase text-blue-500 tracking-wider">Available Credit</p>
              <p className={`text-xl font-black ${((summary.creditLimit || 0) - summary.currentDebt) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {((summary.creditLimit || 0) - summary.currentDebt).toFixed(2)} ETB
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[10px] font-bold uppercase text-emerald-500 tracking-wider">Debt Paid</p>
              <p className="text-xl font-black text-emerald-700">{summary.totalDebtPaid.toFixed(2)} ETB</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Credit Transactions</p>
              <p className="text-xl font-black text-slate-700">
                {isBoth ? filteredTransactions.length : creditTransactionCount}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="px-6 border-b bg-white flex-shrink-0">
        <div className="flex gap-1">
          {[
            { id: 'overview', label: 'Billing History', icon: <Receipt className="h-4 w-4" /> },
            { id: 'transactions', label: 'All Transactions', icon: <FileText className="h-4 w-4" /> },
            { id: 'deposits', label: 'Deposits', icon: <DollarSign className="h-4 w-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeSection === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* BILLING HISTORY TAB */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {isBoth && (
              <div className={`p-3 rounded-lg border text-sm font-medium ${viewMode === 'advance' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                Showing {viewMode === 'advance' ? '💰 Advance' : '📋 Credit'} billing history. Use the switcher above to toggle.
              </div>
            )}
            {filteredBillings.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No {isBoth ? (viewMode === 'advance' ? 'advance' : 'credit') : ''} billing records found</p>
                <p className="text-gray-400 text-sm">Billings linked to this account will appear here</p>
              </div>
            ) : (
              // Group billings by visitId
              (() => {
                const groupedBillings = filteredBillings.reduce((acc, billing) => {
                  const visitId = billing.visitId || billing.visit?.id || billing.id;
                  if (!acc[visitId]) {
                    acc[visitId] = {
                      visitId,
                      visitUid: billing.visit?.visitUid || `Bill #${billing.id.substring(0, 8)}`,
                      visitDate: billing.visit?.date || billing.createdAt,
                      doctor: billing.visit?.assignment?.doctor,
                      billings: [],
                      totalAmount: 0,
                      totalPaid: 0
                    };
                  }
                  acc[visitId].billings.push(billing);
                  acc[visitId].totalAmount += billing.totalAmount;
                  acc[visitId].totalPaid += billing.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                  return acc;
                }, {});

                const groupedList = Object.values(groupedBillings);

                return groupedList.map(group => {
                  const isExpanded = expandedBillings.has(group.visitId);
                  const remaining = group.totalAmount - group.totalPaid;
                  const allPaid = group.totalPaid >= group.totalAmount;
                  const partiallyPaid = group.totalPaid > 0 && group.totalPaid < group.totalAmount;

                  return (
                    <div key={group.visitId} className="border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                      {/* Group Header - Clickable */}
                      <button
                        onClick={() => toggleBilling(group.visitId)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${allPaid ? 'bg-green-100 text-green-600' :
                            partiallyPaid ? 'bg-orange-100 text-orange-600' :
                              'bg-yellow-100 text-yellow-600'
                            }`}>
                            {allPaid ? <CheckCircle className="h-5 w-5" /> :
                              partiallyPaid ? <Clock className="h-5 w-5" /> :
                                <AlertTriangle className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">
                                Visit: {group.visitUid}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${allPaid ? 'bg-green-100 text-green-700' :
                                partiallyPaid ? 'bg-orange-100 text-orange-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                {allPaid ? 'PAID' : partiallyPaid ? 'PARTIALLY_PAID' : 'PENDING'}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                {group.billings.length} bill(s)
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(group.visitDate)}
                              </span>
                              {group.doctor ? (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  Dr. {group.doctor.fullname}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  Unassigned
                                </span>
                              )}
                              <span>{group.billings.reduce((sum, b) => sum + (b.services?.length || 0), 0)} service(s)</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-black text-gray-900">{group.totalAmount.toFixed(2)} ETB</p>
                            {remaining > 0 && !allPaid && (
                              <p className="text-xs text-red-500 font-medium">Remaining: {remaining.toFixed(2)} ETB</p>
                            )}
                            {group.totalPaid > 0 && (
                              <p className="text-xs text-green-600 font-medium">Paid: {group.totalPaid.toFixed(2)} ETB</p>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t bg-slate-50 px-5 py-4 space-y-4">
                          {/* Print Button */}
                          <div className="flex justify-between items-center">
                            <h5 className="text-xs font-bold uppercase text-gray-500 tracking-wider">All Services for this Visit</h5>
                            <button
                              onClick={() => handlePrintGroupedBilling(group)}
                              className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-xs font-medium flex items-center gap-1"
                            >
                              <Printer className="h-3 w-3" />
                              Print Visit Bill
                            </button>
                          </div>

                          {/* All Services Table */}
                          <div className="bg-white rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b text-[11px] uppercase text-gray-500 tracking-wider">
                                  <th className="px-4 py-2 text-left">Service</th>
                                  <th className="px-4 py-2 text-left">Category</th>
                                  <th className="px-4 py-2 text-center">Qty</th>
                                  <th className="px-4 py-2 text-right">Unit Price</th>
                                  <th className="px-4 py-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.billings.flatMap(billing =>
                                  billing.services?.map((bs, idx) => (
                                    <tr key={`${billing.id}-${idx}`} className="border-b last:border-0 hover:bg-blue-50/40">
                                      <td className="px-4 py-2.5">
                                        <span className="font-medium text-gray-900">{bs.service?.name || 'Unknown'}</span>
                                        {bs.service?.code && (
                                          <span className="ml-2 text-[10px] text-gray-400 font-mono">{bs.service.code}</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${getCategoryColor(bs.service?.category)}`}>
                                          {getCategoryLabel(bs.service?.category)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-center font-medium">{bs.quantity}</td>
                                      <td className="px-4 py-2.5 text-right text-gray-600">{bs.unitPrice.toFixed(2)}</td>
                                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">{bs.totalPrice.toFixed(2)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                              <tfoot className="bg-gray-50">
                                <tr>
                                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-700">Total:</td>
                                  <td className="px-4 py-3 text-right font-bold text-gray-900">{group.totalAmount.toFixed(2)} ETB</td>
                                </tr>
                                {group.totalPaid > 0 && (
                                  <tr>
                                    <td colSpan={4} class="px-4 py-2 text-right font-medium text-green-600">Amount Paid:</td>
                                    <td class="px-4 py-2 text-right font-bold text-green-600">{group.totalPaid.toFixed(2)} ETB</td>
                                  </tr>
                                )}
                                {remaining > 0 && (
                                  <tr>
                                    <td colSpan={4} class="px-4 py-2 text-right font-medium text-red-600">Remaining:</td>
                                    <td class="px-4 py-2 text-right font-bold text-red-600">{remaining.toFixed(2)} ETB</td>
                                  </tr>
                                )}
                              </tfoot>
                            </table>
                          </div>

                          {/* Payment History */}
                          {group.billings.flatMap(b => b.payments || []).length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Payment History</h5>
                              <div className="bg-white rounded-lg border overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-50 border-b text-[11px] uppercase text-gray-500 tracking-wider">
                                      <th className="px-4 py-2 text-left">Date</th>
                                      <th className="px-4 py-2 text-left">Type</th>
                                      <th className="px-4 py-2 text-left">Bank/Ref</th>
                                      <th className="px-4 py-2 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.billings.flatMap(billing =>
                                      billing.payments?.map((payment, idx) => (
                                        <tr key={`${billing.id}-payment-${idx}`} className="border-b last:border-0">
                                          <td className="px-4 py-2.5">{formatDate(payment.createdAt)}</td>
                                          <td className="px-4 py-2.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${payment.type === 'CASH' ? 'bg-green-100 text-green-700' :
                                              payment.type === 'BANK' ? 'bg-blue-100 text-blue-700' :
                                                'bg-purple-100 text-purple-700'
                                              }`}>
                                              {payment.type}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2.5 text-gray-600">
                                            {payment.bankName || '-'} {payment.transNumber ? `(${payment.transNumber})` : ''}
                                          </td>
                                          <td className="px-4 py-2.5 text-right font-bold text-green-600">+{payment.amount.toFixed(2)} ETB</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {activeSection === 'transactions' && (
          <div className="space-y-3">
            {isBoth && (
              <div className={`p-3 rounded-lg border text-sm font-medium ${viewMode === 'advance' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                Showing {viewMode === 'advance' ? '💰 Advance' : '📋 Credit'} transactions only. Use the switcher above to toggle.
              </div>
            )}
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No {isBoth ? (viewMode === 'advance' ? 'advance' : 'credit') : ''} transactions recorded yet</p>
              </div>
            ) : (
              filteredTransactions.map((tx, idx) => (
                <div key={tx.id || idx} className={`p-4 rounded-xl border ${getTransactionColor(tx.type)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getTransactionIcon(tx.type)}</div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm">{tx.type}</span>
                          <span className="text-xs opacity-70">{formatDateTime(tx.createdAt)}</span>
                        </div>
                        {tx.description && <p className="text-sm mb-1">{tx.description}</p>}
                        {tx.notes && <p className="text-xs opacity-70 italic">{tx.notes}</p>}

                        {/* Show linked billing services */}
                        {tx.billing && tx.billing.services && tx.billing.services.length > 0 && (
                          <div className="mt-2 pl-0">
                            <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Services on this bill:</p>
                            <div className="flex flex-wrap gap-1">
                              {tx.billing.services.map((bs, sIdx) => (
                                <span key={sIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/60 text-[11px] font-medium border">
                                  {bs.service?.name}
                                  <span className="opacity-60">({bs.totalPrice.toFixed(0)} ETB)</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Show visit info */}
                        {tx.visit && (
                          <p className="text-xs mt-1 opacity-70">
                            Visit: {tx.visit.visitUid} — {formatDate(tx.visit.date)}
                            {tx.visit.assignment?.doctor && ` — Dr. ${tx.visit.assignment.doctor.fullname}`}
                          </p>
                        )}

                        {tx.processedBy && (
                          <p className="text-[10px] mt-1 opacity-50">Processed by: {tx.processedBy.fullname}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-lg font-black">{tx.amount.toFixed(2)} ETB</p>
                      <p className="text-[10px] opacity-60">
                        {tx.subAccount === 'CREDIT' ? 'Debt' : 'Balance'}: {tx.balanceBefore.toFixed(2)} → {tx.balanceAfter.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* DEPOSITS TAB */}
        {activeSection === 'deposits' && (
          <div className="space-y-3">
            {isBoth && viewMode === 'credit' && (
              <div className="p-3 rounded-lg border bg-amber-50 border-amber-200 text-sm font-medium text-amber-700">
                ℹ️ Deposits are advance account transactions. Switch to <strong>Advance Account</strong> view to see deposit history.
              </div>
            )}
            {(isBoth && viewMode === 'credit') ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Deposits are shown in Advance view</p>
                <button onClick={() => setViewMode('advance')} className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  Switch to Advance View
                </button>
              </div>
            ) : deposits.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No deposits recorded yet</p>
              </div>
            ) : (
              deposits.map((dep, idx) => (
                <div key={dep.id || idx} className="p-4 rounded-xl border border-green-200 bg-green-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-bold text-green-900">Deposit — {dep.paymentMethod}</p>
                        <p className="text-xs text-green-700">{formatDateTime(dep.createdAt)}</p>
                        {dep.notes && <p className="text-xs text-green-600 italic mt-0.5">{dep.notes}</p>}
                        {dep.depositedBy && (
                          <p className="text-[10px] text-green-500 mt-0.5">By: {dep.depositedBy.fullname}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xl font-black text-green-700">+{dep.amount.toFixed(2)} ETB</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </>
  );
};

export default PatientAccounts;
