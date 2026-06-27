import React, { useState, useEffect } from 'react';
import { Plus, ShoppingCart, CreditCard, Package, Search, User, Phone, Mail, Eye, Printer } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const WalkInSales = () => {
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [medicineSearchTerm, setMedicineSearchTerm] = useState('');

  const [saleData, setSaleData] = useState({
    customerName: '',
    customerPhone: '',
    pharmacyInvoiceItems: [],
    paymentMethod: 'CASH',
    insuranceId: '',
    totalAmount: 0,
    notes: ''
  });

  const [newItem, setNewItem] = useState({
    medicationCatalogId: '',
    name: '',
    dosageForm: '',
    strength: '',
    quantity: 1,
    unitPrice: 0,
    notes: ''
  });

  const categories = [
    'ANTIBIOTIC',
    'ANALGESIC',
    'CARDIOVASCULAR',
    'ANTIDIABETIC',
    'RESPIRATORY',
    'CORTICOSTEROID',
    'GASTROINTESTINAL',
    'VITAMIN',
    'OPIOID',
    'BENZODIAZEPINE',
    'ANTIHISTAMINE',
    'ANTACID',
    'LAXATIVE',
    'DIURETIC',
    'OTHER'
  ];

  const units = [
    'TABLETS',
    'CAPSULES',
    'ML',
    'MG',
    'UNITS',
    'VIALS',
    'BOTTLES'
  ];

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchSales();
  }, [statusFilter, debouncedSearchTerm]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const statusParam = statusFilter !== 'ALL' ? (statusFilter === 'COMPLETED' ? 'PAID' : statusFilter) : '';
      if (statusParam) {
        params.append('status', statusParam);
      }
      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }
      const response = await api.get(`/pharmacy-billing/invoices?${params.toString()}`);
      const allInvoices = response.data.invoices || [];
      setSales(allInvoices.filter(inv => inv.type === 'WALK_IN_SALE'));
    } catch (error) {
      toast.error('Failed to fetch walk-in sales');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await api.get('/pharmacies/inventory');
      setInventory(response.data.inventory);
    } catch (error) {
      toast.error('Failed to fetch inventory');
    }
  };

  const handleAddItem = () => {
    if (!newItem.medicationCatalogId || !newItem.name || !newItem.dosageForm || !newItem.strength || newItem.quantity <= 0) {
      toast.error('Please select a medication and enter quantity');
      return;
    }
    
    // Ensure unitPrice is set (from catalog)
    if (!newItem.unitPrice || newItem.unitPrice <= 0) {
      toast.error('Medication price is missing');
      return;
    }

    const item = {
      ...newItem,
      totalPrice: newItem.quantity * newItem.unitPrice
    };

    setSaleData(prev => ({
      ...prev,
      pharmacyInvoiceItems: [...prev.pharmacyInvoiceItems, item],
      totalAmount: prev.totalAmount + item.totalPrice
    }));

    setNewItem({
      medicationCatalogId: '',
      name: '',
      dosageForm: '',
      strength: '',
      quantity: 1,
      unitPrice: 0,
      notes: ''
    });
  };

  const handleRemoveItem = (index) => {
    const item = saleData.pharmacyInvoiceItems[index];
    setSaleData(prev => ({
      ...prev,
      pharmacyInvoiceItems: prev.pharmacyInvoiceItems.filter((_, i) => i !== index),
      totalAmount: prev.totalAmount - item.totalPrice
    }));
  };

  const handleCreateSale = async () => {
    try {
      if (!saleData.customerName.trim()) {
        toast.error('Please enter customer name');
        return;
      }
      if (saleData.pharmacyInvoiceItems.length === 0) {
        toast.error('Please add at least one item');
        return;
      }

      setLoading(true);
      await api.post('/pharmacy-billing/invoices', {
        type: 'WALK_IN_SALE',
        customerName: saleData.customerName,
        customerPhone: saleData.customerPhone,
        items: saleData.pharmacyInvoiceItems.map(item => ({
          medicationCatalogId: item.medicationCatalogId,
          name: item.name,
          dosageForm: item.dosageForm,
          strength: item.strength,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
          notes: item.notes || ''
        }))
      });
      toast.success('Walk-in sale completed and recorded successfully');
      setShowCreateModal(false);
      setSaleData({
        customerName: '',
        customerPhone: '',
        pharmacyInvoiceItems: [],
        paymentMethod: 'CASH',
        insuranceId: '',
        totalAmount: 0,
        notes: ''
      });
      setMedicineSearchTerm('');
      fetchSales();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create walk-in sale');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSale = (sale) => {
    const customerName = getCustomerName(sale).toUpperCase();
    const invoiceId = sale.invoiceNumber || sale.id.substring(0, 8);
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const itemsHtml = (sale.pharmacyInvoiceItems || []).map(item => `
      <div class="item-row">
        <span class="item-name">${item.name}${item.strength ? ' - ' + item.strength : ''}</span>
        <span class="item-qty">${item.quantity}</span>
        <span class="item-price">${(item.totalPrice || item.unitPrice * item.quantity).toLocaleString()}</span>
      </div>
    `).join('');

    const printWindow = window.open('', '_blank');
    const content = `
      <!DOCTYPE html><html><head><title>Pharmacy Receipt - ${customerName}</title>
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
          <span class="info-label">Customer:</span> ${customerName} &nbsp;|&nbsp; <span class="info-label">Invoice:</span> #${invoiceId}
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
            <span>ETB ${sale.totalAmount.toLocaleString()}</span>
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
      case 'COMPLETED':
        return 'badge-success';
      case 'PAID':
        return 'badge-info';
      case 'PENDING':
        return 'badge-warning';
      default:
        return 'badge-secondary';
    }
  };

  const getCustomerName = (sale) => {
    if (sale.customerName) return sale.customerName;
    if (sale.notes && sale.notes.startsWith('Walk-in:')) {
      const rest = sale.notes.replace('Walk-in:', '').trim();
      const namePart = rest.split('(')[0].trim();
      return namePart || 'Walk-in Customer';
    }
    if (sale.patient?.name) return sale.patient.name;
    return 'Walk-in Customer';
  };

  const getCustomerPhone = (sale) => {
    if (sale.customerPhone) return sale.customerPhone;
    if (sale.notes) {
      const match = sale.notes.match(/\(([^)]+)\)/);
      if (match) return match[1];
    }
    if (sale.patient?.mobile) return sale.patient.mobile;
    return null;
  };

  // Sales are already filtered by backend based on searchTerm and statusFilter
  const filteredSales = sales;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Walk-in Sales</h2>
          <p className="text-gray-600">Manage over-the-counter and external prescription sales</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Sale
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer name..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Sales List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Sale ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr key={sale.id}>
                  <td className="font-mono text-sm">{sale.invoiceNumber || sale.id.substring(0, 8)}</td>
                  <td>
                    <div>
                      <p className="font-medium">{getCustomerName(sale)}</p>
                    </div>
                  </td>
                  <td>{sale.pharmacyInvoiceItems?.length || 0} items</td>
                  <td className="font-medium">ETB {sale.totalAmount.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${getStatusColor(sale.status)}`}>
                      {sale.status === 'PAID' ? 'COMPLETED' : sale.status}
                    </span>
                  </td>
                  <td>{new Date(sale.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedSale(sale);
                          setShowDetailsModal(true);
                        }}
                        className="btn btn-sm btn-outline"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePrintSale(sale)}
                        className="btn btn-sm btn-outline"
                        title="Print Receipt"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Sale Modal */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="text-lg font-bold mb-4">Create Walk-in Sale</h3>
            
            {/* Customer Information */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  <span className="label-text">Customer Name *</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={saleData.customerName}
                  onChange={(e) => setSaleData(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Phone (Optional)</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={saleData.customerPhone}
                  onChange={(e) => setSaleData(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="Phone number"
                />
              </div>
            </div>

            {/* Add Item Form */}
            <div className="border rounded-lg p-4 mb-4">
              <h4 className="font-medium mb-3">Add Medication</h4>
              {/* Medicine Search */}
              <div className="mb-4">
                <label className="label">
                  <span className="label-text">Search Medicine *</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Search by medicine name..."
                    value={medicineSearchTerm}
                    onChange={(e) => setMedicineSearchTerm(e.target.value)}
                  />
                  <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                </div>
                
                {/* Medicine Selection Dropdown */}
                {medicineSearchTerm && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg bg-white shadow-lg">
                    {inventory
                      .filter(med => 
                        med.name.toLowerCase().includes(medicineSearchTerm.toLowerCase()) ||
                        med.genericName?.toLowerCase().includes(medicineSearchTerm.toLowerCase())
                      )
                      .map((med) => (
                        <div
                          key={med.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => {
                            setNewItem({
                              medicationCatalogId: med.id,
                              name: med.name,
                              dosageForm: med.dosageForm,
                              strength: med.strength,
                              quantity: 1,
                              unitPrice: med.unitPrice, // Use catalog price, but will be optional in backend
                              notes: ''
                            });
                            setMedicineSearchTerm('');
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{med.name}</p>
                              <p className="text-sm text-gray-500">
                                {med.genericName} - {med.strength} ({med.dosageForm})
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">ETB {med.unitPrice}</p>
                              <p className="text-sm text-gray-500">Stock: {med.availableQuantity}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Selected Medicine Details */}
              {newItem.medicationCatalogId && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="label">
                      <span className="label-text">Quantity *</span>
                    </label>
                    <input
                      type="number"
                      className="input input-sm"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">Unit Price</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input input-sm bg-gray-100"
                      value={newItem.unitPrice}
                      readOnly
                      disabled
                      title="Price from inventory catalog"
                    />
                    <p className="text-xs text-gray-500 mt-1">From inventory</p>
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">Notes</span>
                    </label>
                    <input
                      type="text"
                      className="input input-sm"
                      placeholder="Optional notes"
                      value={newItem.notes}
                      onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="btn btn-primary btn-sm w-full"
                    >
                      Add to Sale
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Items List */}
            {saleData.pharmacyInvoiceItems.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Items ({saleData.pharmacyInvoiceItems.length})</h4>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Dosage</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saleData.pharmacyInvoiceItems.map((item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td>{item.strength} - {item.dosageForm}</td>
                          <td>{item.quantity}</td>
                          <td>ETB {item.unitPrice.toFixed(2)}</td>
                          <td>ETB {item.totalPrice.toFixed(2)}</td>
                          <td>
                            <button
                              onClick={() => handleRemoveItem(index)}
                              className="btn btn-sm btn-error"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right mt-2">
                  <p className="text-lg font-bold">Total: ETB {saleData.totalAmount.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">
                  <span className="label-text">Payment Method</span>
                </label>
                <select
                  className="select"
                  value={saleData.paymentMethod}
                  onChange={(e) => setSaleData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  <option value="CASH">Cash</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="BANK">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Notes</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={saleData.notes}
                  onChange={(e) => setSaleData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes"
                />
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSale}
                className="btn btn-primary"
                disabled={loading || saleData.pharmacyInvoiceItems.length === 0 || !saleData.customerName.trim()}
              >
                {loading ? 'Processing...' : 'Create Sale & Process Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSale && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="text-lg font-bold mb-4">Sale Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Sale ID</p>
                <p className="font-mono text-sm">{selectedSale.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Customer Name</p>
                <p className="font-medium">{getCustomerName(selectedSale)}</p>
              </div>
              {getCustomerPhone(selectedSale) && (
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p>{getCustomerPhone(selectedSale)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`badge ${getStatusColor(selectedSale.status)}`}>
                  {selectedSale.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p>{selectedSale.paymentMethod || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p>{new Date(selectedSale.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Items</p>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Dosage</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSale.pharmacyInvoiceItems?.map((item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td>{item.strength} - {item.dosageForm}</td>
                          <td>{item.quantity}</td>
                          <td>ETB {item.unitPrice.toFixed(2)}</td>
                          <td>ETB {item.totalPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">Total: ETB {selectedSale.totalAmount.toLocaleString()}</p>
              </div>
            </div>
            <div className="modal-action">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="btn btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WalkInSales;
