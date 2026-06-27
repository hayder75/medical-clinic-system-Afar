import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import AppointmentsCalendar from '../../components/appointments/AppointmentsCalendar';
import api from '../../services/api';
import { 
  Calendar, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Plus,
  User
} from 'lucide-react';

const AppointmentsPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    todayAppointments: 0,
    completedToday: 0,
    totalAppointments: 0,
    upcomingAppointments: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointmentStats();
  }, []);

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const fetchAppointmentStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/schedules/appointments');
      const appointments = response.data;
      
      // Set appointments for the list
      setAppointments(appointments);
      
      const today = new Date().toISOString().split('T')[0];
      const todayAppointments = appointments.filter(apt => 
        apt.date && apt.date.split('T')[0] === today
      );
      
      const completedToday = appointments.filter(apt => 
        apt.date && apt.date.split('T')[0] === today && apt.status === 'COMPLETED'
      );
      
      const upcomingAppointments = appointments.filter(apt => 
        apt.date && apt.date.split('T')[0] > today && apt.status !== 'COMPLETED'
      );

      setStats({
        todayAppointments: todayAppointments.length,
        completedToday: completedToday.length,
        totalAppointments: appointments.length,
        upcomingAppointments: upcomingAppointments.length
      });

      // Generate recent activity from appointments
      const activity = appointments
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 4)
        .map(apt => ({
          id: apt.id,
          type: apt.status === 'COMPLETED' ? 'completed' : apt.status === 'SCHEDULED' ? 'scheduled' : 'pending',
          message: apt.status === 'COMPLETED' 
            ? `Appointment completed - ${apt.patient?.name || 'Patient'}`
            : apt.status === 'SCHEDULED'
            ? `Appointment scheduled - ${apt.patient?.name || 'Patient'}`
            : `Appointment ${apt.status.toLowerCase()} - ${apt.patient?.name || 'Patient'}`,
          time: apt.createdAt,
          color: apt.status === 'COMPLETED' ? 'green' : apt.status === 'SCHEDULED' ? 'blue' : 'yellow'
        }));
      
      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching appointment stats:', error);
      // Fallback to default values
      setStats({
        todayAppointments: 0,
        completedToday: 0,
        totalAppointments: 0,
        upcomingAppointments: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Today\'s Appointments',
      value: stats.todayAppointments,
      icon: Calendar,
      color: 'bg-blue-500',
      description: 'Scheduled for today'
    },
    {
      title: 'Completed Today',
      value: stats.completedToday,
      icon: CheckCircle,
      color: 'bg-green-500',
      description: 'Appointments completed'
    },
    {
      title: 'Total Appointments',
      value: stats.totalAppointments,
      icon: Clock,
      color: 'bg-purple-500',
      description: 'All appointments this month'
    },
    {
      title: 'Upcoming',
      value: stats.upcomingAppointments,
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      description: 'Scheduled for future'
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
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
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
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <Plus className="h-5 w-5 text-blue-500 mr-3" />
                <div>
                  <p className="font-medium">Schedule Appointment</p>
                  <p className="text-sm text-gray-500">Book new patient appointment</p>
                </div>
              </div>
            </button>
            <button 
              onClick={() => navigate('/appointments/calendar')}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-green-500 mr-3" />
                <div>
                  <p className="font-medium">View Calendar</p>
                  <p className="text-sm text-gray-500">See all scheduled appointments</p>
                </div>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <User className="h-5 w-5 text-purple-500 mr-3" />
                <div>
                  <p className="font-medium">Patient Appointments</p>
                  <p className="text-sm text-gray-500">View patient appointment history</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center">
                    <div className={`h-2 w-2 bg-${activity.color}-500 rounded-full mr-3`}></div>
                    <span className="text-sm text-gray-600">{activity.message}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatTimeAgo(activity.time)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">All Appointments</h3>
          <button 
            onClick={() => navigate('/appointments/calendar')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View Calendar →
          </button>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {appointment.patient?.name || 'Unknown Patient'}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(appointment.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {new Date(appointment.time).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          appointment.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                          appointment.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          appointment.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {appointment.status}
                        </span>
                      </div>
                      {appointment.notes && (
                        <p className="text-sm text-gray-600 mt-1">{appointment.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {appointment.type || 'FOLLOW_UP'}
                    </p>
                    <p className="text-xs text-gray-400">
                      Created {formatTimeAgo(appointment.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No appointments found</p>
            <p className="text-sm text-gray-400 mt-1">Schedule your first appointment to get started</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<DashboardOverview />} />
      <Route path="/calendar" element={<AppointmentsCalendar />} />
    </Routes>
  );
};

export default AppointmentsPage;
