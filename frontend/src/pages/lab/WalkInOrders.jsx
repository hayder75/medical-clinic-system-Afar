import React, { useState, useEffect } from 'react';
import { UserPlus, User, Phone, TestTube, X, Check, AlertCircle, ChevronDown, ChevronRight, Package } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const WalkInOrders = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    age: '',
    bloodType: '',
    referringDoctor: '',
    notes: ''
  });
  const [selectedTestIds, setSelectedTestIds] = useState(new Set());
  const [organizedTests, setOrganizedTests] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAvailableTests();
    // Expand all categories by default
    setExpandedCategories(new Set(['Hematology', 'Blood Chemistry', 'Serology', 'Urinalysis', 'Stool Examination']));
  }, []);

  const fetchAvailableTests = async () => {
    try {
      console.log('🔍 Fetching lab tests from /labs/tests/for-ordering...');
      const response = await api.get('/labs/tests/for-ordering');
      console.log('✅ Response received:', {
        status: response.status,
        hasData: !!response.data,
        hasOrganized: !!response.data?.organized,
        categories: response.data?.organized ? Object.keys(response.data.organized) : []
      });
      
      if (!response.data?.organized) {
        console.warn('⚠️ Response data missing "organized" field:', response.data);
        toast.error('Invalid response format from server');
        return;
      }
      
      setOrganizedTests(response.data.organized);
      console.log('✅ Tests loaded successfully:', Object.keys(response.data.organized).length, 'categories');
    } catch (error) {
      console.error('❌ Error fetching tests:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method
      });
      
      if (error.response?.status === 404) {
        toast.error('Lab tests endpoint not found. Please check server configuration.');
      } else if (error.response?.status === 403) {
        toast.error('Permission denied. Please check your user role.');
      } else {
        toast.error(`Failed to load available tests: ${error.message}`);
      }
    }
  };

  // Toggle category expansion
  const toggleCategory = (category) => {
    // Controlled expansion: always expand when clicked, don't collapse if already expanded
    setExpandedCategories(prev => {
      if (prev.has(category)) {
        return prev; // Already expanded, keep it expanded
      }
      return new Set([...prev, category]); // Expand it
    });
  };

  // Toggle group expansion
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Handle panel selection (select all tests in a group)
  const handlePanelSelect = (group) => {
    const allTestIds = group.tests.map(test => test.id);
    const allSelected = allTestIds.every(id => selectedTestIds.has(id));
    
    setSelectedTestIds(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        allTestIds.forEach(id => newSet.delete(id));
      } else {
        allTestIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  // Handle individual test selection
  const handleTestSelect = (testId) => {
    setSelectedTestIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  };

  // Check if panel is fully selected
  const isPanelFullySelected = (group) => {
    if (!group.tests || group.tests.length === 0) return false;
    return group.tests.every(test => selectedTestIds.has(test.id));
  };

  // Check if panel is partially selected
  const isPanelPartiallySelected = (group) => {
    if (!group.tests || group.tests.length === 0) return false;
    const selectedCount = group.tests.filter(test => selectedTestIds.has(test.id)).length;
    return selectedCount > 0 && selectedCount < group.tests.length;
  };

  // Get all selected tests with details
  const getSelectedTests = () => {
    const selected = [];
    Object.values(organizedTests).forEach(category => {
      category.groups?.forEach(group => {
        group.tests?.forEach(test => {
          if (selectedTestIds.has(test.id)) {
            selected.push({ ...test, groupName: group.name });
          }
        });
      });
      category.standalone?.forEach(test => {
        if (selectedTestIds.has(test.id)) {
          selected.push(test);
        }
      });
    });
    return selected;
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
    if (selectedTestIds.size === 0) { 
      toast.error('Please select at least one test'); 
      return; 
    }
    try {
      setSubmitting(true);
      const response = await api.post('/walk-in-orders/lab', { 
        name: formData.name, 
        phone: formData.phone, 
        gender: formData.gender,
        age: formData.age,
        bloodType: formData.bloodType,
        referringDoctor: formData.referringDoctor,
        labTestIds: Array.from(selectedTestIds), 
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
      setSelectedTestIds(new Set());
    } catch (error) {
      console.error('Error creating walk-in order:', error);
      toast.error(error.response?.data?.message || 'Failed to create walk-in order');
    } finally { 
      setSubmitting(false); 
    }
  };

  const selectedTests = getSelectedTests();
  const totalPrice = selectedTests.reduce((sum, test) => sum + (test.price || 0), 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-6">
          <UserPlus className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Walk-In Lab Order</h1>
            <p className="text-gray-600">For non-registered patients</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />Patient Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="h-4 w-4 inline mr-1" />Phone Number *
                </label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender (Optional)</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Leave empty</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age (Optional)</label>
                <input type="text" name="age" value={formData.age} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 34 or N/A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type (Optional)</label>
                <select name="bloodType" value={formData.bloodType} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Leave empty</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referring Doctor (Optional)</label>
                <input type="text" name="referringDoctor" value={formData.referringDoctor} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Leave empty or type N/A" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Additional information..." />
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TestTube className="h-5 w-5 mr-2" />Select Lab Tests *</h2>
            {Object.keys(organizedTests).length === 0 ? (
              <p className="text-gray-500 text-center py-4">Loading tests...</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4 bg-white">
                {Object.entries(organizedTests).map(([category, data]) => (
                  <div key={category} className="border-b border-gray-200 pb-4 last:border-b-0">
                    {/* Category Header */}
                    <button
                      type="button"
                      onClick={() => {
                        // Controlled expansion: always expand when clicked
                        if (!expandedCategories.has(category)) {
                          setExpandedCategories(prev => new Set([...prev, category]));
                        }
                      }}
                      className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <span className="font-semibold text-gray-900">{category}</span>
                      {expandedCategories.has(category) ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                    </button>

                    {/* Category Content */}
                    {expandedCategories.has(category) && (
                      <div className="mt-3 space-y-3 ml-4">
                        {/* Groups (Panels) */}
                        {data.groups && data.groups.map((group) => {
                          const isFullySelected = isPanelFullySelected(group);
                          const isPartiallySelected = isPanelPartiallySelected(group);
                          const isExpanded = expandedGroups.has(group.id);
                          
                          return (
                            <div key={group.id} className="border border-gray-200 rounded-lg">
                              {/* Panel Header */}
                              <div className="bg-blue-50 p-3 rounded-t-lg">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleGroup(group.id)}
                                      className="flex items-center space-x-2 hover:text-blue-700"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-blue-600" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-blue-600" />
                                      )}
                                      <Package className="w-4 h-4 text-blue-600" />
                                      <span className="font-medium text-blue-900">{group.name}</span>
                                    </button>
                                  </div>
                                  
                                  <div className="flex items-center space-x-3">
                                    <span className="text-sm text-blue-600">
                                      {group.tests?.length || 0} test(s)
                                    </span>
                                    <label className="flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isFullySelected}
                                        ref={(el) => {
                                          if (el) el.indeterminate = isPartiallySelected;
                                        }}
                                        onChange={() => handlePanelSelect(group)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                      />
                                      <span className="ml-2 text-sm text-blue-700 font-medium">
                                        Select Panel
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              </div>

                              {/* Panel Children (Tests) */}
                              {isExpanded && group.tests && (
                                <div className="p-3 bg-gray-50 space-y-2">
                                  {group.tests.map((test) => {
                                    const isSelected = selectedTestIds.has(test.id);
                                    
                                    return (
                                      <div
                                        key={test.id}
                                        className={`flex items-center justify-between p-2 rounded ${
                                          isSelected
                                            ? 'bg-blue-100 border border-blue-300'
                                            : 'bg-white border border-gray-200 hover:border-blue-300'
                                        }`}
                                      >
                                        <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleTestSelect(test.id)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                          />
                                          <div className="flex-1">
                                            <div className="flex items-center space-x-2">
                                              <TestTube className="w-4 h-4 text-gray-500" />
                                              <span className="text-sm font-medium text-gray-900">
                                                {test.name}
                                              </span>
                                            </div>
                                            {test.description && (
                                              <p className="text-xs text-gray-600 mt-1">{test.description}</p>
                                            )}
                                          </div>
                                          <span className="text-sm font-medium text-blue-600">
                                            {test.price} ETB
                                          </span>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Standalone Tests */}
                        {data.standalone && data.standalone.length > 0 && (
                          <div className="space-y-2">
                            {data.standalone.map((test) => {
                              const isSelected = selectedTestIds.has(test.id);
                              
                              return (
                                <div
                                  key={test.id}
                                  className={`flex items-center justify-between p-3 rounded border ${
                                    isSelected
                                      ? 'bg-blue-100 border-blue-300'
                                      : 'bg-white border-gray-200 hover:border-blue-300'
                                  }`}
                                >
                                  <label className="flex items-center space-x-3 flex-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleTestSelect(test.id)}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <TestTube className="w-4 h-4 text-gray-500" />
                                    <div className="flex-1">
                                      <span className="text-sm font-medium text-gray-900">
                                        {test.name}
                                      </span>
                                      {test.description && (
                                        <p className="text-xs text-gray-600 mt-1">{test.description}</p>
                                      )}
                                    </div>
                                    <span className="text-sm font-medium text-blue-600">
                                      {test.price} ETB
                                    </span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedTests.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="text-md font-semibold text-gray-900 mb-2">Selected Tests ({selectedTests.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedTests.map(test => (
                  <div key={test.id} className="flex items-center justify-between bg-white rounded p-2 border border-blue-200">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{test.name}</span>
                      {test.groupName && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-2">
                          {test.groupName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-blue-600 font-medium">{test.price} ETB</span>
                      <button type="button" onClick={() => handleTestSelect(test.id)} className="text-red-600 hover:text-red-800">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex justify-between font-semibold text-gray-900">
                  <span>Total:</span>
                  <span>ETB {totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center text-sm text-gray-600">
              <AlertCircle className="h-4 w-4 mr-1" />Order will be sent to billing for payment</div>
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center">
              {submitting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Creating...</> : <><Check className="h-4 w-4 mr-2" />Send to Billing</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalkInOrders;

