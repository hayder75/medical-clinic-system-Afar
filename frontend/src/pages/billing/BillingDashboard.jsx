import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import BillingQueue from "../../components/billing/BillingQueue";
import PreRegistration from "../../pages/reception/PreRegistration";
import ReceptionPatientRegistration from "../../pages/reception/ReceptionPatientRegistration";
import PatientManagement from "../../pages/reception/PatientManagement";
import ReceptionAppointments from "../../pages/reception/ReceptionAppointments";
import ReceptionDoctorQueueManagement from "../../pages/reception/DoctorQueueManagement";
import PatientGallery from "../../pages/shared/PatientGallery";
import LoanDisbursement from "../../components/billing/LoanDisbursement";
import AdvanceDeposits from "../../components/billing/AdvanceDeposits";
import CreditAccounts from "../../components/billing/CreditAccounts";
import BillingPatientHistory from "../../components/billing/BillingPatientHistory";
import BillingWalkInOrders from "../../components/billing/BillingWalkInOrders";
import PatientAccounts from "../../components/admin/PatientAccounts";
import {
  CreditCard,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  PhoneCall,
  TrendingUp,
  Calendar,
  RefreshCw,
  Wallet,
  Stethoscope,
  Image as ImageIcon,
  Printer,
  TestTube,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

const BillingDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    pendingBillings: 0,
    pendingAmount: 0,
    byType: {
      CASH: { count: 0, amount: 0 },
      BANK: { count: 0, amount: 0 },
      INSURANCE: { count: 0, amount: 0 },
      CHARITY: { count: 0, amount: 0 },
    },
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [bankSummary, setBankSummary] = useState({ summary: null, banks: [] });

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedPeriod]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/billing/dashboard-stats?period=${selectedPeriod}`,
      );
      const data = response.data;

      setStats(data.stats);
      setRecentTransactions(data.recentTransactions);
      setDateRange(data.dateRange);

      const bankStart = data?.dateRange?.start
        ? new Date(data.dateRange.start).toISOString().split('T')[0]
        : undefined;
      const bankEnd = data?.dateRange?.end
        ? new Date(data.dateRange.end).toISOString().split('T')[0]
        : undefined;

      const bankResponse = await api.get(
        `/billing/reports/bank-method-summary${bankStart && bankEnd ? `?startDate=${bankStart}&endDate=${bankEnd}` : ''}`,
      );
      setBankSummary({
        summary: bankResponse.data?.summary || null,
        banks: bankResponse.data?.banks || [],
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      toast.error("Failed to fetch dashboard statistics");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `ETB ${(amount || 0).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getPaymentTypeColor = (type) => {
    switch (type) {
      case "CASH":
        return "bg-green-100 text-green-700";
      case "BANK":
        return "bg-blue-100 text-blue-700";
      case "INSURANCE":
        return "bg-purple-100 text-purple-700";
      case "CHARITY":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPaymentTypeIcon = (type) => {
    switch (type) {
      case "CASH":
        return "💰";
      case "BANK":
        return "🏦";
      case "INSURANCE":
        return "🛡️";
      case "CHARITY":
        return "❤️";
      default:
        return "💳";
    }
  };

  const periodOptions = [
    { value: "daily", label: "Today" },
    { value: "weekly", label: "This Week" },
    { value: "monthly", label: "This Month" },
    { value: "yearly", label: "This Year" },
  ];

  const statCards = [
    {
      title: "Total Collected",
      value: formatCurrency(stats.totalCollected || stats.totalAmount),
      icon: DollarSign,
      color: "bg-green-500",
      description: `${stats.totalCount} payments ${selectedPeriod === "daily" ? "today" : `this ${selectedPeriod.slice(0, -2)}`}`,
    },
    {
      title: "Pending Billings",
      value: stats.pendingBillings,
      icon: Clock,
      color: "bg-yellow-500",
      description: "Unpaid invoices",
    },
    {
      title: "Pending Amount",
      value: formatCurrency(stats.pendingAmount),
      icon: AlertTriangle,
      color: "bg-red-500",
      description: "Outstanding amount",
    },
    {
      title: "Cash Payments",
      value: formatCurrency(stats.byType.CASH.amount),
      icon: CheckCircle,
      color: "bg-blue-500",
      description: `${stats.byType.CASH.count} transactions`,
    },
  ];

  const DashboardOverview = () => (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Billing Dashboard
          </h2>
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">
              {dateRange.start &&
                dateRange.end &&
                `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={fetchDashboardStats}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  {stat.title}
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500">{stat.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
            Payment Breakdown
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.byType).map(([type, data]) => (
              <div
                key={type}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">
                    {getPaymentTypeIcon(type)}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{type}</p>
                    <p className="text-sm text-gray-500">
                      {data.count} transactions
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(data.amount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.totalAmount > 0
                      ? `${((data.amount / stats.totalAmount) * 100).toFixed(1)}%`
                      : "0%"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-green-500" />
            Recent Transactions
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100"
                >
                  <div className="flex items-center">
                    <span className="text-lg mr-3">
                      {getPaymentTypeIcon(transaction.type)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {transaction.patientName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {transaction.type}
                        {transaction.bankName && ` • ${transaction.bankName}`}
                        {transaction.insuranceName &&
                          ` • ${transaction.insuranceName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(transaction.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No transactions found</p>
                <p className="text-xs">
                  Payments will appear here as they are processed
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Wallet className="h-5 w-5 mr-2 text-indigo-500" />
          Bank-Wise Collection
        </h3>
        {bankSummary.summary ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              {bankSummary.summary.totalBankTransactions} bank transactions, total {formatCurrency(bankSummary.summary.totalBankAmount || 0)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {bankSummary.banks.map((bank) => (
                <div key={bank.bankName} className="p-3 border rounded-lg bg-gray-50">
                  <div className="font-medium text-gray-900 text-sm">{bank.bankName}</div>
                  <div className="text-xs text-gray-500 mt-1">{bank.transactions} transactions</div>
                  <div className="text-sm font-semibold text-gray-900 mt-1">{formatCurrency(bank.amount || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No bank transactions in selected period.</div>
        )}
      </div>

      {/* Quick Actions - All Reception Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div
          onClick={() => navigate("/billing/queue")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-blue-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Billing Queue
          </h3>
          <p className="text-sm text-gray-600">
            Process payments and handle pending billings
          </p>
        </div>

        <div
          onClick={() => navigate("/billing/register")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-green-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Patient Registration
          </h3>
          <p className="text-sm text-gray-600">
            Register new patients or create visits for existing patients
          </p>
        </div>

        <div
          onClick={() => navigate("/billing/patients")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-purple-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Patient Management
          </h3>
          <p className="text-sm text-gray-600">
            Manage patient card status, activation, and billing
          </p>
        </div>

        <div
          onClick={() => navigate("/billing/appointments")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-orange-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Appointments
          </h3>
          <p className="text-sm text-gray-600">
            View all appointments and send patients to doctor queue
          </p>
        </div>

        <div
          onClick={() => navigate("/billing/pre-registration")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-red-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <PhoneCall className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Pre-Registration
          </h3>
          <p className="text-sm text-gray-600">
            Handle phone call registrations and appointments
          </p>
        </div>

        <div
          onClick={() => navigate("/doctor-queue")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-indigo-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Doctor Queue Management
          </h3>
          <p className="text-sm text-gray-600">
            Monitor doctor availability and patient assignments
          </p>
        </div>

        <div
          onClick={() => navigate("/billing/gallery")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-pink-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Patient Gallery
          </h3>
          <p className="text-sm text-gray-600">
            Upload and manage patient before/after images
          </p>
        </div>

        <div
          onClick={() => navigate("/billing/advance-deposits")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-teal-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Advance Deposits
          </h3>
          <p className="text-sm text-gray-600">
            Accept deposits from advance users
          </p>
        </div>

        <div
          onClick={() => navigate("/billing/credit-accounts")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-blue-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Credit / Installments
          </h3>
          <p className="text-sm text-gray-600">
            Manage credit agreements and collect installments
          </p>
        </div>

        <div
          onClick={() => navigate("/billing/prints")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-indigo-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <Printer className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Prints</h3>
          <p className="text-sm text-gray-600">
            Print lab results, radiology reports, and prescriptions
          </p>
        </div>

        <div
          onClick={() => navigate("/billing/walk-in-orders")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-cyan-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <TestTube className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Walk-In Lab/Radiology
          </h3>
          <p className="text-sm text-gray-600">
            Create walk-in lab and radiology orders for patients
          </p>
        </div>

        <div
          onClick={() => navigate("/emergency-billing")}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
        >
          <div className="bg-red-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Emergency Billing
          </h3>
          <p className="text-sm text-gray-600">
            Manage emergency patients and their consolidated billing
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<DashboardOverview />} />
      <Route path="/queue" element={<BillingQueue />} />
      <Route path="/register" element={<ReceptionPatientRegistration />} />
      <Route path="/patients" element={<PatientManagement />} />
      <Route path="/appointments" element={<ReceptionAppointments />} />
      <Route path="/pre-registration" element={<PreRegistration />} />
      <Route
        path="/doctor-queue"
        element={<ReceptionDoctorQueueManagement />}
      />
      <Route path="/gallery" element={<PatientGallery />} />
      <Route path="/loan-disbursement" element={<LoanDisbursement />} />
      <Route path="/advance-deposits" element={<AdvanceDeposits />} />
      <Route path="/credit-accounts" element={<CreditAccounts />} />
      <Route path="/prints" element={<BillingPatientHistory />} />
      <Route path="/walk-in-orders" element={<BillingWalkInOrders />} />
      <Route path="/patient-accounts" element={<PatientAccounts />} />
    </Routes>
  );
};

export default BillingDashboard;
