import React, { useState, useEffect } from 'react';
import {
  Users,
  Stethoscope,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity
} from 'lucide-react';
import api from '../../services/api';

const DoctorQueueStatus = () => {
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    averageWorkload: 0,
    totalDoctors: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDoctorQueueStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDoctorQueueStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDoctorQueueStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctors/queue-status');
      setDoctors(response.data.doctors);
      setStats({
        totalPatients: response.data.totalPatients,
        averageWorkload: response.data.averageWorkload,
        totalDoctors: response.data.doctors.length
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching doctor queue status:', err);
      setError('Failed to load doctor queue status');
    } finally {
      setLoading(false);
    }
  };

  const getWorkloadColor = (workload) => {
    if (workload === 0) return 'text-green-600 bg-green-100';
    if (workload <= 2) return 'text-blue-600 bg-blue-100';
    if (workload <= 5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getWorkloadStatus = (workload) => {
    if (workload === 0) return 'Available';
    if (workload <= 2) return 'Light';
    if (workload <= 5) return 'Moderate';
    return 'Heavy';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-red-600">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p>{error}</p>
          <button
            onClick={fetchDoctorQueueStatus}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Stethoscope className="h-5 w-5 mr-2 text-blue-600" />
              Doctor Queue Status
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Real-time patient distribution across doctors
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{stats.totalPatients}</div>
            <div className="text-sm text-gray-600">Total Patients</div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{stats.totalDoctors}</div>
            <div className="text-sm text-gray-600">Active Doctors</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{stats.averageWorkload}</div>
            <div className="text-sm text-gray-600">Avg Workload</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {doctors.filter(d => d.totalWorkload === 0).length}
            </div>
            <div className="text-sm text-gray-600">Available</div>
          </div>
        </div>
      </div>

      {/* Doctors List */}
      <div className="p-6">
        <div className="space-y-3">
          {doctors.map((doctor, index) => (
            <div
              key={doctor.id}
              className={`p-4 rounded-lg border-2 transition-all duration-200 ${doctor.totalWorkload === 0
                  ? 'border-green-200 bg-green-50'
                  : doctor.totalWorkload <= 2
                    ? 'border-blue-200 bg-blue-50'
                    : doctor.totalWorkload <= 5
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-red-200 bg-red-50'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${doctor.totalWorkload === 0
                      ? 'bg-green-100 text-green-600'
                      : doctor.totalWorkload <= 2
                        ? 'bg-blue-100 text-blue-600'
                        : doctor.totalWorkload <= 5
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-red-100 text-red-600'
                    }`}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{doctor.fullname}</h4>
                    <p className="text-sm text-gray-600">
                      {doctor.qualifications?.join(', ') || 'General Medicine'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{doctor.totalWorkload}</div>
                      <div className="text-xs text-gray-600">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-700">{doctor.newPatientsCount}</div>
                      <div className="text-xs text-gray-600">New</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-700">{doctor.resultsCount}</div>
                      <div className="text-xs text-gray-600">Results</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${getWorkloadColor(doctor.totalWorkload)}`}>
                      {getWorkloadStatus(doctor.totalWorkload)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Workload</span>
                  <span>{doctor.totalWorkload}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${doctor.totalWorkload === 0
                        ? 'bg-green-500'
                        : doctor.totalWorkload <= 2
                          ? 'bg-blue-500'
                          : doctor.totalWorkload <= 5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    style={{ width: `${Math.min((doctor.totalWorkload / 10) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center">
            <Activity className="h-4 w-4 mr-1" />
            Auto-refreshes every 30 seconds
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-1"></div>
              <span>Moderate</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
              <span>Heavy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorQueueStatus;




