import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Search,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Printer,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { formatMedicationName } from "../../utils/medicalStandards";
import BankMethodSelect from "../common/BankMethodSelect";
import useSocket from "../../hooks/useSocket";

const BillingQueue = () => {
  const [billings, setBillings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [insurances, setInsurances] = useState([]);
  const [oldPatientModeEnabled, setOldPatientModeEnabled] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useSocket({
    onVisitUpdate: () => setRefreshKey(k => k + 1),
    onNewVisit: () => setRefreshKey(k => k + 1),
  });

  // Clean payment form state
  const [paymentForm, setPaymentForm] = useState({
    type: "CASH",
    amount: "",
    bankName: "",
    transNumber: "",
    insuranceId: "",
    notes: "",
    isEmergency: false,
    useAccount: false,
    paymentProofPath: "",
    waiveRegistrationForOldPatient: false,
  });

  // Patient account balance
  const [patientAccount, setPatientAccount] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  // Form validation errors
  const [formErrors, setFormErrors] = useState({});

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchBillings = React.useCallback(async () => {
    try {
      setLoading(true);
      const effectiveLimit = statusFilter === "PAID" ? 500 : pagination.limit;
      const response = await api.get("/billing", {
        params: {
          page: pagination.currentPage,
          limit: effectiveLimit,
          status: statusFilter,
          search: debouncedSearchTerm,
        },
      });
      setBillings(response.data.billings || []);
      if (response.data.pagination) {
        setPagination((prev) => ({
          ...prev,
          totalPages: response.data.pagination.totalPages,
          totalCount: response.data.pagination.totalCount,
        }));
      }
    } catch (error) {
      toast.error("Failed to fetch billings");
      console.error("Error fetching billings:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.limit, statusFilter, debouncedSearchTerm]);

  const fetchInsurances = React.useCallback(async () => {
    try {
      const response = await api.get("/billing/insurances");
      setInsurances(response.data.insurances || []);
    } catch (error) {
      console.error("Error fetching insurances:", error);
    }
  }, []);

  const fetchOldPatientRegistrationMode = React.useCallback(async () => {
    try {
      const response = await api.get("/billing/settings/old-patient-registration-mode");
      setOldPatientModeEnabled(Boolean(response.data?.enabled));
    } catch (error) {
      console.error("Error fetching old patient registration mode:", error);
      setOldPatientModeEnabled(false);
    }
  }, []);

  useEffect(() => {
    fetchBillings();
    fetchInsurances();
    fetchOldPatientRegistrationMode();
  }, [fetchBillings, fetchInsurances, fetchOldPatientRegistrationMode, refreshKey]);

  const isRegistrationBilling = (billing) =>
    Boolean(
      billing?.services?.some((service) =>
        String(service?.service?.code || "").toUpperCase().startsWith("CARD-REG"),
      ),
    );

  const canWaiveRegistration =
    oldPatientModeEnabled &&
    selectedBilling &&
    isRegistrationBilling(selectedBilling) &&
    Number(selectedBilling.paidAmount || 0) === 0;

  const handleDeleteService = async (billingId, serviceId, serviceName) => {
    if (
      !window.confirm(
        `Are you sure you want to remove "${serviceName}" from this billing? This will also cancel the corresponding order on the doctor's side.`,
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/billing/service/${billingId}/${serviceId}`);
      toast.success(
        `Service "${serviceName}" removed and synced with doctor side.`,
      );
      await fetchBillings();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error(error.response?.data?.error || "Failed to remove service");
    } finally {
      setLoading(false);
    }
  };

  // Removed filterBillings state-setter function logic here as it's now a useMemo hook

  // Clean validation function
  const validatePaymentForm = () => {
    const errors = {};
    const numericAmount = Number(paymentForm.amount);
    const isWaiverPayment = canWaiveRegistration && paymentForm.waiveRegistrationForOldPatient;

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      errors.amount = "Amount must be zero or a positive number";
    }

    if (isWaiverPayment && numericAmount !== 0) {
      errors.amount = "Waived registration payment amount must be 0";
    }

    if (paymentForm.type === "INSURANCE" && !paymentForm.insuranceId) {
      errors.insuranceId = "Please select an insurance provider";
    }

    if (paymentForm.type === "BANK") {
      if (!paymentForm.bankName.trim()) {
        errors.bankName = "Bank name is required for bank transfers";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePayment = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setFormErrors({});

    // Validate form
    if (!validatePaymentForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    try {
      const submittedAmount = Number(paymentForm.amount);

      // Prepare payment data
      const paymentData = {
        billingId: selectedBilling.id,
        amount: submittedAmount,
        type: paymentForm.type,
        bankName: paymentForm.bankName || null,
        transNumber: paymentForm.transNumber || null,
        insuranceId: paymentForm.insuranceId || null,
        notes: paymentForm.notes || null,
        isEmergency: paymentForm.isEmergency,
        useAccount: paymentForm.useAccount,
        convertToDebt: paymentForm.convertToDebt || false,
        paymentProofPath: paymentForm.paymentProofPath || null,
        waiveRegistrationForOldPatient:
          canWaiveRegistration && paymentForm.waiveRegistrationForOldPatient,
      };

      await api.post("/billing/payments", paymentData);

      const remaining = (selectedBilling.totalAmount - (selectedBilling.paidAmount || 0)) - submittedAmount;
      if (paymentForm.convertToDebt && remaining > 0) {
        toast.success(`Payment processed! ETB ${remaining.toLocaleString()} added to patient's credit account as debt.`);
      } else {
        toast.success("Payment processed successfully!");
      }
      setShowPaymentForm(false);
      setSelectedBilling(null);
      resetPaymentForm();
      fetchBillings();
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error.response?.data?.error || "Payment failed");
    }
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      type: "CASH",
      amount: "",
      bankName: "",
      transNumber: "",
      insuranceId: "",
      notes: "",
      isEmergency: false,
      useAccount: false,
      convertToDebt: false,
      paymentProofPath: "",
      waiveRegistrationForOldPatient: false,
    });
    setFormErrors({});
  };

  const openPaymentForm = async (billing) => {
    setSelectedBilling(billing);

    // Fetch patient account if exists
    try {
      const response = await api.get(`/accounts/patient/${billing.patientId}`);
      if (response.data && response.data.account) {
        setPatientAccount(response.data.account);
      } else {
        setPatientAccount(null);
      }
    } catch (error) {
      setPatientAccount(null);
    }

    // For deferred billings, pre-set the convertToDebt flag and allow partial payment
    const isDeferred = billing.isDeferred || false;
    const remainingBalance = billing.totalAmount - (billing.paidAmount || 0);

    setPaymentForm({
      type: "CASH",
      amount: isDeferred ? "" : remainingBalance.toString(),
      bankName: "",
      transNumber: "",
      insuranceId: "",
      notes: isDeferred ? "Partial payment - remaining added to credit" : "",
      isEmergency: false,
      useAccount: false,
      convertToDebt: isDeferred,
      paymentProofPath: "",
      waiveRegistrationForOldPatient: false,
    });
    setFormErrors({});
    setShowPaymentForm(true);
  };

  const handleOldPatientWaiverToggle = () => {
    setPaymentForm((prev) => {
      const nextChecked = !prev.waiveRegistrationForOldPatient;
      const remainingBalance = Math.max(
        0,
        (selectedBilling?.totalAmount || 0) - (selectedBilling?.paidAmount || 0),
      );

      return {
        ...prev,
        waiveRegistrationForOldPatient: nextChecked,
        amount: nextChecked ? "0" : remainingBalance.toString(),
        useAccount: nextChecked ? false : prev.useAccount,
        convertToDebt: nextChecked ? false : prev.convertToDebt,
      };
    });
  };

  const [showDeleteBillingModal, setShowDeleteBillingModal] = useState(null);
  const [deleteBillingLoading, setDeleteBillingLoading] = useState(false);

  const handlePaymentProofUpload = async (file) => {
    if (!file) return;

    try {
      setUploadingProof(true);
      const formData = new FormData();
      formData.append("paymentProof", file);

      const response = await api.post("/billing/payments/upload-proof", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPaymentForm((prev) => ({
        ...prev,
        paymentProofPath: response.data?.file?.path || "",
      }));
      toast.success("Payment proof uploaded");
    } catch (error) {
      console.error("Error uploading payment proof:", error);
      toast.error(error.response?.data?.error || "Failed to upload payment proof");
    } finally {
      setUploadingProof(false);
    }
  };

  const deleteBilling = async (billingId) => {
    try {
      setDeleteBillingLoading(true);
      await api.delete(`/billing/${billingId}`);

      toast.success("Billing deleted successfully");
      setShowDeleteBillingModal(null);
      fetchBillings(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete billing");
      console.error("Delete billing error:", error);
    } finally {
      setDeleteBillingLoading(false);
    }
  };

  const deleteVisit = async (billing) => {
    if (!billing.visitId) {
      toast.error("No visit found for this billing");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete this visit?\n\n` +
      `Patient: ${billing.patient?.name || 'Unknown'}\n` +
      `Visit ID: ${billing.visitId}\n\n` +
      `This will permanently delete the visit and all associated data. ` +
      `You can then create a new visit for this patient.`,
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      await api.delete(`/billing/visit/${billing.visitId}`);

      toast.success(
        "Visit deleted successfully. You can now create a new visit for this patient.",
      );
      fetchBillings(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete visit");
      console.error("Delete visit error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBilling = (billing) => {
    const printWindow = window.open("", "_blank");
    const patientName =
      billing.patient?.name?.toUpperCase() || "UNKNOWN PATIENT";
    const patientId = billing.patient?.id || "N/A";
    const billingId = billing.id?.substring(0, 8);
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const currentTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const isEmergency =
      billing.status === "EMERGENCY_PENDING" || billing.isEmergency;

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Service Receipt - ${patientName}</title>
          <style>
            @media print {
              @page { size: A6; margin: 0; }
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
              .receipt-container { width: 105mm; height: 148mm; margin: 0; padding: 8mm; border: none; box-shadow: none; }
            }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.3; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; }
            .no-print { text-align: center; padding: 10px; background: #fff; margin-bottom: 20px; border-radius: 8px; width: 100%; max-width: 400px; }
            .no-print button { background: #2563eb; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
            .receipt-container { width: 105mm; min-height: 148mm; background: white; padding: 8mm; box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative; box-sizing: border-box; border-radius: 4px; }
            .header { text-align: center; border-bottom: 2px solid ${isEmergency ? "#ef4444" : "#2563eb"}; padding-bottom: 8px; margin-bottom: 12px; }
            .clinic-name { font-size: 18px; font-weight: 800; margin: 0; color: ${isEmergency ? "#991b1b" : "#1e40af"}; }
            .receipt-title { font-size: 14px; font-weight: 700; margin: 4px 0; text-transform: uppercase; color: #1e293b; }
            .patient-section { margin-bottom: 10px; padding: 6px; background: ${isEmergency ? "#fef2f2" : "#f8fafc"}; border: 1px solid ${isEmergency ? "#fee2e2" : "#e2e8f0"}; border-radius: 4px; font-size: 11px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
            .info-label { font-weight: 700; color: #64748b; }
            .items-section { margin: 10px 0; }
            .item-row { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
            .item-name { font-weight: 600; flex: 1; }
            .item-qty { width: 40px; text-align: center; }
            .item-price { width: 80px; text-align: right; }
            .total-section { margin-top: 15px; border-top: 2px solid ${isEmergency ? "#ef4444" : "#2563eb"}; padding-top: 8px; }
            .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: ${isEmergency ? "#991b1b" : "#1e3a8a"}; }
            .footer { margin-top: auto; padding-top: 12px; text-align: center; font-size: 9px; color: #64748b; }
            .status-stamp { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 40px; font-weight: 900; color: rgba(34, 197, 94, 0.15); border: 4px solid rgba(34, 197, 94, 0.15); padding: 10px 20px; border-radius: 12px; text-transform: uppercase; pointer-events: none; }
            .emergency-label { color: #ef4444; font-weight: 800; font-size: 10px; margin-bottom: 4px; display: block; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()">Print Receipt</button></div>
          <div class="receipt-container">
            ${billing.status === "PAID" ? `<div class="status-stamp">PAID</div>` : ""}
            <div class="header">
              <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
              <h2 class="receipt-title">Service Receipt</h2>
              <div style="font-size: 9px; color: #64748b;">${currentDate} ${currentTime}</div>
            </div>
            
            <div class="patient-section">
              ${isEmergency ? '<span class="emergency-label">*** EMERGENCY SERVICE ***</span>' : ""}
              <div class="info-grid">
                <div><span class="info-label">Patient:</span> ${patientName}</div>
                <div><span class="info-label">ID:</span> #${patientId}</div>
                <div><span class="info-label">Billing:</span> #${billingId}</div>
                <div><span class="info-label">Status:</span> ${billing.status.replace(/_/g, " ")}</div>
              </div>
            </div>

            <div class="items-section">
              <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 10px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                <span style="flex: 1;">Service Description</span>
                <span style="width: 40px; text-align: center;">Qty</span>
                <span style="width: 80px; text-align: right;">Amount</span>
              </div>
              ${(billing.services || [])
        .map((service) => {
          const quantity = service.quantity || 1;
          const totalPrice =
            service.totalPrice || (service.unitPrice || 0) * quantity;
          const serviceName = service.service?.name || "Service";
          const cleanName = formatMedicationName(serviceName);
          return `
                  <div class="item-row">
                    <span class="item-name">${cleanName}</span>
                    <span class="item-qty">${quantity}</span>
                    <span class="item-price">${totalPrice.toLocaleString()}</span>
                  </div>
                `;
        })
        .join("")}
            </div>

            <div class="total-section">
              <div class="total-row">
                <span>TOTAL AMOUNT</span>
                <span>ETB ${(billing.totalAmount || 0).toLocaleString()}</span>
              </div>
            </div>

            <div class="footer">
              Thank you for choosing ${window.__CS__?.name || 'Clinic'}<br>
              ${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "badge-warning";
      case "PAID":
        return "badge-success";
      case "PENDING_INSURANCE":
        return "badge-info";
      case "EMERGENCY_PENDING":
        return "badge-danger";
      case "PARTIALLY_PAID":
        return "badge-info";
      case "DEFERRED":
        return "bg-orange-100 text-orange-800";
      default:
        return "badge-gray";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-4 w-4" />;
      case "PAID":
        return <CheckCircle className="h-4 w-4" />;
      case "PARTIALLY_PAID":
        return <DollarSign className="h-4 w-4" />;
      case "PENDING_INSURANCE":
        return <AlertTriangle className="h-4 w-4" />;
      case "EMERGENCY_PENDING":
        return <AlertTriangle className="h-4 w-4" />;
      case "DEFERRED":
        return <Clock className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing Queue</h2>
          <p className="text-gray-600">Process payments and manage billing</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            {pagination.totalCount} total records
          </div>
          <button
            onClick={() => {
              setPagination((prev) => ({ ...prev, currentPage: 1 }));
              fetchBillings();
            }}
            disabled={loading}
            className="btn btn-outline btn-sm flex items-center gap-2"
            title="Refresh billing queue"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name, ID, or phone number..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, currentPage: 1 }));
              }}
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="EMERGENCY_PENDING">Emergency Pending</option>
              <option value="DEFERRED">Deferred (Pay in Period)</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="PENDING_INSURANCE">Pending Insurance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Billings List */}
      <div className="space-y-4">
        {billings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No billings found matching your criteria</p>
          </div>
        ) : (
          billings.map((billing) => (
            <div key={billing.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">
                      {billing.patient?.name || 'Unknown Patient'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      ID: {billing.patient?.id || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`badge ${getStatusColor(billing.status)} flex items-center`}
                  >
                    {getStatusIcon(billing.status)}
                    <span className="ml-1">
                      {billing.status.replace(/_/g, " ")}
                    </span>
                  </span>
                  {billing.isDeferred && (
                    billing.notes?.includes('DEFERRED_CONNECTED') ? (
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 border border-green-300 rounded-full">
                        🔗 CONNECTED TO PREVIOUS PAYMENT
                      </span>
                    ) : (
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300 rounded-full">
                        ⏳ PAY IN PERIOD
                      </span>
                    )
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(billing.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Billing Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Billing ID</p>
                  <p className="font-mono text-sm">{billing.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ETB {(billing.totalAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Services</p>
                  <p className="text-sm text-gray-900">
                    {billing.services?.length || 0} service(s)
                  </p>
                </div>
              </div>

              {/* Services List */}
              {billing.services && billing.services.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Services
                  </h4>
                  {/* Show deferred connected info banner */}
                  {billing.isDeferred && billing.notes?.includes('DEFERRED_CONNECTED') && (
                    <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                      <strong>🔗 Follow-up Service:</strong> These services are connected to a previous payment/credit agreement.
                      No additional payment is required — the billing is already marked as PAID.
                      {billing.paidAmount > 0 && (
                        <span className="block mt-1 text-green-600 font-bold">
                          Covered amount: ETB {billing.paidAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="space-y-1">
                    {billing.services.map((service, index) => {
                      const quantity = service.quantity || 1;
                      const unitPrice = service.unitPrice || 0;
                      const totalPrice =
                        service.totalPrice || unitPrice * quantity;
                      const serviceName = service.service?.name || "Service";
                      const serviceCategory = service.service?.category || "";
                      const isDeferredConnected = billing.isDeferred && billing.notes?.includes('DEFERRED_CONNECTED');

                      const categoryDisplay = serviceCategory
                        ? serviceCategory.charAt(0) +
                        serviceCategory.slice(1).toLowerCase() +
                        ": "
                        : "";

                      return (
                        <div
                          key={index}
                          className={`flex justify-between items-center text-sm py-1 ${isDeferredConnected ? 'bg-green-50 rounded px-2' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            {billing.status === "PENDING" && (
                              <button
                                onClick={() =>
                                  handleDeleteService(
                                    billing.id,
                                    service.serviceId,
                                    serviceName,
                                  )
                                }
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 border border-red-200 hover:bg-red-200 hover:border-red-300 rounded-md shadow-sm transition-all mr-2"
                                title={`Remove ${serviceName}`}
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            )}
                            <span className={isDeferredConnected ? 'text-green-700' : 'text-gray-600'}>
                              {categoryDisplay}
                              {serviceName}
                              {quantity > 1 && (
                                <span className="text-gray-500 ml-1">
                                  (×{quantity})
                                </span>
                              )}
                              {isDeferredConnected && (
                                <span className="ml-2 text-[10px] font-bold bg-green-200 text-green-800 px-1.5 py-0.5 rounded">
                                  ✓ ALREADY PAID
                                </span>
                              )}
                            </span>
                          </div>
                          <span className={`font-medium ${isDeferredConnected ? 'text-green-600' : ''}`}>
                            {isDeferredConnected ? (
                              <span className="text-green-600">ETB {totalPrice.toLocaleString()} ✓</span>
                            ) : quantity > 1 ? (
                              <>
                                ETB {unitPrice.toLocaleString()} × {quantity} =
                                ETB {totalPrice.toLocaleString()}
                              </>
                            ) : (
                              <>ETB {totalPrice.toLocaleString()}</>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                {(billing.status === "PENDING" ||
                  billing.status === "PARTIALLY_PAID") && (
                    <button
                      onClick={() => openPaymentForm(billing)}
                      className="btn btn-primary btn-sm flex items-center"
                    >
                      <CreditCard className="h-4 w-4 mr-1" />
                      {billing.status === "PARTIALLY_PAID"
                        ? "Collect Balance"
                        : "Process Payment"}
                    </button>
                  )}
                {billing.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => setShowDeleteBillingModal(billing)}
                      className="btn btn-outline btn-sm flex items-center text-red-600 hover:bg-red-50 hover:border-red-300"
                      title="Delete this billing"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Billing
                    </button>
                    <button
                      onClick={() => deleteVisit(billing)}
                      className="btn btn-outline btn-sm flex items-center text-red-600 hover:bg-red-50 hover:border-red-300"
                      title="Delete visit to allow recreation"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Visit
                    </button>
                  </>
                )}
                <button
                  onClick={() => handlePrintBilling(billing)}
                  className="btn btn-outline btn-sm flex items-center ml-auto"
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </button>
              </div>

              {billing.status === "PAID" && (
                <div className="flex justify-end">
                  <button
                    onClick={() => handlePrintBilling(billing)}
                    className="btn btn-outline btn-sm flex items-center"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Print Receipt
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 rounded-lg border border-gray-200">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  currentPage: Math.max(1, prev.currentPage - 1),
                }))
              }
              disabled={pagination.currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  currentPage: Math.min(prev.totalPages, prev.currentPage + 1),
                }))
              }
              disabled={pagination.currentPage === pagination.totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{" "}
                <span className="font-medium">
                  {(pagination.currentPage - 1) * pagination.limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(
                    pagination.currentPage * pagination.limit,
                    pagination.totalCount,
                  )}
                </span>{" "}
                of <span className="font-medium">{pagination.totalCount}</span>{" "}
                results
              </p>
            </div>
            <div>
              <nav
                className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                aria-label="Pagination"
              >
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      currentPage: Math.max(1, prev.currentPage - 1),
                    }))
                  }
                  disabled={pagination.currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>

                {[...Array(pagination.totalPages)].map((_, i) => {
                  const page = i + 1;
                  // Only show 5 pages around current page
                  if (
                    page === 1 ||
                    page === pagination.totalPages ||
                    (page >= pagination.currentPage - 2 &&
                      page <= pagination.currentPage + 2)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            currentPage: page,
                          }))
                        }
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${pagination.currentPage === page
                          ? "z-10 bg-primary-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                          : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                          }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    (page === pagination.currentPage - 3 && page > 1) ||
                    (page === pagination.currentPage + 3 &&
                      page < pagination.totalPages)
                  ) {
                    return (
                      <span
                        key={page}
                        className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0"
                      >
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      currentPage: Math.min(
                        prev.totalPages,
                        prev.currentPage + 1,
                      ),
                    }))
                  }
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && selectedBilling && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-200 max-h-[92vh] flex flex-col">
            <div className="p-6 overflow-y-auto flex-1">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Process Payment - {selectedBilling.patient.name}
              </h3>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Total Amount:</strong> ETB{" "}
                  {selectedBilling.totalAmount.toLocaleString()}
                </p>
                {selectedBilling.paidAmount > 0 && (
                  <p className="text-sm text-gray-600">
                    <strong>Paid So Far:</strong> ETB{" "}
                    {selectedBilling.paidAmount.toLocaleString()}
                  </p>
                )}
                <p className="text-sm font-bold text-blue-600">
                  <strong>Remaining Balance:</strong> ETB{" "}
                  {(
                    selectedBilling.totalAmount -
                    (selectedBilling.paidAmount || 0)
                  ).toLocaleString()}
                </p>
                {selectedBilling.isDeferred && (
                  selectedBilling.notes?.includes('DEFERRED_CONNECTED') ? (
                    <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded text-green-800 text-xs font-bold">
                      🔗 CONNECTED TO PREVIOUS PAYMENT — No additional charge needed
                    </div>
                  ) : (
                    <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded text-orange-800 text-xs font-bold">
                      DEFERRED PAYMENT ORDER (Installment/Credit)
                    </div>
                  )
                )}
                {patientAccount && patientAccount.balance > 0 && (
                  <div
                    className={`mt-3 p-2 rounded ${['CREDIT', 'BOTH'].includes(patientAccount.accountType) ? "bg-blue-50 border border-blue-200" : "bg-green-50 border border-green-200"}`}
                  >
                    <p className="text-sm">
                      <strong>Account Balance:</strong> ETB{" "}
                      {patientAccount.balance.toLocaleString()}
                      {['CREDIT', 'BOTH'].includes(patientAccount.accountType) && (
                        <span className="text-blue-700 font-semibold">
                          {" "}
                          (Credit Available)
                        </span>
                      )}
                      {['ADVANCE', 'BOTH'].includes(patientAccount.accountType) && (
                        <span className="text-green-700 font-semibold">
                          {" "}
                          (Advance)
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {canWaiveRegistration && (
                  <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentForm.waiveRegistrationForOldPatient}
                        onChange={handleOldPatientWaiverToggle}
                        className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Make this registration free (old patient)
                        </p>
                        <p className="text-xs text-amber-800 mt-1">
                          Only use this for legacy patients who already paid registration before this system.
                          When checked, this card registration billing is waived at 0 ETB.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <form id="paymentForm" onSubmit={handlePayment} className="space-y-4">
                {/* Payment Method */}
                <div>
                  <label className="label">Payment Method *</label>
                  <select
                    className="input"
                    value={paymentForm.type}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, type: e.target.value })
                    }
                    required
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="INSURANCE">Insurance</option>
                    <option value="CHARITY">Charity</option>
                  </select>
                </div>

                {/* Use Account Balance Checkbox */}
                {patientAccount && patientAccount.balance > 0 && (
                  <div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentForm.useAccount}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            useAccount: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-sm">
                        Use patient account balance (ETB{" "}
                        {patientAccount.balance.toLocaleString()} available)
                      </span>
                    </label>
                  </div>
                )}

                {/* Amount - Read-only, exact amount from billing */}
                <div>
                  <label className="label">Amount to Pay (ETB) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={
                      selectedBilling.totalAmount -
                      (selectedBilling.paidAmount || 0)
                    }
                    className={`input ${formErrors.amount ? "border-red-500" : ""}`}
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: e.target.value })
                    }
                    disabled={paymentForm.waiveRegistrationForOldPatient}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the amount being paid now.
                  </p>
                  {formErrors.amount && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.amount}
                    </p>
                  )}
                </div>

                {/* Convert to Debt / Deferred Payment */}
                {(selectedBilling.isDeferred || paymentForm.convertToDebt) && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="convertToDebt"
                        checked={paymentForm.convertToDebt}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            convertToDebt: e.target.checked,
                          })
                        }
                        className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-orange-300 rounded"
                      />
                      <label
                        htmlFor="convertToDebt"
                        className="text-sm font-bold text-orange-800 cursor-pointer"
                      >
                        Convert remaining to patient debt (Credit)
                      </label>
                    </div>
                    <p className="text-xs text-orange-700 mt-2">
                      The unpaid balance will be automatically added to the
                      patient's credit account. They can pay it off whenever
                      they visit.
                    </p>
                    {paymentForm.convertToDebt &&
                      paymentForm.amount &&
                      Number(paymentForm.amount) > 0 && (
                        <div className="mt-3 p-2 bg-orange-100 rounded text-sm">
                          <div className="flex justify-between">
                            <span className="text-orange-800">Paying now:</span>
                            <span className="font-bold text-green-700">
                              ETB{" "}
                              {Number(paymentForm.amount).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-orange-800">
                              Added as debt:
                            </span>
                            <span className="font-bold text-red-600">
                              ETB{" "}
                              {Math.max(
                                0,
                                selectedBilling.totalAmount -
                                (selectedBilling.paidAmount || 0) -
                                Number(paymentForm.amount),
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* Show convert to debt option for non-deferred bills too */}
                {!selectedBilling.isDeferred && !paymentForm.convertToDebt && (
                  <div className="border-t pt-3">
                    <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-600 hover:text-orange-700">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            convertToDebt: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                      />
                      <span>
                        Patient can't pay full amount? Convert remaining to
                        credit/debt
                      </span>
                    </label>
                  </div>
                )}

                {/* Bank Transfer Fields */}
                {paymentForm.type === "BANK" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Bank Name *</label>
                      <BankMethodSelect
                        className={`input ${formErrors.bankName ? "border-red-500" : ""}`}
                        value={paymentForm.bankName}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            bankName: e.target.value,
                          })
                        }
                      />
                      {formErrors.bankName && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.bankName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">Transaction Number</label>
                      <input
                        type="text"
                        className={`input ${formErrors.transNumber ? "border-red-500" : ""}`}
                        value={paymentForm.transNumber}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            transNumber: e.target.value,
                          })
                        }
                        placeholder="Enter transaction number"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Optional reference number from the bank or wallet.
                      </p>
                      {formErrors.transNumber && (
                        <p className="text-red-500 text-sm mt-1">
                          {formErrors.transNumber}
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Payment Proof Screenshot (Optional)</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="input"
                        disabled={uploadingProof}
                        onChange={(e) => handlePaymentProofUpload(e.target.files?.[0])}
                      />
                      {uploadingProof && (
                        <p className="text-xs text-blue-600 mt-1">Uploading proof...</p>
                      )}
                      {paymentForm.paymentProofPath && (
                        <p className="text-xs text-green-700 mt-1">Proof attached: {paymentForm.paymentProofPath}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Insurance Selection */}
                {paymentForm.type === "INSURANCE" && (
                  <div>
                    <label className="label">Insurance Provider *</label>
                    <select
                      className={`input ${formErrors.insuranceId ? "border-red-500" : ""}`}
                      value={paymentForm.insuranceId}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          insuranceId: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Select Insurance Provider</option>
                      {insurances.map((insurance) => (
                        <option key={insurance.id} value={insurance.id}>
                          {insurance.name} ({insurance.code})
                        </option>
                      ))}
                    </select>
                    {formErrors.insuranceId && (
                      <p className="text-red-500 text-sm mt-1">
                        {formErrors.insuranceId}
                      </p>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="input"
                    rows="3"
                    value={paymentForm.notes}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, notes: e.target.value })
                    }
                    placeholder="Optional notes about the payment"
                  />
                </div>

                {/* Emergency Checkbox - Only show for emergency visits */}
                {selectedBilling?.visit?.isEmergency && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="emergency"
                        checked={paymentForm.isEmergency}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            isEmergency: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-red-300 rounded"
                      />
                      <label
                        htmlFor="emergency"
                        className="text-sm font-medium text-red-800"
                      >
                        Mark as Emergency Service
                      </label>
                    </div>
                    <p className="text-sm text-red-600 mt-2">
                      Check this box to copy this service to emergency billing
                      for later collection. This allows the patient to receive
                      services immediately while tracking the amount owed.
                    </p>
                  </div>
                )}

              </form>
            </div>
            {/* Sticky footer with action buttons */}
            <div className="shrink-0 border-t bg-white px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentForm(false);
                  setSelectedBilling(null);
                  resetPaymentForm();
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="paymentForm"
                className="btn btn-primary"
                disabled={loading}
              >
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Billing Confirmation Modal */}
      {showDeleteBillingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-10 w-10 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Billing
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  This action cannot be undone. The billing and all associated
                  services will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-sm font-medium text-red-800">
                Patient:{" "}
                <span className="font-bold">
                  {showDeleteBillingModal.patient.name}
                </span>
              </p>
              <p className="text-sm text-red-700 mt-2">
                Billing ID: {showDeleteBillingModal.id}
              </p>
              <p className="text-sm text-red-700 mt-1">
                Amount: ETB{" "}
                {showDeleteBillingModal.totalAmount.toLocaleString()}
              </p>
              <p className="text-sm text-red-700 mt-1">
                Services: {showDeleteBillingModal.services?.length || 0}{" "}
                service(s)
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteBillingModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                disabled={deleteBillingLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteBilling(showDeleteBillingModal.id)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                disabled={deleteBillingLoading}
              >
                {deleteBillingLoading ? "Deleting..." : "Delete Billing"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingQueue;
