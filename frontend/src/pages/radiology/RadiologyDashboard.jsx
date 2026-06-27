import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import RadiologyOrders from '../../components/radiology/RadiologyOrders';
import api from '../../services/api';
import { 
  Scan, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  FileText,
  Image
} from 'lucide-react';

const RadiologyDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingOrders: 0,
    completedToday: 0,
    totalScans: 0,
    urgentOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Fetch pending orders
      const pendingResponse = await api.get('/radiologies/orders?status=PENDING');
      const pendingBatchOrders = pendingResponse.data.batchOrders?.length || 0;
      const pendingWalkInOrders = pendingResponse.data.walkInOrders?.length || 0;
      const pendingOrders = pendingBatchOrders + pendingWalkInOrders;
      
      // Fetch completed orders
      const completedResponse = await api.get('/radiologies/orders?status=COMPLETED');
      const completedBatchOrders = completedResponse.data.batchOrders || [];
      const completedWalkInOrders = completedResponse.data.walkInOrders || [];
      
      // Count completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completedToday = [...completedBatchOrders, ...completedWalkInOrders].filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= today;
      }).length;
      
      // Count urgent orders (emergency visits)
      const urgentOrders = pendingResponse.data.batchOrders?.filter(order => 
        order.visit?.isEmergency === true
      ).length || 0;
      
      // Total scans (all time)
      const totalScans = pendingOrders + completedBatchOrders.length + completedWalkInOrders.length;
      
      setStats({
        pendingOrders,
        completedToday,
        totalScans,
        urgentOrders
      });
    } catch (error) {
      console.error('Error fetching radiology stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Pending Orders',
      value: stats.pendingOrders,
      icon: Clock,
      color: 'bg-yellow-500',
      description: 'Scans waiting for processing'
    },
    {
      title: 'Completed Today',
      value: stats.completedToday,
      icon: CheckCircle,
      color: 'bg-green-500',
      description: 'Scans completed today'
    },
    {
      title: 'Total Scans',
      value: stats.totalScans,
      icon: Scan,
      color: 'bg-blue-500',
      description: 'All scans in the system'
    },
    {
      title: 'Urgent Orders',
      value: stats.urgentOrders,
      icon: AlertTriangle,
      color: 'bg-red-500',
      description: 'High priority scans'
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
            <button 
              onClick={() => navigate('/radiology/orders')}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Scan className="h-5 w-5 text-blue-500 mr-3" />
                <div>
                  <p className="font-medium">Process Order</p>
                  <p className="text-sm text-gray-500">Start processing radiology scan</p>
                </div>
              </div>
            </button>
            <button 
              onClick={() => navigate('/radiology/orders')}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Image className="h-5 w-5 text-green-500 mr-3" />
                <div>
                  <p className="font-medium">Upload Images</p>
                  <p className="text-sm text-gray-500">Upload scan images and reports</p>
                </div>
              </div>
            </button>
            <button 
              onClick={() => navigate('/radiology/orders')}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-purple-500 mr-3" />
                <div>
                  <p className="font-medium">Write Report</p>
                  <p className="text-sm text-gray-500">Create radiology report</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Order Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-700">{stats.pendingOrders}</p>
              <p className="text-sm text-yellow-600">Pending</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-700">{stats.urgentOrders}</p>
              <p className="text-sm text-red-600">Urgent (Emergency)</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{stats.completedToday}</p>
              <p className="text-sm text-green-600">Completed Today</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<DashboardOverview />} />
      <Route path="/orders" element={<RadiologyOrders />} />
    </Routes>
  );
};

export default RadiologyDashboard;
