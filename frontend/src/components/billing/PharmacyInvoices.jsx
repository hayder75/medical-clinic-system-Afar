import React, { useState, useEffect } from 'react';
import { Pill, CreditCard, Clock, CheckCircle, AlertTriangle, User, Printer } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatMedicationName } from '../../utils/medicalStandards';
import BankMethodSelect from '../common/BankMethodSelect';

const PharmacyInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('PENDING'); // Default to PENDING
  const [paymentData, setPaymentData] = useState({
    type: 'CASH',
    amount: '',
    bankName: '',
    transNumber: '',
    insuranceId: '',
    notes: ''
  });
  const [insuranceCompanies, setInsuranceCompanies] = useState([]);

  useEffect(() => {
    fetchInvoices();
    fetchInsuranceCompanies();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching pharmacy invoices...');
      const response = await api.get('/pharmacy-billing/invoices');
      console.log('✅ API Response:', response.data);
      console.log('📊 Invoices count:', response.data.invoices?.length || 0);
      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error('❌ Error fetching invoices:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      toast.error('Failed to fetch pharmacy invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsuranceCompanies = async () => {
    try {
      const response = await api.get('/pharmacy-billing/insurance');
      setInsuranceCompanies(response.data.insuranceCompanies || []);
    } catch (error) {
      console.error('Error fetching insurance companies:', error);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      const paymentPayload = {
        pharmacyInvoiceId: selectedInvoice.id,
        amount: parseFloat(paymentData.amount),
        type: paymentData.type
      };

      // Only include optional fields if they have values
      if (paymentData.bankName && paymentData.bankName.trim()) {
        paymentPayload.bankName = paymentData.bankName;
      }
      if (paymentData.transNumber && paymentData.transNumber.trim()) {
        paymentPayload.transNumber = paymentData.transNumber;
      }
      if (paymentData.notes && paymentData.notes.trim()) {
        paymentPayload.notes = paymentData.notes;
      }
      if (paymentData.insuranceId && paymentData.insuranceId.trim()) {
        paymentPayload.insuranceId = paymentData.insuranceId;
      }

      await api.post('/pharmacy-billing/payment', paymentPayload);

      toast.success('Payment processed successfully! Invoice moved to pharmacy queue.');
      setShowPaymentForm(false);
      setSelectedInvoice(null);
      setPaymentData({
        type: 'CASH',
        amount: '',
        bankName: '',
        transNumber: '',
        insuranceId: '',
        notes: ''
      });
      fetchInvoices();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Payment failed');
    }
  };

  const getCustomerLabel = (inv) => {
    if (inv.patient?.name) return { name: inv.patient.name, id: inv.patient.id };
    if (inv.notes?.startsWith('Walk-in:')) {
      const rest = inv.notes.replace('Walk-in:', '').trim();
      return { name: rest.split('(')[0].trim() || 'Walk-in Customer', id: 'Walk-in' };
    }
    return { name: 'Unknown Patient', id: 'N/A' };
  };

  const handlePrintInvoice = (invoice) => {
    const printWindow = window.open('', '_blank');
    const { name: patientName, id: patientId } = getCustomerLabel(invoice);
    const printPatientName = patientName.toUpperCase();
    const invoiceId = invoice.id?.substring(0, 8);
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const itemsHtml = (invoice.pharmacyInvoiceItems || []).map(item => {
      const cleanName = formatMedicationName(item.name, item.strength);
      return `
        <div class="item-row">
          <span class="item-name">${cleanName}</span>
          <span class="item-qty">${item.quantity}</span>
          <span class="item-price">${item.totalPrice.toLocaleString()}</span>
        </div>`;
    }).join('');

    const content = `
      <!DOCTYPE html><html><head><title>Pharmacy Receipt - ${printPatientName}</title>
      <style>
        @media print { @page { size: 80mm 297mm; margin: 0; } body { margin: 0; padding: 0; } }
        body { font-family: 'Segoe UI', sans-serif; margin: 0; color: #333; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; }
        .receipt-container { width: 72mm; min-height: 100mm; background: white; padding: 4mm; box-sizing: border-box; }
        .header { text-align: center; border-bottom: 1px solid #2563eb; padding-bottom: 4px; margin-bottom: 6px; }
        .clinic-name { font-size: 12px; font-weight: 800; margin: 0; color: #1e40af; }
        .receipt-title { font-size: 10px; font-weight: 700; margin: 2px 0; text-transform: uppercase; color: #1e293b; }
        .info-row { font-size: 9px; margin-bottom: 4px; padding: 3px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 2px; }
        .info-label { font-weight: 700; color: #64748b; }
        .item-row { display: flex; justify-content: space-between; font-size: 9px; padding: 2px 0; border-bottom: 1px dashed #e2e8f0; }
        .item-name { font-weight: 600; flex: 1; }
        .item-qty { width: 30px; text-align: center; }
        .item-price { width: 60px; text-align: right; }
        .total-section { margin-top: 6px; border-top: 1px solid #2563eb; padding-top: 4px; }
        .total-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #1e3a8a; }
        .footer { margin-top: 8px; text-align: center; font-size: 8px; color: #64748b; }
      </style></head><body>
      <div class="receipt-container">
        <div class="header">
          <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
          <h2 class="receipt-title">Pharmacy Receipt</h2>
          <div style="font-size: 8px; color: #64748b;">${currentDate} ${currentTime}</div>
        </div>
        <div class="info-row">
          <span class="info-label">Patient:</span> ${printPatientName} &nbsp;|&nbsp; <span class="info-label">ID:</span> #${patientId}
          &nbsp;|&nbsp; <span class="info-label">Invoice:</span> #${invoiceId}
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 8px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
          <span style="flex: 1;">Item</span>
          <span style="width: 30px; text-align: center;">Qty</span>
          <span style="width: 60px; text-align: right;">Amount</span>
        </div>
        ${itemsHtml}
        <div class="total-section">
          <div class="total-row">
            <span>TOTAL</span>
            <span>ETB ${invoice.totalAmount.toLocaleString()}</span>
          </div>
        </div>
        <div class="footer">
          ${window.__CS__?.tagline || 'Thank you for your visit'}
        </div>
      </div></body></html>`;
    printWindow.document.write(content);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 600);
  };


  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'badge-warning';
      case 'PAID':
        return 'badge-success';
      case 'DISPENSED':
        return 'badge-info';
      default:
        return 'badge-gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'PAID':
        return <CheckCircle className="h-4 w-4" />;
      case 'DISPENSED':
        return <Pill className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Filter invoices based on status and sort by creation date (newest first)
  const filteredInvoices = invoices
    .filter(invoice => invoice.status === statusFilter)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Debug logging
  console.log('🔍 All invoices:', invoices);
  console.log('🔍 Filtered invoices:', filteredInvoices);
  console.log('🔍 Status filter:', statusFilter);

  // Check for test patient invoices specifically
  const testPatientInvoices = filteredInvoices.filter(invoice =>
    invoice.patient?.name?.includes('Test Patient') ||
    invoice.patientId?.includes('PAT-TEST')
  );
  console.log('🔍 Test patient invoices:', testPatientInvoices);

  // Check if invoices have the expected structure
  if (filteredInvoices.length > 0) {
    console.log('🔍 First invoice structure (newest):', filteredInvoices[0]);
    console.log('🔍 First invoice totalAmount:', filteredInvoices[0].totalAmount);
    console.log('🔍 First invoice pharmacyInvoiceItems:', filteredInvoices[0].pharmacyInvoiceItems);
    console.log('🔍 First invoice patient:', filteredInvoices[0].patient?.name);
  }

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
          <h2 className="text-2xl font-bold text-gray-900">Pharmacy Invoices</h2>
          <p className="text-gray-600">Process pharmacy payments and dispense medications</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            {filteredInvoices.length} {statusFilter.toLowerCase()} invoices
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-4">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {statusFilter.toLowerCase()} invoices
            </h3>
            <p className="text-gray-500">
              {statusFilter === 'PENDING'
                ? 'No invoices are currently pending payment.'
                : 'No invoices have been paid yet.'
              }
            </p>
          </div>
        ) : (
          filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">{getCustomerLabel(invoice).name}</h3>
                    <p className="text-sm text-gray-500">ID: {getCustomerLabel(invoice).id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`badge ${getStatusColor(invoice.status)} flex items-center`}>
                    {getStatusIcon(invoice.status)}
                    <span className="ml-1">{invoice.status}</span>
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(invoice.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Invoice ID</p>
                  <p className="font-mono text-sm">{invoice.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ETB {invoice.totalAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Medications</p>
                  <p className="text-sm text-gray-900">
                    {invoice.pharmacyInvoiceItems?.length || 0} medication(s)
                  </p>
                </div>
              </div>

              {/* Medications List */}
              {invoice.pharmacyInvoiceItems && invoice.pharmacyInvoiceItems.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Medications</h4>
                  <div className="space-y-1">
                    {invoice.pharmacyInvoiceItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {item.name} - {item.strength} ({item.dosageForm})
                        </span>
                        <span className="font-medium">Qty: {item.quantity} - ETB {item.totalPrice.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                {invoice.status === 'PENDING' && (
                  <button
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setPaymentData({
                        ...paymentData,
                        amount: invoice.totalAmount.toString()
                      });
                      setShowPaymentForm(true);
                    }}
                    className="btn btn-primary btn-sm flex items-center"
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    Process Payment
                  </button>
                )}

                {invoice.status === 'PAID' && (
                  <div className="text-sm text-gray-500 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                    Moved to Pharmacy Queue
                  </div>
                )}

                <button
                  onClick={() => handlePrintInvoice(invoice)}
                  className="btn btn-outline btn-sm flex items-center ml-auto"
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedInvoice && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Process Payment - {getCustomerLabel(selectedInvoice).name}
              </h3>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Invoice ID:</strong> {selectedInvoice.id}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Amount:</strong> ETB {selectedInvoice.totalAmount.toLocaleString()}
                </p>
              </div>

              <form onSubmit={handlePayment} className="space-y-4">
                <div>
                  <label className="label">Payment Method *</label>
                  <select
                    className="input"
                    value={paymentData.type}
                    onChange={(e) => setPaymentData({ ...paymentData, type: e.target.value })}
                    required
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="INSURANCE">Insurance</option>
                  </select>
                </div>

                <div>
                  <label className="label">Amount (ETB) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    required
                  />
                </div>

                {paymentData.type === 'BANK' && (
                  <>
                    <div>
                      <label className="label">Bank Name</label>
                      <BankMethodSelect
                        className="input"
                        value={paymentData.bankName}
                        onChange={(e) => setPaymentData({ ...paymentData, bankName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Transaction Number</label>
                      <input
                        type="text"
                        className="input"
                        value={paymentData.transNumber}
                        onChange={(e) => setPaymentData({ ...paymentData, transNumber: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {paymentData.type === 'INSURANCE' && (
                  <div>
                    <label className="label">Insurance Company *</label>
                    <select
                      className="input"
                      value={paymentData.insuranceId}
                      onChange={(e) => setPaymentData({ ...paymentData, insuranceId: e.target.value })}
                      required
                    >
                      <option value="">Select Insurance Company</option>
                      {insuranceCompanies.map((insurance) => (
                        <option key={insurance.id} value={insurance.id}>
                          {insurance.name} ({insurance.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="input"
                    rows="3"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentForm(false);
                      setSelectedInvoice(null);
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Process Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PharmacyInvoices;
