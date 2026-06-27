import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import TriageQueue from '../../components/nurse/TriageQueue';
import DailyTasks from '../../components/nurse/DailyTasks';
import DoctorAssignment from '../../components/nurse/DoctorAssignment';
import ContinuousVitals from '../../components/nurse/ContinuousVitals';
import WalkInNurseServices from './WalkInNurseServices';
import WalkInNurseOrders from './WalkInNurseOrders';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  Stethoscope, 
  Calendar, 
  Users,
  Activity,
  Heart,
  Thermometer,
  Scale,
  Eye
} from 'lucide-react';

const NurseDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    waitingPatients: 0,
    triagedToday: 0,
    pendingTasks: 0,
    completedTasks: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchDashboardStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/nurses/dashboard-stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to fetch dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Waiting Patients',
      value: stats.waitingPatients,
      icon: Users,
      color: 'bg-blue-500',
      description: 'Patients waiting for triage'
    },
    {
      title: 'Triaged Today',
      value: stats.triagedToday,
      icon: Stethoscope,
      color: 'bg-green-500',
      description: 'Patients triaged today'
    },
    {
      title: 'Pending Tasks',
      value: stats.pendingTasks,
      icon: Calendar,
      color: 'bg-yellow-500',
      description: 'Daily tasks pending'
    },
    {
      title: 'Completed Tasks',
      value: stats.completedTasks,
      icon: Activity,
      color: 'bg-purple-500',
      description: 'Tasks completed today'
    }
  ];

  const DashboardOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                {loading ? (
                  <div className="animate-pulse h-8 w-16 bg-gray-200 rounded mt-1"></div>
                ) : (
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                )}
                <p className="text-xs text-gray-500">{stat.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button onClick={() => navigate('/nurse/queue')} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <Stethoscope className="h-5 w-5 text-blue-500 mr-3" />
                <div>
                  <p className="font-medium">Start Triage</p>
                  <p className="text-sm text-gray-500">Record patient vitals and condition</p>
                </div>
              </div>
            </button>
            <button onClick={() => navigate('/nurse/tasks')} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-green-500 mr-3" />
                <div>
                  <p className="font-medium">View Daily Tasks</p>
                  <p className="text-sm text-gray-500">Check continuous infusion tasks</p>
                </div>
              </div>
            </button>
            <button onClick={() => navigate('/nurse/assign')} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-purple-500 mr-3" />
                <div>
                  <p className="font-medium">Assign Doctor</p>
                  <p className="text-sm text-gray-500">Assign doctor to triaged patient</p>
                </div>
              </div>
            </button>
            <button onClick={() => navigate('/nurse/continuous-vitals')} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <Activity className="h-5 w-5 text-orange-500 mr-3" />
                <div>
                  <p className="font-medium">Continuous Vitals</p>
                  <p className="text-sm text-gray-500">Monitor hospitalized patients</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Activity feed coming soon</p>
          </div>
        </div>
      </div>

      {/* Vitals Reference */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Vitals Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Heart className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="font-medium text-blue-900">Heart Rate</p>
            <p className="text-sm text-blue-600">60-100 bpm</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <Thermometer className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <p className="font-medium text-red-900">Temperature</p>
            <p className="text-sm text-red-600">36.1-37.2°C</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <Scale className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-green-900">Blood Pressure</p>
            <p className="text-sm text-green-600">120/80 mmHg</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <Eye className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="font-medium text-purple-900">Oxygen Saturation</p>
            <p className="text-sm text-purple-600">95-100%</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<DashboardOverview />} />
      <Route path="/queue" element={<TriageQueue />} />
      <Route path="/tasks" element={<DailyTasks />} />
      <Route path="/walk-in-services" element={<WalkInNurseServices />} />
      <Route path="/walk-in-orders" element={<WalkInNurseOrders />} />
      <Route path="/assign" element={<DoctorAssignment />} />
      <Route path="/continuous-vitals" element={<ContinuousVitals />} />
    </Routes>
  );
};

export default NurseDashboard;
