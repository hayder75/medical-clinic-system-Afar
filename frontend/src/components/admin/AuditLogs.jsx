import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/audit-logs');
      setLogs(response.data.auditLogs || []);
    } catch (error) {
      toast.error('Failed to fetch audit logs');
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.user?.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUser = !userFilter || log.user?.username === userFilter;
    const matchesAction = !actionFilter || log.action.includes(actionFilter);
    const matchesDate = !dateFilter || log.createdAt.includes(dateFilter);
    
    return matchesSearch && matchesUser && matchesAction && matchesDate;
  });

  const getUniqueUsers = () => {
    const users = [...new Set(logs.map(log => log.user?.username).filter(Boolean))];
    return users;
  };

  const getUniqueActions = () => {
    const actions = [...new Set(logs.map(log => log.action.split(' ')[0]))];
    return actions;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionColor = (action) => {
    if (action.includes('POST')) return 'text-green-600';
    if (action.includes('PUT')) return 'text-blue-600';
    if (action.includes('DELETE')) return 'text-red-600';
    return 'text-gray-600';
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
          <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-gray-600">Track all system activities and user actions</p>
        </div>
        <button
          onClick={() => window.print()}
          className="btn btn-secondary flex items-center"
        >
          <Download className="h-5 w-5 mr-2" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <select
              className="input"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            >
              <option value="">All Users</option>
              {getUniqueUsers().map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="input"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              {getUniqueActions().map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="date"
              className="input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP Address</th>
                <th>Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="text-sm text-gray-500">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="font-medium">
                    {log.user?.username || 'System'}
                  </td>
                  <td>
                    <span className={`font-mono text-sm ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {log.entity}
                    </span>
                  </td>
                  <td className="font-mono text-sm">
                    {log.ip}
                  </td>
                  <td className="max-w-xs truncate">
                    {log.details ? (() => {
                      try {
                        const parsed = JSON.parse(log.details);
                        return JSON.stringify(parsed, null, 2);
                      } catch (e) {
                        return log.details;
                      }
                    })() : 'N/A'}
                  </td>
                  <td>
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-blue-600 hover:text-blue-800"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Log Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Timestamp</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">User</label>
                  <p className="text-sm text-gray-900">{selectedLog.user?.username || 'System'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Action</label>
                  <p className="text-sm text-gray-900 font-mono">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Entity</label>
                  <p className="text-sm text-gray-900">{selectedLog.entity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Entity ID</label>
                  <p className="text-sm text-gray-900">{selectedLog.entityId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">IP Address</label>
                  <p className="text-sm text-gray-900 font-mono">{selectedLog.ip}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">User Agent</label>
                  <p className="text-sm text-gray-900 break-all">{selectedLog.userAgent}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Details</label>
                  <pre className="text-xs text-gray-900 bg-gray-100 p-2 rounded overflow-auto max-h-32">
                    {(() => {
                      try {
                        const parsed = JSON.parse(selectedLog.details || '{}');
                        return JSON.stringify(parsed, null, 2);
                      } catch (e) {
                        return selectedLog.details || 'No details available';
                      }
                    })()}
                  </pre>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
