import React, { useState, useEffect } from 'react';
import PrescriptionQueue from '../../components/pharmacy/PrescriptionQueue';
import Inventory from '../../components/pharmacy/Inventory';
import WalkInSales from '../../components/pharmacy/WalkInSales';
import PharmacyInvoices from '../../components/billing/PharmacyInvoices';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Pill, Clock, CheckCircle, AlertTriangle, ShoppingCart, Package, Store, CreditCard, LayoutDashboard } from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { key: 'billing', label: 'Billing', icon: CreditCard },
  { key: 'walkin', label: 'Walk-in Sales', icon: Store },
  { key: 'inventory', label: 'Inventory', icon: Package },
];

const PharmacyDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    pendingPrescriptions: 0,
    dispensedToday: 0,
    totalMedications: 0,
    lowStockItems: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pharmacies/dashboard-stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching pharmacy dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Pending Prescriptions', value: stats.pendingPrescriptions, icon: Clock,
      color: 'bg-yellow-500', description: 'Prescriptions waiting for dispensing'
    },
    {
      title: 'Dispensed Today', value: stats.dispensedToday, icon: CheckCircle,
      color: 'bg-green-500', description: 'Medications dispensed today'
    },
    {
      title: 'Total Medications', value: stats.totalMedications, icon: Pill,
      color: 'bg-blue-500', description: 'Medications in inventory'
    },
    {
      title: 'Low Stock Items', value: stats.lowStockItems, icon: AlertTriangle,
      color: 'bg-red-500', description: 'Medications running low'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat, index) => (
              <div key={index} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    {loading ? (
                      <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-1"></div>
                    ) : (
                      <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                    )}
                    <p className="text-xs text-gray-500">{stat.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TABS.filter(t => t.key !== 'overview').map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="p-3 rounded-lg bg-blue-50">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{tab.label}</p>
                    <p className="text-sm text-gray-500">
                      {tab.key === 'prescriptions' && 'Process doctor prescriptions and dispense medications'}
                      {tab.key === 'billing' && 'Process payments for pharmacy invoices'}
                      {tab.key === 'walkin' && 'Sell medications to walk-in customers'}
                      {tab.key === 'inventory' && 'Manage medication stock levels'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'prescriptions' && <PrescriptionQueue />}
      {activeTab === 'billing' && <PharmacyInvoices />}
      {activeTab === 'walkin' && <WalkInSales />}
      {activeTab === 'inventory' && <Inventory />}
    </div>
  );
};

export default PharmacyDashboard;