import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Search,
  DollarSign,
  Clock,
  AlertTriangle,
  User,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

const CreditAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    fetchCreditAccounts();
  }, []);

  const fetchCreditAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get("/accounts?type=CREDIT");
      // The backend returns { accounts: [...] }
      const accountsList = response.data.accounts || response.data || [];
      // Only show accounts with outstanding debt
      const withDebt = accountsList.filter(
        (acc) => acc.debtOwed && acc.debtOwed > 0,
      );
      setAccounts(withDebt);
    } catch (error) {
      console.error("Error fetching credit accounts:", error);
      toast.error("Failed to load credit accounts");
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    const term = searchTerm.toLowerCase();
    return (
      account.patient?.name?.toLowerCase().includes(term) ||
      account.patient?.id?.toLowerCase().includes(term) ||
      account.patient?.mobile?.includes(term)
    );
  });

  const handleOpenPaymentModal = (account) => {
    setSelectedAccount(account);
    setPaymentAmount(""); // Don't pre-fill, let them enter any amount
    setPaymentMethod("CASH");
    setPaymentNotes("");
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (
      !selectedAccount ||
      !paymentAmount ||
      isNaN(paymentAmount) ||
      Number(paymentAmount) < 0
    ) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Allow 0 payment - just close modal without processing
    if (Number(paymentAmount) === 0) {
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentNotes("");
      return;
    }

    if (Number(paymentAmount) > selectedAccount.debtOwed) {
      toast.error("Payment amount cannot exceed outstanding debt");
      return;
    }

    try {
      setProcessingPayment(true);
      // Use /accounts/payment endpoint which handles debt reduction for CREDIT accounts
      await api.post("/accounts/payment", {
        accountId: selectedAccount.id,
        patientId: selectedAccount.patientId,
        amount: Number(paymentAmount),
        paymentMethod: paymentMethod,
        notes: paymentNotes || "Debt installment payment",
      });

      toast.success(
        `Payment of ETB ${Number(paymentAmount).toLocaleString()} processed successfully!`,
      );
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setSelectedAccount(null);
      fetchCreditAccounts(); // Refresh the list
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to process payment",
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  // Calculate summary stats
  const totalDebt = accounts.reduce(
    (sum, acc) => sum + (acc.debtOwed || 0),
    0,
  );
  const totalPaid = accounts.reduce(
    (sum, acc) => sum + (acc.totalDebtPaid || 0),
    0,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Credit & Installments
          </h2>
          <p className="text-gray-600">
            Manage patient debts and collect installment payments.
          </p>
        </div>
        <button
          onClick={fetchCreditAccounts}
          className="btn btn-outline btn-sm flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm text-red-600 font-medium">
                Total Outstanding
              </p>
              <p className="text-xl font-bold text-red-700">
                ETB {totalDebt.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-green-600 font-medium">
                Total Collected
              </p>
              <p className="text-xl font-bold text-green-700">
                ETB {totalPaid.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <User className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-blue-600 font-medium">
                Credit Accounts
              </p>
              <p className="text-xl font-bold text-blue-700">
                {accounts.length} patients
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search patients by name, ID, or phone..."
            className="input pl-10 w-full md:w-1/2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debt Owed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {account.patient?.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {account.patient?.mobile || account.patient?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-red-600 flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        ETB {(account.debtOwed || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        ETB {(account.totalDebtPaid || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        {new Date(account.updatedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenPaymentModal(account)}
                        className="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center shadow-sm"
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Collect Payment
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    <CheckCircle className="h-8 w-8 mx-auto text-green-400 mb-2" />
                    <p className="font-medium">No outstanding debts!</p>
                    <p className="text-sm mt-1">
                      All credit accounts are settled.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-blue-50">
              <h3 className="text-lg font-bold text-blue-900 flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Collect Installment Payment
              </h3>
            </div>

            <form onSubmit={handleProcessPayment} className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-500">Patient</p>
                <p className="font-semibold text-gray-900 text-lg">
                  {selectedAccount.patient?.name}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedAccount.patient?.mobile}
                </p>
              </div>

              <div className="bg-red-50 rounded p-3 mb-6 border border-red-100">
                <p className="text-sm text-red-700">Total Outstanding Debt</p>
                <p className="text-2xl font-bold text-red-600">
                  ETB {(selectedAccount.debtOwed || 0).toLocaleString()}
                </p>
                {selectedAccount.totalDebtPaid > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    Previously paid: ETB{" "}
                    {selectedAccount.totalDebtPaid.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    className="input w-full"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>

                {/* Payment Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Amount (ETB) *
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">ETB</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      max={selectedAccount.debtOwed || 0}
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-12 pr-12 sm:text-sm border-gray-300 rounded-md py-3"
                      placeholder="Enter amount..."
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Patient can pay any amount. Remaining debt will stay on
                    record.
                  </p>
                  {paymentAmount &&
                    Number(paymentAmount) > 0 &&
                    Number(paymentAmount) < selectedAccount.debtOwed && (
                      <p className="mt-1 text-xs text-orange-600 font-medium">
                        Remaining after payment: ETB{" "}
                        {(
                          selectedAccount.debtOwed - Number(paymentAmount)
                        ).toLocaleString()}
                      </p>
                    )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    className="input w-full"
                    rows="2"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn btn-outline px-4 py-2 text-gray-700"
                  disabled={processingPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 shadow-md flex items-center"
                  disabled={processingPayment || !paymentAmount}
                >
                  {processingPayment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    "Confirm Payment"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditAccounts;
