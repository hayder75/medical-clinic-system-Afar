import React, { useState, useEffect } from 'react';
import { Clock, Check, X, Eye } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const AccountRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING');

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/accounts/requests?status=${activeTab}`);
      setRequests(response.data.requests || []);
    } catch (error) {
      toast.error('Failed to fetch requests');
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await api.post(`/accounts/requests/${requestId}/approve`);
      toast.success('Request approved successfully');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve request');
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      try {
        await api.post(`/accounts/requests/${requestId}/reject`, { reason });
        toast.success('Request rejected');
        fetchRequests();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to reject request');
      }
    }
  };

  const getRequestTypeLabel = (type) => {
    switch (type) {
      case 'CREATE_ACCOUNT': return 'New Account';
      case 'ADD_CREDIT': return 'Add Credit';
      case 'ADD_DEPOSIT': return 'Add Deposit';
      case 'RETURN_MONEY': return 'Return Money';
      default: return type;
    }
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Account Requests</h2>
        <p className="text-gray-600">Review and manage account requests</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'PENDING'
                ? 'text-yellow-600 border-b-2 border-yellow-600'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Clock className="inline h-4 w-4 mr-2" />
            Pending
          </button>
          <button
            onClick={() => setActiveTab('APPROVED')}
            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'APPROVED'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Check className="inline h-4 w-4 mr-2" />
            Approved
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`px-4 py-2 font-medium transition-colors ${activeTab === 'REJECTED'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <X className="inline h-4 w-4 mr-2" />
            Rejected
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Phone</th>
                <th>Request Type</th>
                <th>Account Type</th>
                <th>Amount</th>
                <th>Requested By</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    No pending requests
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id}>
                    <td className="font-medium">{request.patient?.name || 'N/A'}</td>
                    <td>{request.patient?.mobile || 'N/A'}</td>
                    <td>
                      <span className="badge badge-warning">
                        {getRequestTypeLabel(request.requestType)}
                      </span>
                    </td>
                    <td>
                      {request.accountType && (
                        <span className={`badge ${['CREDIT', 'BOTH'].includes(request.accountType) ? 'badge-error' :
                            ['ADVANCE', 'BOTH'].includes(request.accountType) ? 'badge-success' : 'badge-info'
                          }`}>
                          {request.accountType === 'BOTH' ? 'ADVANCE + CREDIT' : request.accountType}
                        </span>
                      )}
                    </td>
                    <td>
                      {request.amount && (
                        <span className="font-semibold text-green-600">
                          ${request.amount.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="text-sm text-gray-600">
                      {request.requestedBy?.fullname || request.requestedBy?.username || 'N/A'}
                    </td>
                    <td className="text-sm text-gray-600">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      {request.status === 'PENDING' ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm font-medium flex items-center gap-1"
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-medium flex items-center gap-1"
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      ) : request.status === 'APPROVED' ? (
                        <div className="text-green-700 text-sm">
                          <p>✓ Approved by {request.verifiedBy?.fullname || 'Admin'}</p>
                          <p className="text-xs text-gray-500">
                            {request.verifiedAt ? new Date(request.verifiedAt).toLocaleString() : ''}
                          </p>
                        </div>
                      ) : request.status === 'REJECTED' ? (
                        <div className="text-red-700 text-sm">
                          <p>✗ Rejected by {request.verifiedBy?.fullname || 'Admin'}</p>
                          <p className="text-xs text-gray-500">
                            {request.rejectionReason || 'No reason provided'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {request.verifiedAt ? new Date(request.verifiedAt).toLocaleString() : ''}
                          </p>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountRequests;

