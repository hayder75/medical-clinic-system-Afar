import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { BarChart3, DollarSign, Users, Activity, Stethoscope, Pill } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="card p-6 flex items-center gap-4">
    <div className={`p-3 rounded-full ${color}`}>
      <Icon className="h-6 w-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

const ReportDashboard = () => {
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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading report data...</div>;

  return (
    <div className="max-w-full mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-blue-600" /> Report Dashboard
      </h1>
      <p className="text-sm text-gray-400 mb-6">* All figures are adjusted for reporting purposes</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Patients" value={stats?.totalPatients ?? '-'} color="bg-blue-500" />
        <StatCard icon={Activity} label="Active Visits" value={stats?.activeVisits ?? '-'} color="bg-green-500" />
        <StatCard icon={DollarSign} label="Total Revenue" value={stats?.totalRevenue ? `${Number(stats.totalRevenue).toLocaleString()}` : '-'} color="bg-yellow-500" />
        <StatCard icon={Stethoscope} label="Doctor Encounters" value={stats?.totalDoctorEncounters ?? '-'} color="bg-purple-500" />
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Available Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a href="/admin/central-register" className="p-4 border rounded-lg hover:bg-blue-50 transition">
            <h3 className="font-medium">Central Register</h3>
            <p className="text-sm text-gray-500">Patient registration records</p>
          </a>
          <a href="/admin/disease-tally" className="p-4 border rounded-lg hover:bg-green-50 transition">
            <h3 className="font-medium">Disease Tally Sheet</h3>
            <p className="text-sm text-gray-500">Diseases by age and sex</p>
          </a>
          <a href="/admin/disease-reports" className="p-4 border rounded-lg hover:bg-purple-50 transition">
            <h3 className="font-medium">Disease Reports</h3>
            <p className="text-sm text-gray-500">Summary and detailed case reports</p>
          </a>
          <a href="/admin/age-gender-disease-distribution" className="p-4 border rounded-lg hover:bg-orange-50 transition">
            <h3 className="font-medium">Age-Gender Distribution</h3>
            <p className="text-sm text-gray-500">Disease distribution by demographics</p>
          </a>
          <a href="/admin/lab-reports" className="p-4 border rounded-lg hover:bg-pink-50 transition">
            <h3 className="font-medium">Lab Reports</h3>
            <p className="text-sm text-gray-500">Laboratory test statistics</p>
          </a>
          <a href="/nurse/family-planning" className="p-4 border rounded-lg hover:bg-teal-50 transition">
            <h3 className="font-medium">Family Planning Register</h3>
            <p className="text-sm text-gray-500">Family planning service records</p>
          </a>
          <a href="/doctor/abortion-care" className="p-4 border rounded-lg hover:bg-red-50 transition">
            <h3 className="font-medium">Abortion Care Register</h3>
            <p className="text-sm text-gray-500">Abortion care service records</p>
          </a>
        </div>
      </div>
    </div>
  );
};

export default ReportDashboard;
