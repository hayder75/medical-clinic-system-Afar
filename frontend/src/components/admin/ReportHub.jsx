import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, Stethoscope, DollarSign, TestTube, UserCheck, Pill, Activity, ChevronRight, Calendar, FileText, TrendingUp, CreditCard } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const categories = [
  {
    id: 'medical-clinic',
    title: 'Medical Clinic',
    icon: Activity,
    color: 'bg-blue-500',
    description: 'Patient records, disease reports, and clinical data',
    reports: [
      { title: 'Central Register', path: '/admin/central-register', desc: 'Patient registration records with disability & payment summaries' },
      { title: 'Disease Tally Sheet', path: '/admin/disease-tally', desc: 'Diseases categorized by age group and sex' },
      { title: 'Disease Reports', path: '/admin/disease-reports', desc: 'Summary and detailed case reports' },
      { title: 'Age-Gender Distribution', path: '/admin/age-gender-disease-distribution', desc: 'Disease distribution by demographics' },
      { title: 'Disease Management', path: '/admin/disease-management', desc: 'Manage disease registry' },
    ]
  },
  {
    id: 'doctor',
    title: 'Doctor Performance',
    icon: Stethoscope,
    color: 'bg-green-500',
    description: 'Doctor activity, revenue, and patient metrics',
    reports: [
      { title: 'Doctor Performance Report', path: '/admin/doctor-performance', desc: 'Per-doctor revenue, patients, procedures, and orders' },
      { title: 'Abortion Care Register', path: '/doctor/abortion-care', desc: 'Comprehensive abortion care service records' },
    ]
  },
  {
    id: 'billing',
    title: 'Billing & Revenue',
    icon: DollarSign,
    color: 'bg-yellow-500',
    description: 'Financial analytics, revenue reports, and billing performance',
    reports: [
      { title: 'Revenue Analytics', path: '/admin/financial-reports', desc: 'Full financial reports with daily/monthly breakdowns' },
      { title: 'Patient Accounts', path: '/admin/patient-accounts', desc: 'Credit accounts and payment tracking' },
      { title: 'Billing Performance', path: '/admin/financial-reports', desc: 'Per-user billing officer performance' },
    ]
  },
  {
    id: 'lab',
    title: 'Lab Reports',
    icon: TestTube,
    color: 'bg-purple-500',
    description: 'Laboratory test statistics and technician performance',
    reports: [
      { title: 'Lab Reports Dashboard', path: '/admin/lab-reports', desc: 'Test statistics, category breakdowns, technician data' },
    ]
  },
  {
    id: 'nurse',
    title: 'Nurse',
    icon: UserCheck,
    color: 'bg-pink-500',
    description: 'Nurse performance and family planning services',
    reports: [
      { title: 'Nurse Performance Report', path: '/admin/nurse-performance', desc: 'Per-nurse triages, services, and revenue' },
      { title: 'Family Planning Register', path: '/nurse/family-planning', desc: 'Family planning service records' },
    ]
  },
  {
    id: 'pharmacy',
    title: 'Pharmacy',
    icon: Pill,
    color: 'bg-red-500',
    description: 'Pharmacy revenue and medication dispensing',
    reports: [
      { title: 'Pharmacy Revenue', path: '/admin/financial-reports', desc: 'Pharmacy financial data and prescription stats' },
    ]
  }
];

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
    <div className={`p-2.5 rounded-lg ${color}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value ?? '-'}</p>
    </div>
  </div>
);

const ReportHub = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('billing');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/dashboard-stats');
        setStats(res.data);
      } catch (e) {
        console.error('Failed to load stats:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const categoryStats = {
    'medical-clinic': [
      { icon: Users, label: 'Total Patients', value: stats?.totalPatients, color: 'bg-blue-500' },
      { icon: Activity, label: 'Active Visits', value: stats?.activeVisits ?? '-', color: 'bg-teal-500' },
    ],
    'doctor': [
      { icon: Stethoscope, label: 'Active Doctors', value: stats?.totalDoctors, color: 'bg-green-500' },
    ],
    'billing': [
      { icon: DollarSign, label: 'Pending Billings', value: stats?.pendingBillings, color: 'bg-yellow-500' },
      { icon: TrendingUp, label: 'Total Revenue', value: stats?.totalRevenue ? `${Number(stats.totalRevenue).toLocaleString()} ETB` : '-', color: 'bg-green-500' },
      { icon: CreditCard, label: 'Bed Occupancy', value: stats?.totalBeds > 0 ? `${Math.round((stats.occupiedBeds / stats.totalBeds) * 100)}%` : '-', color: 'bg-indigo-500' },
    ],
    'lab': [
      { icon: TestTube, label: 'Pending Lab Orders', value: stats?.pendingLabOrders, color: 'bg-purple-500' },
      { icon: TestTube, label: 'Pending Radiology', value: stats?.pendingRadiologyOrders, color: 'bg-pink-500' },
    ],
    'nurse': [
      { icon: UserCheck, label: 'Active Nurses', value: stats?.totalNurses, color: 'bg-pink-500' },
    ],
    'pharmacy': [
      { icon: Pill, label: 'Pharmacy Queue', value: stats?.pharmacyQueue, color: 'bg-red-500' },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-100 rounded-lg">
          <BarChart3 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">View and manage all hospital reports</p>
        </div>
      </div>

      {/* Category Navigation */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-gray-900 text-white shadow-lg'
                : 'bg-white text-gray-700 border hover:bg-gray-50 shadow-sm'
            }`}
          >
            <cat.icon className={`h-4 w-4 ${activeCategory === cat.id ? 'text-white' : `text-${cat.color.replace('bg-', '')}`}`} />
            {cat.title}
          </button>
        ))}
      </div>

      {/* Active Category - Stats + Reports */}
      {categories.filter(c => c.id === activeCategory).map(cat => (
        <div key={cat.id} className="space-y-4">
          {/* Category header */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${cat.color}`}>
                <cat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{cat.title}</h2>
                <p className="text-sm text-gray-500">{cat.description}</p>
              </div>
            </div>
            {categoryStats[cat.id] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryStats[cat.id].map((s, i) => (
                  <StatCard key={i} {...s} />
                ))}
              </div>
            )}
          </div>

          {/* Report Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.reports.map((report, idx) => (
              <button
                key={idx}
                onClick={() => navigate(report.path)}
                className="bg-white rounded-xl shadow-sm border p-5 text-left hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {report.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{report.desc}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReportHub;
