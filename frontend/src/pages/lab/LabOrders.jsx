import React, { useState, useEffect } from 'react';
import { TestTube, Clock, CheckCircle, AlertTriangle, FileText, User, Calendar, Stethoscope, X, Eye } from 'lucide-react';
import ImageUpload from '../../components/lab/ImageUpload';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { getServerUrl } from '../../utils/imageUrl';
import { useAuth } from '../../contexts/AuthContext';
import { checkLabTemplateStandard, checkLabFieldStandard } from '../../utils/medicalStandards';
import { checkValueInNormalRange } from '../../utils/normalRangeParser';
import { generateDefaultResults } from '../../utils/labDefaultValues';

const getDateToken = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '00000000';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

const toSmallSequence = (raw) => {
  const input = String(raw ?? '');
  if (!input) return '000';
  if (/^\d+$/.test(input)) {
    return String(parseInt(input, 10) % 1000 || parseInt(input, 10)).padStart(3, '0').slice(-3);
  }
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash + input.charCodeAt(i) * (i + 1)) % 1000;
  }
  return String(hash || 1).padStart(3, '0');
};

const formatDisplayOrderId = (order) => `${getDateToken(order?.createdAt)}-${toSmallSequence(order?.id)}`;

const LabOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [showServiceTemplate, setShowServiceTemplate] = useState(false);
  const [savedFormData, setSavedFormData] = useState({});
  const [showCBCAdditionalFields, setShowCBCAdditionalFields] = useState({});
  const [labImages, setLabImages] = useState({});
  const [panelGroupData, setPanelGroupData] = useState({});
  const [savingResults, setSavingResults] = useState(false);
  const [savingPanel, setSavingPanel] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchTemplates();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/labs/orders', {
        params: { status: statusFilter }
      });
      console.log('📋 [fetchOrders] Raw response:', {
        batchOrders: response.data.batchOrders?.length || 0,
        walkInOrders: response.data.walkInOrders?.length || 0,
        labTestOrders: response.data.labTestOrders?.length || 0
      });

      // Log sample lab test orders structure
      if (response.data.labTestOrders && response.data.labTestOrders.length > 0) {
        const sample = response.data.labTestOrders[0];
        console.log('📋 [fetchOrders] Sample lab test order group:', {
          id: sample.id,
          visitId: sample.visitId,
          patientId: sample.patientId,
          ordersCount: sample.orders?.length,
          firstOrder: sample.orders?.[0] ? {
            id: sample.orders[0].id,
            hasLabTest: !!sample.orders[0].labTest,
            labTestName: sample.orders[0].labTest?.name,
            resultFieldsCount: sample.orders[0].labTest?.resultFields?.length
          } : null
        });
      }

      // Group labTestOrders by patient+visit to show all tests for same patient in one card
      const labTestOrders = (response.data.labTestOrders || []).filter((order) => Boolean(order.labTest));
      const groupedLabOrders = [];
      
      // Group by visitId or batchOrderId or patientId for walk-ins
      const groups = {};
      labTestOrders.forEach(order => {
        // Use visitId, batchOrderId, or a combination of patientId+isWalkIn as group key
        const groupKey = order.visitId 
          ? `visit_${order.visitId}` 
          : order.batchOrderId 
            ? `batch_${order.batchOrderId}` 
            : `walkin_${order.patientId}_${new Date(order.createdAt).toDateString()}`;
        
        if (!groups[groupKey]) {
          groups[groupKey] = {
            id: order.visitId || order.batchOrderId || order.id,
            visitId: order.visitId,
            batchOrderId: order.batchOrderId,
            patient: order.patient,
            doctor: order.doctor,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            status: order.status,
            isWalkIn: order.isWalkIn,
            billingId: order.billingId || null,
            __kind: 'labtest_group',
            orders: []
          };
        }
        // Add this order to the group
        groups[groupKey].orders.push(order);
        const groupStatuses = groups[groupKey].orders.map((o) => o.status);
        if (groupStatuses.every((s) => s === 'COMPLETED')) {
          groups[groupKey].status = 'COMPLETED';
        } else if (groupStatuses.some((s) => s === 'IN_PROGRESS')) {
          groups[groupKey].status = 'IN_PROGRESS';
        } else if (groupStatuses.some((s) => s === 'QUEUED' || s === 'PAID')) {
          groups[groupKey].status = 'QUEUED';
        }
      });
      
      // Convert grouped object to array
      Object.values(groups).forEach(group => {
        if ((group.orders || []).length > 0) {
          groupedLabOrders.push(group);
        }
      });
      
      console.log('📋 [fetchOrders] Grouped lab test orders:', groupedLabOrders.length, 'groups with', labTestOrders.length, 'total tests');

      const groupedWalkInKeys = new Set(
        groupedLabOrders
          .filter((group) => group.isWalkIn)
          .map((group) => group.billingId || `${group.patient?.id}-${new Date(group.createdAt).toDateString()}`)
      );

      const dedupedLegacyWalkInOrders = (response.data.walkInOrders || []).filter((order) => {
        if (!order.type) return false;
        const key = order.billingId || `${order.patient?.id}-${new Date(order.createdAt).toDateString()}`;
        return !groupedWalkInKeys.has(key);
      });

      // Combine all order types: old batch orders, old walk-in orders, and new grouped lab test orders
      // Add __kind to each to avoid ID collisions in the list
      const allOrders = [
        ...(response.data.batchOrders || []).map(o => ({ ...o, __kind: 'batch' })),
        ...dedupedLegacyWalkInOrders.map(o => ({ ...o, __kind: 'walkin' })),
        ...groupedLabOrders
      ];
      setOrders(allOrders);
      console.log('📋 [fetchOrders] Total orders set:', allOrders.length);
    } catch (error) {
      toast.error('Failed to fetch lab orders');
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/labs/templates');
      setTemplates(response.data.templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const getFilteredOrders = () => {
    let filtered = orders;

    // Status filter
    if (statusFilter === 'PENDING') {
      filtered = filtered.filter(order => order.status !== 'COMPLETED');
    } else if (statusFilter === 'COMPLETED') {
      filtered = filtered.filter(order => order.status === 'COMPLETED');
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order => {
        // For grouped lab test orders, search in all orders within the group
        if (order.__kind === 'labtest_group' && order.orders) {
          const patientMatch = order.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase());
          const doctorMatch = order.doctor?.fullname?.toLowerCase().includes(searchTerm.toLowerCase());
          const testMatch = order.orders.some(o => o.labTest?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
          const idMatch = order.id?.toString().toLowerCase().includes(searchTerm.toLowerCase());
          return patientMatch || doctorMatch || testMatch || idMatch;
        }
        // For regular orders
        return order.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.doctor?.fullname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.type?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
      });
    }

    // Sort completed orders by date (recent first)
    if (statusFilter === 'COMPLETED') {
      filtered.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt);
        const dateB = new Date(b.updatedAt || b.createdAt);
        return dateB - dateA; // Descending order
      });
    }

    return filtered;
  };

  const fetchExistingResults = async (batchOrderId) => {
    try {
      const response = await api.get(`/labs/orders/${batchOrderId}/detailed-results`);
      const existingResults = {};

      if (response.data && response.data.detailedResults) {
        response.data.detailedResults.forEach(result => {
          existingResults[result.templateId] = {
            results: { ...result.results, _images: labImages[result.orderId] || labImages[selectedService] || [] },
            additionalNotes: result.additionalNotes || '',
            completed: true,
            resultId: result.id
          };
        });
      }

      return existingResults;
    } catch (error) {
      console.error('Error fetching existing results:', error);
      return {};
    }
  };

  const handleOrderClick = async (order) => {
    console.log('🔍 [handleOrderClick] Order clicked:', {
      id: order.id,
      kind: order.__kind,
      visitId: order.visitId,
      patientId: order.patientId,
      hasOrders: !!order.orders,
      ordersCount: order.orders?.length,
      orders: order.orders?.map(o => ({ id: o.id, labTestName: o.labTest?.name, hasLabTest: !!o.labTest }))
    });

    setSelectedOrder(order);
    setShowTemplateForm(true);

    // Check if this is a grouped lab test order (labtest_group) 
    // OR a new lab test order (has orders array)
    // Also check if it has visitId but no services (indicating new system)
    const isGroupedLabTest = order.__kind === 'labtest_group';
    const hasOrdersArray = order.orders && Array.isArray(order.orders) && order.orders.length > 0;
    const hasVisitIdNoServices = order.visitId && !order.services && !order.type;
    const isNewLabTestOrder = isGroupedLabTest || hasOrdersArray || hasVisitIdNoServices;

    console.log('🔍 [handleOrderClick] Order detection:', {
      hasOrdersArray,
      ordersLength: order.orders?.length,
      hasVisitIdNoServices,
      visitId: order.visitId,
      hasServices: !!order.services,
      hasType: !!order.type,
      isNewLabTestOrder
    });

    // Make sure templates are loaded first (for old system)
    if (!isNewLabTestOrder && templates.length === 0) {
      await fetchTemplates();
    }

    // Initialize test results for each lab service
    const initialResults = {};

    // NEW SYSTEM: Handle lab test orders
    if (isNewLabTestOrder) {
      // If orders array exists and has items, use it (for grouped orders)
      // Otherwise, use the order itself as a single lab test order (labTest is directly on the order)
      let ordersToProcess = order.orders || [];

      // If orders array is empty but the order itself has labTest, use the order as a single test
      if (ordersToProcess.length === 0 && order.labTest) {
        console.log('✅ [handleOrderClick] Using single lab test from order:', {
          orderId: order.id,
          labTestName: order.labTest.name,
          hasResultFields: !!order.labTest.resultFields?.length
        });
        ordersToProcess = [order];
      }

      // If still no orders and we have a visitId, try fetching from API
      if (ordersToProcess.length === 0 && order.visitId) {
        console.warn('⚠️ [handleOrderClick] Orders array is empty for new system order, attempting to fetch...');
        try {
          // Fetch orders for this visit
          const ordersResponse = await api.get('/labs/orders');
          const allLabTestOrders = ordersResponse.data.labTestOrders || [];
          const matchingOrderGroup = allLabTestOrders.find(o =>
            (o.visitId === order.visitId && o.patientId === order.patientId) ||
            (o.id === order.id) ||
            (o.batchOrderId === order.batchOrderId)
          );
          if (matchingOrderGroup && matchingOrderGroup.orders && matchingOrderGroup.orders.length > 0) {
            ordersToProcess = matchingOrderGroup.orders;
            console.log('✅ [handleOrderClick] Fetched orders from API:', ordersToProcess.length);
            // Update the order object
            order.orders = ordersToProcess;
            // Also update selectedOrder to have the orders
            setSelectedOrder({ ...order, orders: ordersToProcess });
          } else if (matchingOrderGroup && matchingOrderGroup.labTest) {
            // Single test order found directly
            ordersToProcess = [matchingOrderGroup];
            console.log('✅ [handleOrderClick] Found single lab test:', matchingOrderGroup.labTest.name);
          } else {
            console.error('❌ [handleOrderClick] No matching order group found in API response');
            console.log('   Searched for:', { visitId: order.visitId, patientId: order.patientId, id: order.id, batchOrderId: order.batchOrderId });
            console.log('   Available groups:', allLabTestOrders.map(o => ({ id: o.id, visitId: o.visitId, patientId: o.patientId, ordersCount: o.orders?.length, hasLabTest: !!o.labTest })));
          }
        } catch (err) {
          console.error('❌ [handleOrderClick] Error fetching orders:', err);
        }
      }

      if (ordersToProcess.length === 0) {
        console.error('❌ [handleOrderClick] No orders found to process for new lab test order!');
        console.error('   Order object:', {
          id: order.id,
          visitId: order.visitId,
          patientId: order.patientId,
          batchOrderId: order.batchOrderId,
          hasOrders: !!order.orders,
          ordersLength: order.orders?.length,
          hasLabTest: !!order.labTest
        });
        toast.error('No lab test orders found. The order may not be properly loaded. Please refresh the page and try again.');
        return;
      }

      console.log('🔍 [handleOrderClick] Processing new lab test orders, count:', ordersToProcess.length);

      // Fetch existing results for each order
      for (const labOrder of ordersToProcess) {
        const orderId = labOrder.id;
        const labTest = labOrder.labTest;

        console.log('🔍 [handleOrderClick] Processing order:', {
          orderId,
          hasLabTest: !!labTest,
          labTestName: labTest?.name,
          resultFieldsCount: labTest?.resultFields?.length
        });

        if (!labTest) {
          console.warn('⚠️ [handleOrderClick] Order missing labTest, skipping:', orderId);
          continue;
        }

        // Fetch existing result if any
        let existingResult = null;
        try {
          // Check if result exists in the order data
          if (labOrder.results && labOrder.results.length > 0) {
            existingResult = labOrder.results[0]; // Take first result
            console.log('✅ [handleOrderClick] Found result in order data:', {
              resultId: existingResult.id,
              hasResults: !!existingResult.results,
              resultsKeys: existingResult.results ? Object.keys(existingResult.results) : []
            });
          } else {
            // If no result in order data, try fetching directly from API
            console.log('⚠️ [handleOrderClick] No result in order data, checking if order is completed...');
            // Results should be included in the initial fetch, but if missing, we'll handle it in display
          }
        } catch (err) {
          console.error('Error fetching existing result:', err);
        }

        // Parse results if it's stored as JSON string
        let parsedResults = {};
        if (existingResult && existingResult.results) {
          if (typeof existingResult.results === 'string') {
            try {
              parsedResults = JSON.parse(existingResult.results);
            } catch (e) {
              parsedResults = {};
            }
          } else {
            parsedResults = existingResult.results;
          }
        } else {
          // No existing result - generate defaults from normalRange
          // Pass labTest code to exclude CBC additional fields (MCV, MCH, MCHC) from defaults
          const defaultResults = generateDefaultResults(labTest.resultFields || [], labTest.code);
          parsedResults = defaultResults;
        }

        // Mark as completed if result exists or if order status is COMPLETED
        const isCompleted = existingResult ? true : (labOrder.status === 'COMPLETED');

        // Initialize with resultFields from labTest
        initialResults[orderId] = {
          orderId: orderId,
          labTestId: labTest.id,
          labTest: labTest,
          resultFields: labTest.resultFields || [],
          results: parsedResults,
          additionalNotes: existingResult?.additionalNotes || '',
          completed: isCompleted,
          resultId: existingResult?.id || null,
          serviceName: labTest.name
        };

        console.log('✅ [handleOrderClick] Result data:', {
          orderId,
          serviceName: labTest.name,
          hasResults: Object.keys(parsedResults).length > 0,
          isCompleted,
          hasExistingResult: !!existingResult
        });

        console.log('✅ [handleOrderClick] Added to initialResults:', {
          orderId,
          serviceName: labTest.name,
          resultFieldsCount: (labTest.resultFields || []).length
        });
      }

      console.log('✅ [handleOrderClick] Total initialResults:', Object.keys(initialResults).length);
      setTestResults(initialResults);
      // Build panel groups
      const panelGroups = {};
      Object.entries(initialResults).forEach(([oid, res]) => {
        const g = res.labTest?.group;
        const gid = g?.id || '_solo_' + oid;
        if (!panelGroups[gid]) {
          panelGroups[gid] = { id: gid, name: g?.name || null, panel: g || null, entries: [], fields: [] };
        }
        panelGroups[gid].entries.push(oid);
        (res.resultFields || []).forEach(f => panelGroups[gid].fields.push(f));
      });
      setPanelGroupData(panelGroups);
      return;
    }

    console.log('⚠️ [handleOrderClick] Not a new lab test order, using old system');

    // OLD SYSTEM: Handle batch orders and walk-in orders
    const services = order.services || (order.type ? [{ service: order.type, id: order.id }] : []);

    // Always try to fetch existing results first (regardless of order status)
    let existingResults = {};
    try {
      if (order.isWalkIn) {
        // For walk-in orders, check labResults in the order data
        services.forEach(service => {
          if (service.labResults && service.labResults.length > 0) {
            const orderId = service.id || order.id;
            service.labResults.forEach(labResult => {
              if (labResult.testType && labResult.resultText) {
                const matchingTemplate = templates.find(t =>
                  labResult.testType.id === service.service.id
                );

                if (matchingTemplate) {
                  existingResults[orderId] = {
                    serviceId: service.id,
                    labOrderId: orderId,
                    templateId: matchingTemplate.id,
                    template: matchingTemplate,
                    serviceName: service.service.name,
                    results: JSON.parse(labResult.resultText || '{}'),
                    additionalNotes: labResult.additionalNotes || '',
                    completed: true,
                    resultId: labResult.id
                  };
                }
              }
            });
          }
        });
      } else {
        // For batch orders, fetch from detailed-results endpoint
        try {
          const response = await api.get(`/labs/orders/${order.id}/detailed-results`);
          console.log('📋 Fetched detailed results:', response.data);
          if (response.data && response.data.detailedResults) {
            response.data.detailedResults.forEach(result => {
              console.log('📋 Processing result:', {
                serviceId: result.serviceId,
                templateId: result.templateId,
                hasResults: !!result.results,
                resultsKeys: result.results ? Object.keys(result.results) : []
              });

              // Find the service that matches this result by serviceId
              const matchingService = services.find(s => s.id === result.serviceId);
              if (matchingService && matchingService.service) {
                const serviceId = matchingService.id;

                // Find matching template - try by ID first, then from result, then by name
                let matchingTemplate = templates.find(t => t.id === result.templateId);
                if (!matchingTemplate && result.template) {
                  matchingTemplate = result.template;
                  // Also add it to templates array if not already there
                  if (!templates.find(t => t.id === result.template.id)) {
                    templates.push(result.template);
                  }
                }
                if (!matchingTemplate) {
                  // Try to find by service name
                  const serviceName = matchingService.service.name.toLowerCase();
                  matchingTemplate = templates.find(t => {
                    const templateName = t.name.toLowerCase();
                    return serviceName === templateName ||
                      serviceName.includes(templateName) ||
                      templateName.includes(serviceName);
                  });
                }

                // Parse results if it's a string, otherwise use as-is
                let parsedResults = result.results || {};
                if (typeof parsedResults === 'string') {
                  try {
                    parsedResults = JSON.parse(parsedResults);
                  } catch (e) {
                    console.error('Error parsing results:', e);
                    parsedResults = {};
                  }
                }

                console.log('✅ Creating existing result for serviceId:', serviceId, 'with', Object.keys(parsedResults).length, 'fields');

                existingResults[serviceId] = {
                  serviceId: serviceId,
                  labOrderId: order.id,
                  templateId: result.templateId,
                  template: matchingTemplate,
                  serviceName: matchingService.service.name,
                  results: parsedResults,
                  additionalNotes: result.additionalNotes || '',
                  completed: true,
                  resultId: result.id
                };
              } else {
                console.warn('⚠️ No matching service found for result.serviceId:', result.serviceId, 'Available services:', services.map(s => s.id));
              }
            });
          }
        } catch (err) {
          console.error('Error fetching detailed results:', err);
        }
      }
    } catch (err) {
      console.error('Error fetching existing results:', err);
      // Continue with empty forms if fetch fails
    }

    console.log('📋 Existing results found:', Object.keys(existingResults).length);

    // Now prepare forms for all services, using existing results if available
    services.forEach(service => {
      if (service.service) {
        // For batch orders, service.id is the BatchOrderService.id
        // For walk-in orders, service.id is the LabOrder.id
        const serviceId = service.id; // This is the key we'll use in testResults
        const orderId = order.isWalkIn ? service.id : order.id;

        // Check if we already have existing results for this service
        if (existingResults[serviceId]) {
          // Use existing results - make sure template is loaded
          const existingResult = existingResults[serviceId];
          console.log('📋 Using existing result for serviceId:', serviceId, {
            hasTemplate: !!existingResult.template,
            templateId: existingResult.templateId,
            resultsCount: Object.keys(existingResult.results || {}).length,
            serviceName: existingResult.serviceName
          });

          if (!existingResult.template && existingResult.templateId) {
            // Try to find template if not loaded
            let matchingTemplate = templates.find(t => t.id === existingResult.templateId);
            if (matchingTemplate) {
              existingResult.template = matchingTemplate;
            }
          }

          // Ensure results is an object, not empty
          if (!existingResult.results || Object.keys(existingResult.results).length === 0) {
            console.warn('⚠️ Existing result has empty results object for serviceId:', serviceId);
          }

          initialResults[serviceId] = existingResult;
        } else {
          // No existing results - prepare empty form
          // Find matching template
          const matchingTemplate = templates.find(template => {
            const serviceName = service.service.name.toLowerCase();
            const templateName = template.name.toLowerCase();

            if (serviceName === templateName) return true;
            if (serviceName.includes(templateName) || templateName.includes(serviceName)) return true;

            const serviceWords = serviceName.split(' ');
            const templateWords = templateName.split(' ');

            return serviceWords.some(word =>
              templateWords.some(tWord =>
                word.includes(tWord) || tWord.includes(word)
              )
            );
          });

          if (matchingTemplate) {
            initialResults[serviceId] = {
              serviceId: service.id,
              labOrderId: orderId,
              templateId: matchingTemplate.id,
              template: matchingTemplate,
              serviceName: service.service.name,
              results: {},
              additionalNotes: '',
              completed: false,
              resultId: null
            };
          } else {
            // No template found - create entry with blank text box option
            initialResults[serviceId] = {
              serviceId: service.id,
              labOrderId: orderId,
              templateId: null,
              template: null,
              serviceName: service.service.name,
              results: {},
              additionalNotes: '',
              completed: false,
              resultId: null
            };
            console.log('No template found for service:', service.service.name, '- Using blank text box');
          }
        }
      }
    });

    console.log('Initial results prepared:', Object.keys(initialResults).length, 'services');
    setTestResults(initialResults);
  };

  const handleServiceClick = (serviceId, isPanel = false) => {
    if (isPanel) {
      setSelectedService('panel_' + serviceId);
    } else {
      setSelectedService(serviceId);
    }
    setShowServiceTemplate(true);
  };

  const handlePrintResults = async (e, order = null) => {
    const orderToPrint = order || selectedOrder;
    if (!orderToPrint) return;

    // Stop event propagation if called from button click
    if (e) {
      e.stopPropagation();
    }

    try {
      // Fetch results from API for the order
      let resultsToPrint = testResults;
      let orderData = orderToPrint;

      // If we don't have results in state, fetch from API
      if (Object.keys(resultsToPrint).length === 0 || order) {
        try {
          // Try to fetch results from API - use detailed-results endpoint
          const response = await api.get(`/labs/orders/${orderToPrint.id}/detailed-results`);
          const apiResults = response.data?.detailedResults || response.data?.results || [];

          // Convert API results to the format expected by print function
          if (Array.isArray(apiResults) && apiResults.length > 0) {
            resultsToPrint = {};
            apiResults.forEach((result) => {
              const serviceId = result.serviceId || result.labTestId || result.id;
              if (serviceId) {
                // Convert resultFields to results object if needed
                let resultsObj = result.results || {};
                if (result.resultFields && Array.isArray(result.resultFields)) {
                  // If resultFields is an array, convert to object
                  resultsObj = {};
                  result.resultFields.forEach(field => {
                    if (field.fieldName) {
                      resultsObj[field.fieldName] = field.value || '';
                    }
                  });
                } else if (typeof result.resultFields === 'object') {
                  resultsObj = result.resultFields;
                }

                resultsToPrint[serviceId] = {
                  results: resultsObj,
                  additionalNotes: result.additionalNotes || '',
                  serviceName: result.service?.name || result.labTest?.name || 'Lab Test',
                  template: result.template || {},
                  resultFields: result.labTest?.resultFields || result.resultFields || [], // Include resultFields for new system
                  labTest: result.labTest || null, // Include labTest for resultFields access
                  verifiedByUser: result.verifiedByUser || null
                };
              }
            });
          }

          // Update order data if API provides more info
          if (response.data?.order) {
            orderData = response.data.order;
          }
        } catch (fetchError) {
          console.warn('Could not fetch results from API, using existing state:', fetchError);
          // Continue with existing testResults if API fetch fails
        }
      }

      // If still no results, show error
      if (Object.keys(resultsToPrint).length === 0) {
        toast.error('No lab results found for this order. Please complete the tests first.');
        return;
      }

      const printWindow = window.open('', '_blank');
      const currentDate = new Date();
      const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };
      const formatDateTime = (date) => {
        return date.toLocaleString('en-US');
      };

      // Get lab technician from first result's verifiedByUser
      const firstResult = Object.values(resultsToPrint)[0];
      const labTechnicianName = firstResult?.verifiedByUser?.fullname || firstResult?.verifiedByUser || user?.fullname || 'Lab Technician';
      const patient = orderData.patient || {};

      // Calculate age from date of birth
      const calculateAge = (dob) => {
        if (!dob) return 'N/A';
        const birthDate = new Date(dob);
        if (Number.isNaN(birthDate.getTime())) return 'N/A';
        const today = new Date();
        let years = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) years--;
        if (years < 0) return 'N/A';
        if (years === 0) {
          let months = today.getMonth() - birthDate.getMonth();
          let days = today.getDate() - birthDate.getDate();
          if (days < 0) {
            months--;
            const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += prevMonth.getDate();
          }
          if (months < 0) months = 0;
          return months === 0 ? `${days}d` : `${months}m ${days}d`;
        }
        return years;
      };

      const patientAge = patient.dob ? calculateAge(patient.dob) : (patient.age || 'N/A');
      const patientBloodType = patient.bloodType || 'N/A';
      const displayOrderId = formatDisplayOrderId(orderData);

      printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lab Results - ${patient.name || 'Patient'}</title>
          <style>
            @media print {
              @page { 
                size: A4;
                margin: 5mm;
              }
              body { margin: 0; padding: 0; background: white !important; visibility: visible !important; display: block !important; zoom: 90%; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
              .header { border-bottom: 2px solid black !important; padding-bottom: 5px !important; margin-bottom: 10px !important; }
              .test-group-header { border-bottom: 1px solid black !important; color: black !important; padding: 2px 4px !important; }
              .no-print { display: none !important; }
              .test-group { margin-bottom: 10px !important; padding-bottom: 5px !important; page-break-inside: avoid; }
              .footer { margin-top: 10px !important; padding-top: 5px !important; }
              .print-footer { margin-top: 10px !important; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 10px;
              color: #333;
              line-height: 1.3;
              font-size: 10pt;
            }
            .no-print {
              text-align: center;
              padding: 15px;
              background: #f8f9fa;
              margin-bottom: 15px;
              border-bottom: 1px solid #dee2e6;
            }
            .no-print button {
              background: #2563eb;
              color: white;
              border: none;
              padding: 8px 20px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
            }
            /* Restored Header Styles */
            .header { 
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 10px; 
              margin-bottom: 15px; 
              border-bottom: 3px solid #2563eb;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .logo {
              width: 70px;
              height: 70px;
              object-fit: contain;
            }
            .clinic-info {
              text-align: left;
            }
            .clinic-name { 
              font-size: 24px; 
              font-weight: 800; 
              margin: 0;
              color: #1e40af;
              letter-spacing: -0.5px;
            }
            .clinic-tagline {
              font-size: 12px;
              color: #64748b;
              margin: 0;
              font-style: italic;
            }
            .header-right {
              text-align: right;
            }
            .report-title { 
              font-size: 20px; 
              font-weight: 700; 
              margin: 0;
              color: #0f172a;
              text-transform: uppercase;
            }
            .report-info {
              font-size: 12px;
              color: #64748b;
              margin-top: 2px;
            }

            .patient-section {
              margin-bottom: 15px;
              padding: 10px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              font-size: 10pt;
            }
            .section-header {
              font-size: 12px;
              font-weight: 700;
              margin-bottom: 8px;
              color: #1e293b;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 3px;
              text-transform: uppercase;
            }
            .patient-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-weight: 600;
              color: #64748b;
              font-size: 10px;
              text-transform: uppercase;
            }
            .info-value {
              color: #1e293b;
              font-weight: 500;
              font-size: 11px;
            }

            /* Balanced 2-Column Flex Layout */
            .results-flex-container {
              display: flex;
              gap: 20px;
              margin-top: 10px;
              align-items: start;
            }
            .column {
              flex: 1;
              display: flex;
              flex-direction: column;
            }
            .test-group {
              break-inside: avoid;
              margin-bottom: 15px;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              overflow: hidden;
              background-color: #fff;
              width: 100%;
            }
            .test-group-header {
              background-color: #f1f5f9;
              font-weight: bold;
              color: #1e40af;
              padding: 2px 6px;
              font-size: 9pt;
              border-bottom: 1px solid #cbd5e1;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .result-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 0;
            }
            .result-table td {
              padding: 2px 4px;
              font-size: 8.5pt;
              border-bottom: 1px solid #f1f5f9;
            }
            .param-name {
              color: #475569;
              font-weight: 500;
              width: 65%;
            }
            .param-value {
              font-weight: 700;
              color: #0f172a;
              text-align: right;
            }
            .notes-box {
              padding: 3px 8px;
              background-color: #fffbeb;
              font-size: 8pt;
              font-style: italic;
              color: #64748b;
              border-top: 1px solid #fef3c7;
            }

            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 9.5pt;
            }
            .signature-box {
              text-align: center;
              min-width: 150px;
            }
            .signature-line {
              border-top: 1px solid #334155;
              margin-top: 35px;
              padding-top: 4px;
              font-size: 10px;
              font-weight: 600;
              color: #475569;
            }
            .print-footer {
              text-align: center;
              font-size: 8.5px;
              color: #94a3b8;
              margin-top: 20px;
              border-top: 1px dashed #e2e8f0;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">Print Report</button>
          </div>

          <div class="header">
            <div class="header-left">
              <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="Clinic Logo" class="logo" onerror="this.style.display='none'">
              <div class="clinic-info">
                <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
                <p class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</p>
              </div>
            </div>
            <div class="header-right">
              <h2 class="report-title">Laboratory Report</h2>
              <div class="report-info">
                Date: ${formatDateTime(currentDate)}
              </div>
            </div>
          </div>

            <div class="patient-section">
            <div class="section-header">Patient Information</div>
            <div class="patient-grid">
              <div class="info-item">
                <span class="info-label">Full Name</span>
                <span class="info-value">${patient.name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Patient ID</span>
                <span class="info-value">#${patient.id || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Gender</span>
                <span class="info-value">${patient.gender || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Age</span>
                <span class="info-value">${patientAge}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Blood Type</span>
                <span class="info-value">${patientBloodType}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Contact</span>
                <span class="info-value">${patient.mobile || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Order ID</span>
                <span class="info-value">${displayOrderId}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Ref. Doctor</span>
                <span class="info-value">${orderData.doctor?.fullname || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div class="results-flex-container">
            ${(() => {
          const resultsArray = Object.entries(resultsToPrint).map(([serviceId, result]) => {
            const fieldCount = (result.resultFields && result.resultFields.length > 0)
              ? result.resultFields.filter(f => result.results?.[f.fieldName] !== undefined && result.results?.[f.fieldName] !== '').length
              : Object.values(result.results || {}).filter(v => v !== null && v !== undefined && v !== '').length;

            const weight = fieldCount + 2 + (result.additionalNotes ? 1.5 : 0);

            const rows = (() => {
              if (result.resultFields && result.resultFields.length > 0) {
                return result.resultFields.map((field) => {
                  let value = result.results?.[field.fieldName];
                  if (value === undefined && field.fieldName === 'wbc') { value = result.results?.['pus_cells']; }
                  if (value === undefined || value === null || value === '') return '';
                  const displayValue = String(value).trim() === '' ? '-' : value;
                  const unit = field.unit ? ` ${field.unit}` : '';
                  return `<tr><td class="param-name">${field.label}</td><td class="param-value">${displayValue}${unit}</td></tr>`;
                }).join('');
              } else {
                return Object.entries(result.results || {}).map(([field, value]) => {
                  const fieldLabelMap = { 'pus_cells': 'WBC', 'wbc': 'WBC' };
                  const displayFieldName = fieldLabelMap[field] || field;
                  const fieldConfig = result.template?.fields?.[field] || {};
                  const unit = fieldConfig.unit ? ` ${fieldConfig.unit}` : '';
                  const displayValue = (value === null || value === undefined || value === '') ? '-' : value;
                  return `<tr><td class="param-name">${displayFieldName}</td><td class="param-value">${displayValue}${unit}</td></tr>`;
                }).join('');
              }
            })();

            const html = `
                    <div class="test-group">
                      <div class="test-group-header">${result.serviceName}</div>
                      <table class="result-table"><tbody>${rows}</tbody></table>
                      ${result.additionalNotes ? `<div class="notes-box"><strong>Note:</strong> ${result.additionalNotes}</div>` : ''}
                    </div>
                  `;
            return { weight, html };
          });

          // Balancing Algorithm
          let col1 = [], col2 = [];
          let weight1 = 0, weight2 = 0;

          resultsArray.sort((a, b) => b.weight - a.weight).forEach(item => {
            if (weight1 <= weight2) {
              col1.push(item.html);
              weight1 += item.weight;
            } else {
              col2.push(item.html);
              weight2 += item.weight;
            }
          });

          return `
                  <div class="column">${col1.join('')}</div>
                  <div class="column">${col2.join('')}</div>
                `;
        })()}
          </div>

          <div class="footer">
            <div class="signature-box">
              <div class="signature-line">Lab Technician</div>
              <div style="font-weight: bold; font-size: 10pt;">${labTechnicianName}</div>
            </div>
            <div class="signature-box">
              <div style="height: 40px;"></div> <!-- Stamp Placeholder -->
            </div>
            <div class="signature-box">
              <div class="signature-line">Authorized Signature</div>
            </div>
          </div>

          <div class="print-footer">
            Computer Generated Report • ${window.__CS__?.name || 'Clinic'} • ${formatDateTime(currentDate)}
          </div>
        </body>
      </html>
    `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 800);

      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Error printing lab results:', error);
      toast.error('Failed to load lab results for printing');
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedOrder) return;

    try {
      const response = await api.get(`/labs/orders/${selectedOrder.id}/pdf`);
      const link = document.createElement('a');
      link.href = `${getServerUrl()}${response.data.filePath}`;
      link.download = response.data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const handleCloseServiceTemplate = async () => {
    setSavingPanel(true);
    // Auto-save the current form data to database if it has results
    // Handle panel mode save
    if (selectedService && selectedService.startsWith('panel_')) {
      const panelId = selectedService.replace('panel_', '');
      const group = panelGroupData[panelId];
      if (group) {
        const panelImgs = labImages['panel_' + panelId] || [];
        for (const oid of group.entries) {
          const r = testResults[oid];
          if (r && r.orderId && r.labTestId) {
            try {
              await api.post('/labs/results/lab-test', {
                orderId: r.orderId,
                labTestId: r.labTestId,
                results: { ...(r.results || {}), _images: panelImgs },
                additionalNotes: r.additionalNotes || '',
                finalize: false
              });
            } catch (e) { console.error('Panel save error', oid, e); }
          }
        }
        toast.success('Panel draft saved');
      }
    } else if (selectedService && testResults[selectedService] && selectedOrder && selectedOrder.status !== 'COMPLETED') {
      const result = testResults[selectedService];
      const hasResults = Object.values(result.results || {}).some(value => value && value.toString().trim() !== '') ||
        (result.additionalNotes && result.additionalNotes.trim() !== '');

      if (hasResults) {
        try {
          // Check if this is new lab test order system
          const isNewSystem = result.labTestId && result.orderId;

          if (isNewSystem) {
            // NEW SYSTEM: Save as draft only; do not mark completed until explicit Complete All Tests
            await api.post('/labs/results/lab-test', {
              orderId: result.orderId,
              labTestId: result.labTestId,
              results: { ...result.results, _images: labImages[result.orderId] || labImages[selectedService] || [] },
              additionalNotes: result.additionalNotes || '',
              finalize: false
            });

            toast.success('Draft saved');
          } else {
            // OLD SYSTEM: Save using individual result endpoint
            const labOrderId = selectedOrder.isWalkIn
              ? parseInt(result.labOrderId || selectedService)
              : parseInt(selectedOrder.id);

            const serviceId = selectedOrder.isWalkIn
              ? parseInt(result.labOrderId || selectedService)
              : parseInt(result.serviceId || selectedService);

            await api.post('/labs/results/individual', {
              labOrderId: labOrderId,
              serviceId: serviceId,
              templateId: result.templateId || null,
              results: { ...result.results, _images: labImages[result.orderId] || labImages[selectedService] || [] },
              additionalNotes: result.additionalNotes || ''
            });

            toast.success('Results saved');
          }

        } catch (error) {
          console.error('Error saving result:', error);
          if (error.response?.status === 404) {
            toast.error('Order or test not found. Please refresh and try again.');
          } else {
            toast.error('Failed to save results: ' + (error.response?.data?.error || error.message));
          }
        }
      }
    }

    setShowServiceTemplate(false);
    setSelectedService(null);
    setSavingPanel(false);
  };

  const updateTestResult = (serviceId, field, value) => {
    setTestResults(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value
      }
    }));
  };


  const renderFormField = (fieldName, fieldConfig, serviceId) => {
    const value = testResults[serviceId]?.results?.[fieldName] || '';
    const isCompleted = selectedOrder && selectedOrder.status === 'COMPLETED';
    const baseClassName = `w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCompleted ? 'bg-gray-100 cursor-not-allowed' : ''}`;

    switch (fieldConfig.type) {
      case 'number':
        return (
          <input
            type="number"
            value={value}
            readOnly={isCompleted}
            onChange={(e) => {
              if (isCompleted) return;
              const newResults = { ...testResults[serviceId].results };
              newResults[fieldName] = e.target.value;
              updateTestResult(serviceId, 'results', newResults);
            }}
            className={baseClassName}
            placeholder={fieldConfig.unit ? `Enter value (${fieldConfig.unit}) - Optional` : 'Enter value (Optional)'}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            disabled={isCompleted}
            onChange={(e) => {
              if (isCompleted) return;
              const newResults = { ...testResults[serviceId].results };
              newResults[fieldName] = e.target.value;
              updateTestResult(serviceId, 'results', newResults);
            }}
            className={baseClassName}
          >
            <option value="">Select an option (Optional)</option>
            {fieldConfig.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            readOnly={isCompleted}
            onChange={(e) => {
              if (isCompleted) return;
              const newResults = { ...testResults[serviceId].results };
              newResults[fieldName] = e.target.value;
              updateTestResult(serviceId, 'results', newResults);
            }}
            className={baseClassName}
            rows={3}
            placeholder="Enter details... (Optional)"
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            readOnly={isCompleted}
            onChange={(e) => {
              if (isCompleted) return;
              const newResults = { ...testResults[serviceId].results };
              newResults[fieldName] = e.target.value;
              updateTestResult(serviceId, 'results', newResults);
            }}
            className={baseClassName}
            placeholder="Enter value... (Optional)"
          />
        );
    }
  };

  const handleCompleteBatchOrder = async () => {
    setSavingResults(true);
    try {

      // Check if this is a new lab test order system (including grouped orders)
      const isNewLabTestOrder = (selectedOrder.orders && Array.isArray(selectedOrder.orders)) || selectedOrder.__kind === 'labtest_group';
      const isWalkIn = selectedOrder.isWalkIn;

      if (isNewLabTestOrder) {
        // Handle panel mode: save all panel orders first
        const panelIds = new Set();
        Object.entries(testResults).forEach(([oid, r]) => {
          if (r.labTest?.group?.id) panelIds.add(r.labTest.group.id);
        });
        const skipOrderIds = new Set();
        for (const pid of panelIds) {
          const panelImgs = labImages['panel_' + pid] || [];
          for (const [oid, r] of Object.entries(testResults)) {
            if (r.labTest?.group?.id === pid && r.orderId && r.labTestId) {
              skipOrderIds.add(oid);
              try {
                await api.post('/labs/results/lab-test', {
                  orderId: r.orderId,
                  labTestId: r.labTestId,
                  results: { ...r.results, _images: panelImgs },
                  additionalNotes: r.additionalNotes || '',
                  finalize: true
                });
              } catch (error) {
                console.error('Panel complete error', oid, error);
                throw new Error(`Failed to save ${r.serviceName || r.labTest?.name}: ${error.response?.data?.error || error.message}`);
              }
            }
          }
        }
        // NEW SYSTEM: Finalize remaining (standalone) lab test orders
        const finalizedResults = {};
        for (const [orderId, result] of Object.entries(testResults)) {
          if (result.orderId && !skipOrderIds.has(orderId)) {
            try {
              await api.post('/labs/results/lab-test', {
                orderId: result.orderId,
                labTestId: result.labTestId,
                results: { ...result.results, _images: labImages[result.orderId] || labImages[selectedService] || [] },
                additionalNotes: result.additionalNotes || '',
                finalize: true
              });
              finalizedResults[orderId] = {
                ...result,
                completed: true
              };
            } catch (error) {
              console.error('Error saving lab test result:', error);
              throw new Error(`Failed to save result for ${result.serviceName || result.labTest?.name}: ${error.response?.data?.error || error.message}`);
            }
          }
        }

        if (Object.keys(finalizedResults).length > 0) {
          setTestResults(finalizedResults);
        }

        // Update all orders to completed and send to doctor if not walk-in
        if (!isWalkIn && selectedOrder.visitId) {
          // For doctor orders, they're automatically sent when all are completed
          toast.success('All lab tests completed and sent to doctor successfully');
        } else {
          toast.success('Walk-in lab tests completed successfully! Results ready for printing.');
        }
      } else {
        // OLD SYSTEM: Handle batch orders and walk-in orders
        const testResultsArray = Object.entries(testResults).map(([serviceIdKey, result]) => {
          const labOrderId = isWalkIn
            ? parseInt(result.labOrderId || serviceIdKey)
            : parseInt(selectedOrder.id);

          const serviceId = isWalkIn
            ? parseInt(result.labOrderId || serviceIdKey)
            : parseInt(result.serviceId || serviceIdKey);

          return {
            labOrderId: labOrderId,
            serviceId: serviceId,
            templateId: result.templateId || null,
            results: { ...result.results, _images: labImages[result.orderId] || labImages[selectedService] || [] },
            additionalNotes: result.additionalNotes || ''
          };
        });

        // Send each result individually (only if not already completed)
        for (const testResult of testResultsArray) {
          try {
            const resultEntry = Object.values(testResults).find(r =>
              (r.serviceId === testResult.serviceId || r.labOrderId === testResult.labOrderId) &&
              r.labOrderId === testResult.labOrderId
            );

            if (!resultEntry || !resultEntry.completed) {
              await api.post('/labs/results/individual', testResult);
            }
          } catch (error) {
            console.error('Error saving result:', error);
            if (error.response?.status === 404) {
              throw new Error(`Service ${testResult.serviceId} not found in order ${testResult.labOrderId}. Please refresh and try again.`);
            }
            throw error;
          }
        }

        // For walk-in orders, complete each individual order
        // For regular orders, send to doctor
        if (!isWalkIn) {
          await api.post(`/labs/orders/${selectedOrder.id}/send-to-doctor`);
          toast.success('All lab tests completed and sent to doctor successfully');
        } else {
          for (const labOrderId of Object.keys(testResults)) {
            await api.patch(`/labs/orders/${labOrderId}`, { status: 'COMPLETED' });
          }
          toast.success('Walk-in lab tests completed successfully! Results ready for printing.');
        }
      }

      // Completion is explicit here, so close immediately on success.
      setShowTemplateForm(false);
      setSelectedOrder(null);
      setSelectedService(null);
      setShowServiceTemplate(false);
      setTestResults({});
      fetchOrders();
    } catch (error) {
      console.error('Error completing batch order:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to complete batch order');
      }
    } finally {
      setSavingResults(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'QUEUED':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'IN_PROGRESS':
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <TestTube className="h-6 w-6 mr-2" />
          Lab Orders
        </h1>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by patient name, doctor, or order ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="PENDING">Pending Orders</option>
            <option value="COMPLETED">Completed Orders</option>
            <option value="ALL">All Orders</option>
          </select>
          <span className="text-sm text-gray-500">
            Showing {getFilteredOrders().length} of {orders.length} orders
          </span>
        </div>
      </div>

      {getFilteredOrders().length === 0 ? (
        <div className="text-center py-12">
          <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {statusFilter === 'PENDING' ? 'No pending lab orders found' :
              statusFilter === 'COMPLETED' ? 'No completed lab orders found' :
                'No lab orders found'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {getFilteredOrders().map((order) => (
            <div
              key={`${order.__kind}-${order.id}`}
              className={`bg-white rounded-lg shadow-md border p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200 ${order.status === 'QUEUED' ? 'border-yellow-200' :
                order.status === 'COMPLETED' ? 'border-green-200' : 'border-gray-200'
                }`}
              onClick={() => handleOrderClick(order)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(order.status)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {order.patient.name}
                      </h3>
                      <span className="text-sm text-gray-500 font-normal">
                        ({formatDisplayOrderId(order)})
                      </span>
                      {order.__kind === 'labtest_group' && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-sm rounded">
                          {order.orders?.length || 0} Tests
                        </span>
                      )}
                    </div>
                    <p className="text-base text-gray-700 font-medium">
                      {order.orders && order.orders.length > 0
                        ? order.orders.map(o => o.labTest?.name).filter(name => name).join(', ') || 'Loading...'
                        : order.services && order.services.length > 0
                          ? order.services.map(service => service.service?.name).filter(name => name).join(', ')
                          : order.type?.name || 'Lab Test'}
                      {order.isWalkIn && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-sm rounded">WALK-IN</span>}
                      {order.__kind === 'labtest' && (!order.orders || order.orders.length === 0) && (
                        <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-sm rounded">Loading tests...</span>
                      )}
                    </p>
                    {order.doctor?.fullname && (
                      <p className="text-base text-indigo-700 font-semibold mt-1">Requested By: Dr. {order.doctor.fullname}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-base font-semibold ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-base text-gray-700">
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  <span>{order.patient.name}</span>
                </div>
                {order.doctor && (
                  <div className="flex items-center">
                    <Stethoscope className="h-5 w-5 mr-2" />
                    <span>{order.doctor.fullname}</span>
                  </div>
                )}
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {(order.status === 'QUEUED' || order.status === 'COMPLETED') && (
                <div className={`mt-4 p-3 rounded-lg ${order.status === 'QUEUED' ? 'bg-yellow-50' : 'bg-green-50'
                  }`}>
                  <p className={`text-base font-semibold ${order.status === 'QUEUED' ? 'text-yellow-800' : 'text-green-800'
                    }`}>
                    {order.status === 'QUEUED' ? 'Click to process tests' : 'Click to view results'}
                  </p>
                </div>
              )}

              {order.instructions && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-base text-gray-700">
                    <strong>Instructions:</strong> {order.instructions}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Order Services Modal */}
      {showTemplateForm && selectedOrder && !showServiceTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedOrder.status === 'COMPLETED' ? 'Lab Results' : 'Lab Services'} - {selectedOrder.__kind === 'labtest_group' ? `Group ${formatDisplayOrderId(selectedOrder)}` : `Order ${formatDisplayOrderId(selectedOrder)}`}
                  {selectedOrder.__kind === 'labtest_group' && selectedOrder.orders && (
                    <span className="ml-2 text-sm font-normal text-purple-600">
                      ({selectedOrder.orders.length} tests)
                    </span>
                  )}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Patient: {selectedOrder.patient.name} {selectedOrder.patientId && `(${selectedOrder.patientId})`}
                  {selectedOrder.doctor && ` | Doctor: ${selectedOrder.doctor.fullname}`}
                </p>
                {selectedOrder.status === 'COMPLETED' && (
                  <p className="text-sm text-green-600 mt-1 font-medium">
                    ✓ All tests completed - Results ready for review
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowTemplateForm(false);
                  setSelectedOrder(null);
                  setTestResults({});
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Instructions:</strong> {selectedOrder.instructions || 'No specific instructions'}
              </p>
              {selectedOrder.createdAt && (
                <p className="text-xs text-blue-600 mt-1">
                  Created: {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* Tests Ordered Summary */}
            {selectedOrder.orders && selectedOrder.orders.length > 0 && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Tests Ordered:</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.orders.map((order, idx) => (
                    <span key={order.id || idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {order.labTest?.name || 'Unknown Test'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {(() => {
                const panelGroups = {};
                const standaloneIds = [];
                Object.entries(testResults).forEach(([oid, res]) => {
                  const g = res.labTest?.group;
                  const gid = g?.id || null;
                  if (gid) {
                    if (!panelGroups[gid]) {
                      panelGroups[gid] = { name: g.name, entries: [], allCompleted: true, anyHasResults: false, panel: g };
                    }
                    panelGroups[gid].entries.push(oid);
                    if (!res.completed) panelGroups[gid].allCompleted = false;
                    const hasR = Object.values(res.results || {}).some(v => v && v.toString().trim() !== '');
                    if (hasR) panelGroups[gid].anyHasResults = true;
                  } else {
                    standaloneIds.push(oid);
                  }
                });
                const panels = Object.values(panelGroups);
                return (
                  <div className="space-y-3">
                    {panels.map(p => {
                      const allDone = p.allCompleted || selectedOrder.status === 'COMPLETED';
                      const hasSome = p.anyHasResults;
                      const everyFully = p.entries.every(oid => testResults[oid]?.completed);
                      return (
                        <div key={p.panel.id} className="border-2 border-indigo-200 rounded-xl overflow-hidden">
                          <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <TestTube className="h-5 w-5 text-indigo-600" />
                                <div>
                                  <h3 className="font-semibold text-indigo-900">{p.name} Panel</h3>
                                  <p className="text-xs text-indigo-600">{p.entries.length} tests</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {everyFully && <CheckCircle className="h-5 w-5 text-green-600" />}
                                <span className={`px-2.5 py-1 rounded text-xs font-medium ${everyFully ? 'bg-green-100 text-green-800' : hasSome ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                                  {everyFully ? 'Completed' : hasSome ? 'Partial' : 'Pending'}
                                </span>
                                <button onClick={() => handleServiceClick(p.panel.id, true)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${allDone ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                  {allDone ? 'View Results' : hasSome ? 'Edit Results' : 'Fill Results'}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="px-4 py-2 bg-white">
                            <div className="flex flex-wrap gap-1.5">
                              {p.entries.map(oid => {
                                const r = testResults[oid];
                                const done = r?.completed || selectedOrder.status === 'COMPLETED';
                                const filled = Object.values(r?.results || {}).some(v => v && v.toString().trim() !== '');
                                return (
                                  <span key={oid} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${done ? 'bg-green-50 text-green-700' : filled ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-500'}`}>
                                    {r?.labTest?.name || r?.serviceName || oid}
                                    {(done || filled) && <CheckCircle className="w-3 h-3" />}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {standaloneIds.length > 0 && (
                      <div className="space-y-2">
                        {panels.length > 0 && <h4 className="text-sm font-semibold text-gray-600 mt-4 mb-2">Individual Tests</h4>}
                        {standaloneIds.map(oid => {
                          const result = testResults[oid];
                          if (!result) return null;
                          const hasResults = Object.values(result.results || {}).some(v => v && v.toString().trim() !== '') || (result.additionalNotes && result.additionalNotes.trim() !== '');
                          const isCompleted = result.completed || selectedOrder.status === 'COMPLETED';
                          const isNewSystem = !!result.labTest;
                          return (
                            <div key={oid} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <TestTube className="h-5 w-5 text-blue-500" />
                                  <div>
                                    <h3 className="font-medium text-gray-900 text-sm">{result.serviceName || result.labTest?.name}</h3>
                                    {isNewSystem && result.resultFields?.length > 0 && !isCompleted && <p className="text-xs text-gray-500">{result.resultFields.length} field(s)</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {(hasResults || isCompleted) && <CheckCircle className="h-4 w-4 text-green-500" />}
                                  <span className={`px-2 py-0.5 rounded text-xs ${(hasResults || isCompleted) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {isCompleted ? 'Done' : hasResults ? 'Filled' : 'Empty'}
                                  </span>
                                  <button onClick={() => handleServiceClick(oid)} className={`px-3 py-1.5 rounded-md text-xs transition-colors ${isCompleted ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                    {isCompleted ? 'View' : hasResults ? 'Edit' : 'Fill'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t gap-2">
              {selectedOrder.status === 'COMPLETED' ? (
                <>
                  <button
                    onClick={() => handlePrintResults()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Print Results
                  </button>
                </>
              ) : (
                <button
                  onClick={handleCompleteBatchOrder}
                  disabled={savingResults}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingResults ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : 'Complete All Tests'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Individual Service Template Modal */}
      {showServiceTemplate && selectedService && (selectedService.startsWith("panel_") || testResults[selectedService]) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedService.startsWith('panel_') ? panelGroupData[selectedService.replace('panel_', '')]?.name + ' Panel Results' : testResults[selectedService].serviceName} - {selectedService.startsWith('panel_') ? 'Panel Results' : testResults[selectedService].template ? 'Template Form' : 'Test Results'}
              </h2>
              <button
                onClick={handleCloseServiceTemplate}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {selectedService && selectedService.startsWith('panel_') ? (() => {
            const panelId = selectedService.replace('panel_', '');
            const group = panelGroupData[panelId];
            if (!group) return <div className="text-red-500 p-4">Panel data not found</div>;
            const allFields = [];
            const allResults = {};
            let allDone = true;
            group.entries.forEach(oid => {
              const r = testResults[oid];
              if (r) {
                (r.resultFields || []).forEach(f => allFields.push(f));
                if (!r.completed) allDone = false;
              }
            });
            const readOnly = allDone || selectedOrder?.status === 'COMPLETED';
            const updPanel = (fName, val) => {
              for (const oid of group.entries) {
                const r = testResults[oid];
                if (r && (r.resultFields || []).some(f => f.fieldName === fName)) {
                  const nr = { ...(r.results || {}) };
                  nr[fName] = val;
                  updateTestResult(oid, 'results', nr);
                  break;
                }
              }
            };
            const getVal = (fName) => {
              for (const oid of group.entries) {
                const r = testResults[oid];
                if (r && r.results && r.results[fName] !== undefined && r.results[fName] !== '') return r.results[fName];
              }
              return '';
            };
            return (
              <div className="space-y-6">
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                  <div className="flex items-center gap-3 mb-2">
                    <TestTube className="h-6 w-6 text-indigo-600" />
                    <div>
                      <h4 className="font-semibold text-indigo-900 text-lg">{group.name} Panel</h4>
                      <p className="text-sm text-indigo-600">{group.entries.length} tests — {allFields.length} fields</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {group.entries.map(oid => {
                      const r = testResults[oid];
                      const d = r?.completed || selectedOrder?.status === 'COMPLETED';
                      return <span key={oid} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${d ? 'bg-green-100 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{r?.labTest?.name || oid}{d && <CheckCircle className="w-3 h-3" />}</span>;
                    })}
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Attach Lab Images (for all tests in this panel)</h4>
                  <ImageUpload onImagesChange={(imgs) => setLabImages(prev => ({ ...prev, ['panel_' + panelId]: imgs }))} existingImages={labImages['panel_' + panelId] || []} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allFields.map(f => {
                    const fv = getVal(f.fieldName);
                    const owner = testResults[group.entries.find(oid => (testResults[oid].resultFields || []).some(x => x.fieldName === f.fieldName))];
                    const isCBCAdd = owner?.labTest?.code === 'CBC001' && ['mcv','mch','mchc'].includes(f.fieldName);
                    const showCBC = !isCBCAdd || showCBCAdditionalFields['panel_' + panelId];
                    if (isCBCAdd && !showCBC) return null;
                    const rc = checkValueInNormalRange(fv, f.normalRange);
                    return (
                      <div key={f.id || f.fieldName} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">{f.label || f.fieldName}{f.unit && <span className="text-gray-500 ml-1">({f.unit})</span>}</label>
                        {f.normalRange && <p className="text-xs text-gray-500">Normal: {f.normalRange}</p>}
                        {fv !== '' && fv !== null && fv !== undefined && !rc.inRange && <p className="text-xs text-red-600 font-medium">{rc.message}</p>}
                        {f.fieldType === 'number' ? (
                          <input type="number" step="any" value={fv} readOnly={readOnly} onChange={e => { if (readOnly) return; updPanel(f.fieldName, e.target.value); }}
                            className={`w-full px-3 py-2 border rounded-md ${readOnly ? 'bg-gray-100 cursor-not-allowed border-gray-300' : fv !== '' && fv !== null && fv !== undefined && !rc.inRange ? 'border-red-500' : 'border-gray-300'}`} />
                        ) : f.fieldType === 'select' ? (
                          (() => {
                            let opts = f.options ? (typeof f.options === 'string' ? (() => { try { return JSON.parse(f.options); } catch(e) { return []; } })() : f.options) : [];
                            return <select value={fv} disabled={readOnly} onChange={e => { if (readOnly) return; updPanel(f.fieldName, e.target.value); }} className="w-full px-3 py-2 border border-gray-300 rounded-md"><option value="">Select...</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select>;
                          })()
                        ) : f.fieldType === 'textarea' ? (
                          <textarea value={fv} readOnly={readOnly} onChange={e => { if (readOnly) return; updPanel(f.fieldName, e.target.value); }} className="w-full px-3 py-2 border border-gray-300 rounded-md" rows={3} />
                        ) : (
                          <input type="text" value={fv} readOnly={readOnly} onChange={e => { if (readOnly) return; updPanel(f.fieldName, e.target.value); }} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Additional Notes</label>
                  <textarea value={testResults[group.entries[0]]?.additionalNotes || ''} readOnly={readOnly}
                    onChange={e => { if (readOnly) return; group.entries.forEach(oid => updateTestResult(oid, 'additionalNotes', e.target.value)); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md" rows={3} placeholder="Additional notes for all tests in this panel..." />
                </div>
              </div>
            );
          })() : (
          <div className="space-y-6">
              {/* NEW SYSTEM: Show resultFields from labTest */}

              {testResults[selectedService].labTest && testResults[selectedService].resultFields ? (
                <>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900">{testResults[selectedService].labTest.name}</h4>
                    {testResults[selectedService].labTest.description && (
                      <p className="text-sm text-blue-700">{testResults[selectedService].labTest.description}</p>
                    )}
                    {testResults[selectedService].labTest.group && (
                      <p className="text-xs text-blue-600 mt-1">Group: {testResults[selectedService].labTest.group.name}</p>
                    )}
                  </div>

                  {/* CBC: Toggle button for additional fields */}
                  {testResults[selectedService].labTest?.code === 'CBC001' && (
                    <div className="mb-4 flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Additional Fields (MCV, MCH, MCHC)</span>
                      <button
                        type="button"
                        onClick={() => {
                          const orderId = selectedService;
                          setShowCBCAdditionalFields(prev => ({
                            ...prev,
                            [orderId]: !prev[orderId]
                          }));
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                      >
                        {showCBCAdditionalFields[selectedService] ? 'Hide Additional Fields' : 'Show Additional Fields'}
                      </button>
                    </div>
                  )}

                  {/** Image Upload Section */}
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3">Attach Lab Images</h4>
                    <ImageUpload
                      onImagesChange={(images) => {
                        setLabImages(prev => ({ ...prev, [selectedService]: images }));
                      }}
                      existingImages={labImages[selectedService] || []}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {testResults[selectedService].resultFields.map((field) => {
                      const result = testResults[selectedService];
                      const fieldValue = result.results?.[field.fieldName] || '';
                      const isCompleted = selectedOrder && selectedOrder.status === 'COMPLETED';

                      // CBC: Hide additional fields (MCV, MCH, MCHC) unless toggle is on
                      const isCBCAdditional = result.labTest?.code === 'CBC001' &&
                        ['mcv', 'mch', 'mchc'].includes(field.fieldName);
                      const shouldShowCBCAdditional = !isCBCAdditional || showCBCAdditionalFields[selectedService];

                      // HIV: Hide remarks field unless result is Positive/Reactive
                      const isHIVRemarks = result.labTest?.code === 'HIV001' && field.fieldName === 'remarks';
                      const hivResult = result.results?.result;
                      const shouldShowHIVRemarks = !isHIVRemarks || ['Reactive', 'Positive'].includes(hivResult);

                      // Don't render if field should be hidden
                      if (isCBCAdditional && !shouldShowCBCAdditional) {
                        return null;
                      }
                      if (isHIVRemarks && !shouldShowHIVRemarks) {
                        return null;
                      }

                      return (
                        <div key={field.id} className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            {field.label}
                            {field.unit && <span className="text-gray-500 ml-1">({field.unit})</span>}
                          </label>
                          {field.normalRange && (
                            <p className="text-xs text-gray-500">Normal: {field.normalRange}</p>
                          )}
                          {(() => {
                            const rangeCheck = checkValueInNormalRange(fieldValue, field.normalRange);
                            if (!rangeCheck.inRange && fieldValue !== '' && fieldValue !== null && fieldValue !== undefined) {
                              return (
                                <p className="text-xs text-red-600 font-medium mt-1">
                                  {rangeCheck.message || 'Outside normal range'}
                                </p>
                              );
                            }
                            return null;
                          })()}

                          {/* Render field based on fieldType */}
                          {field.fieldType === 'number' ? (
                            <input
                              type="number"
                              step="any"
                              value={fieldValue}
                              readOnly={isCompleted}
                              onChange={(e) => {
                                if (isCompleted) return;
                                const newResults = { ...result.results };
                                newResults[field.fieldName] = e.target.value;
                                updateTestResult(selectedService, 'results', newResults);
                              }}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCompleted ? 'bg-gray-100 cursor-not-allowed border-gray-300' :
                                (() => {
                                  const rangeCheck = checkValueInNormalRange(fieldValue, field.normalRange);
                                  return rangeCheck.inRange || !fieldValue ? 'border-gray-300' : 'border-red-500';
                                })()
                                }`}
                              style={(() => {
                                const rangeCheck = checkValueInNormalRange(fieldValue, field.normalRange);
                                if (!rangeCheck.inRange && fieldValue !== '' && fieldValue !== null && fieldValue !== undefined) {
                                  return { color: '#dc2626' }; // red-600
                                }
                                return {};
                              })()}
                              placeholder={`Enter value${field.unit ? ` (${field.unit})` : ''}`}
                            />
                          ) : field.fieldType === 'select' ? (
                            (() => {
                              // Parse options - could be JSON string or already an array
                              let optionsList = [];
                              if (field.options) {
                                if (typeof field.options === 'string') {
                                  try {
                                    optionsList = JSON.parse(field.options);
                                  } catch (e) {
                                    console.error('Error parsing options:', e);
                                    optionsList = [];
                                  }
                                } else if (Array.isArray(field.options)) {
                                  optionsList = field.options;
                                }
                              }

                              // Check if this is VDRL titer field - enable only when result is Positive
                              const isVDRLTiter = field.fieldName === 'titer' &&
                                testResults[selectedService]?.labTest?.code === 'VDRL001';
                              const vdrlResult = testResults[selectedService]?.results?.result;
                              const isTiterEnabled = !isVDRLTiter || vdrlResult === 'Positive';

                              // Check if this is Stool parasite_type field - enable only when parasite is "Seen"
                              const isStoolParasiteType = field.fieldName === 'parasite_type' &&
                                (testResults[selectedService]?.labTest?.code === 'STOOL001' ||
                                  testResults[selectedService]?.labTest?.name?.toLowerCase().includes('stool'));
                              const stoolParasite = testResults[selectedService]?.results?.parasite;
                              const isParasiteTypeEnabled = !isStoolParasiteType || stoolParasite === 'Seen';

                              return (
                                <select
                                  value={fieldValue}
                                  disabled={isCompleted || !isTiterEnabled || !isParasiteTypeEnabled}
                                  onChange={(e) => {
                                    if (isCompleted) return;
                                    const newResults = { ...result.results };
                                    newResults[field.fieldName] = e.target.value;

                                    // Special handling for VDRL: clear titer when result is not Positive
                                    const isVDRLResult = field.fieldName === 'result' &&
                                      testResults[selectedService]?.labTest?.code === 'VDRL001';
                                    if (isVDRLResult && e.target.value !== 'Positive') {
                                      newResults.titer = '';
                                    }

                                    // Special handling for Stool: Clear parasite_type if parasite is not "Seen"
                                    const isStoolParasite = field.fieldName === 'parasite' &&
                                      (testResults[selectedService]?.labTest?.code === 'STOOL001' ||
                                        testResults[selectedService]?.labTest?.name?.toLowerCase().includes('stool'));
                                    if (isStoolParasite && e.target.value !== 'Seen') {
                                      newResults.parasite_type = '';
                                    }

                                    // Special handling for HIV: Clear remarks if result is not Positive/Reactive
                                    const isHIVResult = field.fieldName === 'result' &&
                                      testResults[selectedService]?.labTest?.code === 'HIV001';
                                    if (isHIVResult && !['Reactive', 'Positive'].includes(e.target.value)) {
                                      newResults.remarks = '';
                                    }

                                    updateTestResult(selectedService, 'results', newResults);
                                  }}
                                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCompleted || !isTiterEnabled || !isParasiteTypeEnabled ? 'bg-gray-100 cursor-not-allowed' : ''
                                    }`}
                                >
                                  <option value="">-- Select --</option>
                                  {optionsList.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              );
                            })()
                          ) : field.fieldType === 'multiselect' ? (
                            (() => {
                              // Parse options - could be JSON string or already an array
                              let optionsList = [];
                              if (field.options) {
                                if (typeof field.options === 'string') {
                                  try {
                                    optionsList = JSON.parse(field.options);
                                  } catch (e) {
                                    console.error('Error parsing options:', e);
                                    optionsList = [];
                                  }
                                } else if (Array.isArray(field.options)) {
                                  optionsList = field.options;
                                }
                              }

                              // Check if this is Blood Film species field - enable only when result is Hemoparasite Seen
                              const isBloodFilmSpecies = field.fieldName === 'species' &&
                                (testResults[selectedService]?.labTest?.code === 'PICT001' ||
                                  testResults[selectedService]?.labTest?.code === 'PBF001' ||
                                  testResults[selectedService]?.labTest?.name?.toLowerCase().includes('blood film'));
                              const malariaResult = testResults[selectedService]?.results?.result;
                              const isSpeciesEnabled = !isBloodFilmSpecies || ['Hemoparasite Seen', 'Positive'].includes(malariaResult);

                              // Get current selected values (stored as comma-separated string)
                              const currentValues = fieldValue ? fieldValue.split(',').map(v => v.trim()) : [];

                              return (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    {optionsList.map(option => (
                                      <label
                                        key={option}
                                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                                          isCompleted || !isSpeciesEnabled
                                            ? 'bg-gray-100 cursor-not-allowed opacity-50'
                                            : currentValues.includes(option)
                                              ? 'bg-blue-100 border border-blue-300 text-blue-800'
                                              : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          value={option}
                                          checked={currentValues.includes(option)}
                                          disabled={isCompleted || !isSpeciesEnabled}
                                          onChange={(e) => {
                                            if (isCompleted || !isSpeciesEnabled) return;
                                            let newValues;
                                            if (e.target.checked) {
                                              newValues = [...currentValues, option];
                                            } else {
                                              newValues = currentValues.filter(v => v !== option);
                                            }
                                            const newResults = { ...result.results };
                                            newResults[field.fieldName] = newValues.join(', ');
                                            
                                            // Auto-update remark when species changes (for Blood Film)
                                            if (isBloodFilmSpecies) {
                                              const resultValue = testResults[selectedService]?.results?.result;
                                              if (['Hemoparasite Seen', 'Positive'].includes(resultValue)) {
                                                let remark = 'Hemoparasite seen.';
                                                if (newResults.species) remark += ` Species: ${newResults.species}.`;
                                                newResults.remark = remark;
                                              }
                                            }
                                            
                                            updateTestResult(selectedService, 'results', newResults);
                                          }}
                                          className="mr-2 h-4 w-4 text-blue-600 rounded"
                                        />
                                        {option}
                                      </label>
                                    ))}
                                  </div>
                                  {(!isSpeciesEnabled) && (
                                    <p className="text-xs text-gray-500">Select "Hemoparasite Seen" result to enable species selection</p>
                                  )}
                                </div>
                              );
                            })()
                          ) : field.fieldType === 'binary' ? (
                            (() => {
                              // Binary fields default to Positive/Negative if no options provided
                              let optionsList = ['Positive', 'Negative'];
                              if (field.options) {
                                if (typeof field.options === 'string') {
                                  try {
                                    optionsList = JSON.parse(field.options);
                                  } catch (e) {
                                    console.error('Error parsing options:', e);
                                  }
                                } else if (Array.isArray(field.options)) {
                                  optionsList = field.options;
                                }
                              }

                              return (
                                <select
                                  value={fieldValue}
                                  disabled={isCompleted}
                                  onChange={(e) => {
                                    if (isCompleted) return;
                                    const newResults = { ...result.results };
                                    newResults[field.fieldName] = e.target.value;

                                    // Special handling for Blood Film / Malaria: Auto-fill remarks and manage species field
                                    const isMalariaResult = field.fieldName === 'result' &&
                                      (testResults[selectedService]?.labTest?.code === 'PICT001' ||
                                        testResults[selectedService]?.labTest?.code === 'PBF001' ||
                                        testResults[selectedService]?.labTest?.name?.toLowerCase().includes('blood film') ||
                                        testResults[selectedService]?.labTest?.name?.toLowerCase().includes('malaria'));

                                    if (isMalariaResult) {
                                      // Clear species if result is negative/no hemoparasite
                                      if (['Negative', 'No Hemoparasite seen'].includes(e.target.value)) {
                                        newResults.species = '';
                                        newResults.remark = 'No Hemoparasite seen.';
                                      } else if (['Positive', 'Hemoparasite Seen'].includes(e.target.value)) {
                                        // Auto-fill remark with positive message (species will be added if selected)
                                        const species = newResults.species || '';
                                        let remark = 'Hemoparasite seen.';
                                        if (species) remark += ` Species: ${species}.`;
                                        newResults.remark = remark;
                                      }
                                    }

                                    // Special handling for Stool: Clear parasite_type if parasite is not "Seen"
                                    const isStoolParasite = field.fieldName === 'parasite' &&
                                      (testResults[selectedService]?.labTest?.code === 'STOOL001' ||
                                        testResults[selectedService]?.labTest?.name?.toLowerCase().includes('stool'));

                                    if (isStoolParasite && e.target.value !== 'Seen') {
                                      newResults.parasite_type = '';
                                    }

                                    // Special handling for HIV: Clear remarks if result is not Positive/Reactive
                                    const isHIVResult = field.fieldName === 'result' &&
                                      testResults[selectedService]?.labTest?.code === 'HIV001';

                                    if (isHIVResult && !['Reactive', 'Positive'].includes(e.target.value)) {
                                      newResults.remarks = '';
                                    }

                                    updateTestResult(selectedService, 'results', newResults);
                                  }}
                                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCompleted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                >
                                  <option value="">-- Select --</option>
                                  {optionsList.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              );
                            })()
                          ) : field.fieldType === 'textarea' || field.fieldType === 'text' ? (
                            field.fieldType === 'textarea' ? (
                              <div>
                              <textarea
                                value={fieldValue}
                                readOnly={isCompleted}
                                disabled={(() => {
                                  // HIV: Disable remarks unless result is Positive/Reactive
                                  const isHIVRemarks = field.fieldName === 'remarks' &&
                                    testResults[selectedService]?.labTest?.code === 'HIV001';
                                  const hivResult = testResults[selectedService]?.results?.result;
                                  return isHIVRemarks && !['Reactive', 'Positive'].includes(hivResult);
                                })()}
                                onChange={(e) => {
                                  if (isCompleted) return;
                                  const newResults = { ...result.results };
                                  newResults[field.fieldName] = e.target.value;

                                  // Special handling for Blood Film / Malaria: Auto-fill remark field
                                  const isMalariaRemark = field.fieldName === 'remark' &&
                                    (testResults[selectedService]?.labTest?.code === 'PICT001' ||
                                      testResults[selectedService]?.labTest?.code === 'PBF001' ||
                                      testResults[selectedService]?.labTest?.name?.toLowerCase().includes('blood film') ||
                                      testResults[selectedService]?.labTest?.name?.toLowerCase().includes('malaria'));
                                  
                                  if (isMalariaRemark && e.target.value) {
                                    // When user manually edits remark, we don't auto-fill
                                  }

                                  updateTestResult(selectedService, 'results', newResults);
                                }}
                                onFocus={(e) => {
                                  // Auto-fill Blood Film / Malaria remark when field is focused if empty
                                  const isMalariaRemark = field.fieldName === 'remark' &&
                                    (testResults[selectedService]?.labTest?.code === 'PICT001' ||
                                      testResults[selectedService]?.labTest?.code === 'PBF001' ||
                                      testResults[selectedService]?.labTest?.name?.toLowerCase().includes('blood film') ||
                                      testResults[selectedService]?.labTest?.name?.toLowerCase().includes('malaria'));
                                  const malariaResult = testResults[selectedService]?.results?.result;

                                  if (isMalariaRemark && !e.target.value && malariaResult) {
                                    if (['Negative', 'No Hemoparasite seen'].includes(malariaResult)) {
                                      updateTestResult(selectedService, 'results', {
                                        ...testResults[selectedService].results,
                                        remark: 'No Hemoparasite seen.'
                                      });
                                    } else if (['Positive', 'Hemoparasite Seen'].includes(malariaResult)) {
                                      const species = testResults[selectedService]?.results?.species || '';
                                      let remark = 'Hemoparasite seen.';
                                      if (species) remark += ` Species: ${species}.`;
                                      updateTestResult(selectedService, 'results', {
                                        ...testResults[selectedService].results,
                                        remark
                                      });
                                    }
                                  }
                                }}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCompleted || (field.fieldName === 'remarks' &&
                                  testResults[selectedService]?.labTest?.code === 'HIV001' &&
                                  !['Reactive', 'Positive'].includes(testResults[selectedService]?.results?.result))
                                  ? 'bg-gray-100 cursor-not-allowed' : ''
                                  }`}
                                rows={3}
                                placeholder="Enter details..."
                                required={field.isRequired}
                              />
                              {field.fieldName === 'remark' && testResults[selectedService]?.labTest?.code === 'GRAM001' &&
                                testResults[selectedService]?.results?.gram_reaction === 'Mixed organisms' && (
                                <p className="mt-1 text-xs text-orange-600 font-medium">
                                  ⚠️ Mixed organisms detected — please describe in detail above
                                </p>
                              )}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={fieldValue}
                                readOnly={isCompleted}
                                onChange={(e) => {
                                  if (isCompleted) return;
                                  const newResults = { ...result.results };
                                  newResults[field.fieldName] = e.target.value;
                                  updateTestResult(selectedService, 'results', newResults);
                                }}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCompleted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                placeholder="Enter value..."
                              />
                            )
                          ) : (
                            <input
                              type="text"
                              value={fieldValue}
                              readOnly={isCompleted}
                              onChange={(e) => {
                                if (isCompleted) return;
                                const newResults = { ...result.results };
                                newResults[field.fieldName] = e.target.value;
                                updateTestResult(selectedService, 'results', newResults);
                              }}
                              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isCompleted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                              placeholder="Enter value..."
                              required={field.isRequired}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Notes
                    </label>
                    <textarea
                      value={testResults[selectedService].additionalNotes || ''}
                      readOnly={selectedOrder && selectedOrder.status === 'COMPLETED'}
                      onChange={(e) => {
                        if (selectedOrder && selectedOrder.status === 'COMPLETED') return;
                        updateTestResult(selectedService, 'additionalNotes', e.target.value);
                      }}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${selectedOrder && selectedOrder.status === 'COMPLETED' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      rows={3}
                      placeholder="Any additional notes or observations..."
                    />
                  </div>
                </>
              ) : testResults[selectedService].template ? (
                <>
                  {/* OLD SYSTEM: Show template fields */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900">{testResults[selectedService].template.name}</h4>
                    <p className="text-sm text-blue-700">{testResults[selectedService].template.description}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(testResults[selectedService].template.fields).map(([fieldName, fieldConfig]) => {
                      const result = testResults[selectedService];
                      const fieldValue = result.results?.[fieldName];
                      const fieldCheck = checkLabFieldStandard(fieldName, fieldValue, fieldConfig.unit);

                      return (
                        <div key={fieldName} className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">
                            {fieldName}
                            <span className="text-gray-400 ml-1 text-xs">(Optional)</span>
                            {fieldConfig.unit && <span className="text-gray-500 ml-1">({fieldConfig.unit})</span>}
                          </label>
                          {renderFormField(fieldName, fieldConfig, selectedService)}
                          {/* Individual Field Warning */}
                          {fieldCheck.message && (
                            <div className={`mt-1 p-2 rounded text-xs ${fieldCheck.status === 'critical'
                              ? 'bg-red-50 border border-red-200 text-red-800'
                              : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                              }`}>
                              <div className="flex items-start">
                                <AlertTriangle className={`h-3 w-3 mt-0.5 mr-1 flex-shrink-0 ${fieldCheck.status === 'critical' ? 'text-red-600' : 'text-yellow-600'
                                  }`} />
                                <span className="font-medium">{fieldCheck.message}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Overall Template Warning (if needed) */}
                  {(() => {
                    const result = testResults[selectedService];
                    const standardCheck = checkLabTemplateStandard(result.results || {}, result.template);
                    if (standardCheck.warning && standardCheck.fieldWarnings.length === 0) {
                      return (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-800">{standardCheck.warning}</p>
                              <p className="text-xs text-red-600 mt-1">
                                Fields filled: {standardCheck.filledCount} / {standardCheck.totalFields} |
                                Standard: Min {standardCheck.standard.minFields}, Recommended {standardCheck.standard.recommendedFields}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Additional Notes
                    </label>
                    <textarea
                      value={testResults[selectedService].additionalNotes || ''}
                      readOnly={selectedOrder && selectedOrder.status === 'COMPLETED'}
                      onChange={(e) => {
                        if (selectedOrder && selectedOrder.status === 'COMPLETED') return;
                        updateTestResult(selectedService, 'additionalNotes', e.target.value);
                      }}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${selectedOrder && selectedOrder.status === 'COMPLETED' ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                      rows={3}
                      placeholder="Enter any additional notes..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> This service does not have a template. Please write the test results below.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Test Results <span className="text-gray-400 ml-1 text-xs">(Optional)</span>
                    </label>
                    <textarea
                      value={testResults[selectedService].additionalNotes || ''}
                      readOnly={selectedOrder && selectedOrder.status === 'COMPLETED'}
                      onChange={(e) => {
                        if (selectedOrder && selectedOrder.status === 'COMPLETED') return;
                        updateTestResult(selectedService, 'additionalNotes', e.target.value);
                      }}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${selectedOrder && selectedOrder.status === 'COMPLETED' ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                      rows={10}
                      placeholder="Enter test results and findings here. This will be sent to the doctor... (Optional)"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Write detailed test results, findings, and any relevant information for the doctor. All fields are optional.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
            <div className="flex justify-end mt-6 pt-4 border-t">
              <button
                onClick={handleCloseServiceTemplate}
                disabled={savingPanel}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingPanel ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : 'Save & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabOrders;