import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, User, Phone, Scan, X, Search, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CATEGORY_ORDER = [
  'Head', 'Chest', 'Upper extremity', 'Abdomen', 'Back',
  'Pelvis', 'Lower limb', 'Angiography', 'CT Scan', 'Ultrasound'
];

const RadiologyWalkInOrders = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    age: '',
    bloodType: '',
    referringDoctor: '',
    notes: ''
  });
  const [organizedTests, setOrganizedTests] = useState({});
  const [selectedTests, setSelectedTests] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingTests, setFetchingTests] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRadiologyTests();
  }, []);

  const fetchRadiologyTests = async () => {
    try {
      setFetchingTests(true);
      const res = await api.get('/radiologies/investigation-types/organized');
      if (!res.data?.organized) { toast.error('Invalid response'); return; }
      setOrganizedTests(res.data.organized);
      const keys = Object.keys(res.data.organized);
      if (keys.length > 0) setActiveCategory(keys[0]);
    } catch (error) {
      toast.error(error.response?.status === 403 ? 'Permission denied.' : `Failed to load: ${error.message}`);
    } finally {
      setFetchingTests(false);
    }
  };

  const toggleTest = (test) => {
    setSelectedTests(prev => {
      const isSelected = prev.some(t => t.id === test.id);
      if (isSelected) {
        return prev.filter(t => t.id !== test.id);
      } else {
        return [...prev, test];
      }
    });
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error('Please fill in patient name and phone number');
      return;
    }
    if (selectedTests.length === 0) {
      toast.error('Please select at least one test');
      return;
    }
    try {
      setSubmitting(true);
      const response = await api.post('/walk-in-orders/radiology', {
        name: formData.name,
        phone: formData.phone,
        gender: formData.gender,
        age: formData.age,
        bloodType: formData.bloodType,
        referringDoctor: formData.referringDoctor,
        testTypes: selectedTests.map(t => t.id),
        notes: formData.notes
      });
      toast.success(`Walk-in order created! ID: ${response.data.outsider.id}`);
      setFormData({
        name: '',
        phone: '',
        gender: '',
        age: '',
        bloodType: '',
        referringDoctor: '',
        notes: ''
      });
      setSelectedTests([]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create walk-in order');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotal = () => {
    return selectedTests.reduce((sum, test) => sum + (test.price || 0), 0);
  };

  const allTestsFlat = useMemo(() => {
    const tests = [];
    Object.entries(organizedTests).forEach(([cat, data]) => {
      data.tests?.forEach(t => tests.push({ ...t, cat }));
    });
    return tests;
  }, [organizedTests]);

  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return allTestsFlat.filter(t =>
      t.name.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q)
    );
  }, [searchQuery, allTestsFlat]);

  const selectedCount = selectedTests.length;
  const total = calculateTotal();

  const renderTestRow = (test) => {
    const sel = selectedTests.some(t => t.id === test.id);
    return (
      <label key={test.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors bg-white ${sel ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
        <input
          type="checkbox"
          checked={sel}
          onChange={() => toggleTest(test)}
          className="w-4 h-4 text-purple-600 rounded border-gray-300"
        />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`text-sm ${sel ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{test.name}</span>
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">{test.price ? `${test.price.toLocaleString()} ETB` : '-'}</span>
      </label>
    );
  };

  if (fetchingTests) {
    return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /><span className="ml-2 text-gray-500">Loading...</span></div>;
  }

  const categoryKeys = Object.keys(organizedTests).sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a) !== -1 ? CATEGORY_ORDER.indexOf(a) : 99) - (CATEGORY_ORDER.indexOf(b) !== -1 ? CATEGORY_ORDER.indexOf(b) : 99)
  );
  const activeData = organizedTests[activeCategory] || { tests: [] };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <form onSubmit={handleSubmit}>
        {/* Patient Info Section */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <UserPlus className="h-6 w-6 text-purple-600 mr-2" />
            <h2 className="text-lg font-bold text-gray-900">Walk-In Radiology Order</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Patient Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1"><Phone className="w-3 h-3 inline mr-1" />Phone *</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
              <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">-</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Age</label>
              <input type="text" name="age" value={formData.age} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. 45" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Blood Type</label>
              <select name="bloodType" value={formData.bloodType} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Referring Doctor</label>
              <input type="text" name="referringDoctor" value={formData.referringDoctor} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Optional" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" name="notes" value={formData.notes} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Additional info..." />
            </div>
          </div>
        </div>

        {/* Test Selection — 3-column layout matching doctor design */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex flex-col md:flex-row gap-5">
            {/* Left: Categories sidebar */}
            <div className="w-full md:w-48 flex-shrink-0">
              <div className="flex md:flex-col items-center md:items-stretch gap-2 mb-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:block px-2">Categories</div>
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto md:max-h-[calc(100vh-480px)] pb-2 md:pb-0">
                {categoryKeys.map(cat => {
                  const data = organizedTests[cat];
                  const totalT = data?.tests?.length || 0;
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
                      className={`whitespace-nowrap md:whitespace-normal flex-shrink-0 md:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{cat}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{totalT}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Center: Tests */}
            <div className="flex-1 min-w-0">
              {searchQuery && filteredTests ? (
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">Search Results ({filteredTests.length})</div>
                  <div className="p-2 max-h-[500px] overflow-y-auto">
                    {filteredTests.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">No matches</div>
                    ) : (
                      filteredTests.map(t => renderTestRow(t))
                    )}
                  </div>
                </div>
              ) : activeCategory ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">{activeCategory}</h3>
                  <div className="text-xs text-gray-500 mb-2">{activeData.tests?.length || 0} test(s) available</div>
                  {activeData.tests && activeData.tests.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 rounded-xl overflow-hidden">
                      {activeData.tests.map(test => renderTestRow(test))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic py-8 text-center">No tests in this category</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic py-8 text-center">Select a category</div>
              )}
            </div>

            {/* Right: Selected Summary */}
            <div className="w-full md:w-72 flex-shrink-0">
              <div className="bg-white border border-gray-200 rounded-xl p-4 md:sticky md:top-4 space-y-3">
                <div className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                  <span>Selected Tests</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{selectedCount}</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-1.5 -mx-1 px-1">
                  {selectedTests.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-6">No tests selected</div>
                  ) : (
                    selectedTests.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-800 truncate">{t.name}</div>
                          <div className="text-gray-400 truncate">{t.cat}</div>
                        </div>
                        <button type="button" onClick={() => toggleTest(t)} className="ml-2 p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {selectedCount > 0 && (
                  <>
                    <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm font-bold text-gray-900">
                      <span>Total</span>
                      <span>{total.toLocaleString()} ETB</span>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 text-sm font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                    >
                      {submitting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <Scan className="w-4 h-4" />
                      )}
                      {submitting ? 'Creating...' : `Create Order (${selectedCount})`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          {selectedCount === 0 && (
            <div className="flex items-center justify-end pt-4 border-t mt-4">
              <div className="flex items-center text-xs text-gray-500 mr-4">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />Select tests above to create order
              </div>
              <button type="submit" disabled className="px-6 py-2 text-sm bg-gray-300 text-gray-500 rounded-xl cursor-not-allowed">
                Create Order
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default RadiologyWalkInOrders;
