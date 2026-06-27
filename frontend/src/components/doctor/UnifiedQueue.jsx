import React, { useEffect, useMemo, useState } from 'react';
import { QueueSkeleton } from '../common/Skeleton';
import useSocket from '../../hooks/useSocket';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  FlaskConical,
  Pill,
  Scan,
  Stethoscope,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import {
  DEFAULT_DOCTOR_WORKSPACE_CONFIG,
  getLocalDateInputValue,
  normalizeDoctorWorkspaceConfig
} from '../../utils/doctorWorkspace';

const sentStatuses = ['SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH', 'NURSE_SERVICES_ORDERED'];
const returnedStatuses = ['RETURNED_WITH_RESULTS', 'AWAITING_RESULTS_REVIEW'];

const UnifiedQueue = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ urgent: 0, results: 0, new: 0, total: 0, sent: 0 });
  const [completedStats, setCompletedStats] = useState({ total: 0, diagnosed: 0, medications: 0, investigations: 0 });
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState('main');
  const [triageStats, setTriageStats] = useState({ total: 0, waiting: 0, triaged: 0 });
  const [globalQueue, setGlobalQueue] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [completedDate, setCompletedDate] = useState(getLocalDateInputValue());
  const [workspaceConfig, setWorkspaceConfig] = useState(DEFAULT_DOCTOR_WORKSPACE_CONFIG);
  const [refreshKey, setRefreshKey] = useState(0);

  useSocket({
    onVisitUpdate: () => setRefreshKey(k => k + 1),
    onNewVisit: () => setRefreshKey(k => k + 1),
    onResultsReady: () => setRefreshKey(k => k + 1),
  });

  const resetCompletedStats = () => {
    setCompletedStats({ total: 0, diagnosed: 0, medications: 0, investigations: 0 });
  };

  useEffect(() => {
    setQueueFilter('main');
    fetchWorkspaceSettings();
  }, []);

  useEffect(() => {
    if (queueFilter === 'triage') {
      fetchTriageQueue();
      return;
    }

    if (queueFilter === 'completed') {
      fetchCompletedQueue();
      return;
    }

    fetchUnifiedQueue();
  }, [queueFilter, completedDate, refreshKey]);

  useEffect(() => {
    if (searchQuery.trim().length > 0 && queueFilter !== 'completed') {
      const timer = setTimeout(() => {
        fetchGlobalSearch();
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [searchQuery, queueFilter, refreshKey]);

  const fetchWorkspaceSettings = async () => {
    try {
      const response = await api.get('/doctors/workspace-settings');
      const config = normalizeDoctorWorkspaceConfig(response.data.workspaceConfig);
      setWorkspaceConfig(config);
      if (!config.completedVisitsEnabled && queueFilter === 'completed') {
        setQueueFilter('main');
      }
      if (!config.triageQueueEnabled && queueFilter === 'triage') {
        setQueueFilter('main');
      }
    } catch (error) {
      console.error('Error fetching doctor workspace settings:', error);
    }
  };

  const fetchGlobalSearch = async () => {
    try {
      setIsSearchingGlobal(true);
      const response = await api.get('/doctors/unified-queue?filter=all&includeTriage=true');
      if (response.data.success) {
        setGlobalQueue(response.data.queue);
      }
    } catch (error) {
      console.error('Error fetching global search:', error);
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  const fetchUnifiedQueue = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/doctors/unified-queue?filter=all`);
      if (response.data.success) {
        let filteredQueue = response.data.queue || [];
        setStats(response.data.stats);

        if (queueFilter === 'sent') {
          filteredQueue = filteredQueue.filter((visit) => sentStatuses.includes(visit.status));
        } else if (queueFilter === 'returned') {
          filteredQueue = filteredQueue.filter((visit) => returnedStatuses.includes(visit.status));
        } else if (queueFilter === 'main') {
          filteredQueue = filteredQueue.filter((visit) => !sentStatuses.includes(visit.status) && !returnedStatuses.includes(visit.status));
        }

        setQueue(filteredQueue);
      }
    } catch (error) {
      console.error('Error fetching unified queue:', error);
      toast.error('Failed to fetch patient queue');
    } finally {
      setLoading(false);
    }
  };

  const fetchTriageQueue = async () => {
    try {
      setLoading(true);
      const unifiedResponse = await api.get('/doctors/unified-queue?filter=main');
      if (unifiedResponse.data.success) {
        setStats(unifiedResponse.data.stats);
      }

      const response = await api.get('/doctors/triage-queue');
      if (response.data.success) {
        setQueue(response.data.queue);
        setTriageStats(response.data.stats);
        setStats((previous) => ({
          ...previous,
          total: response.data.stats.total,
          new: response.data.stats.waiting,
          awaiting: response.data.stats.triaged
        }));
      }
    } catch (error) {
      console.error('Error fetching triage queue:', error);
      toast.error('Failed to fetch triage queue');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedQueue = async () => {
    try {
      await fetchCompletedData({ includeQueue: true, showLoading: true, showErrors: true });
    } catch (error) {
      if ([403, 404].includes(error.response?.status)) {
        setQueueFilter('main');
      }
    }
  };

  const fetchCompletedData = async ({ includeQueue, showLoading, showErrors }) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const response = await api.get(`/doctors/completed-visits?date=${completedDate}`);
      if (response.data.success) {
        setCompletedStats(response.data.stats);
        if (includeQueue) {
          setQueue(response.data.queue);
        }
      }
    } catch (error) {
      if (showErrors) {
        console.error('Error fetching completed visits:', error);
        toast.error(error.response?.data?.error || 'Failed to fetch completed visits');
      }

      if (includeQueue) {
        setQueue([]);
      }

      resetCompletedStats();

      const statusCode = error.response?.status;
      if (!showErrors && (statusCode === 403 || statusCode === 404)) {
        return;
      }

      throw error;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handlePatientSelect = (visit) => {
    const modeQuery = queueFilter === 'completed'
      ? '?mode=completed'
      : queueFilter === 'triage'
        ? '?mode=triage'
        : '';
    navigate(`/doctor/consultation/${visit.id}${modeQuery}`);
  };

  const searchSource = useMemo(() => {
    if (searchQuery.trim().length > 0 && queueFilter !== 'completed') {
      return globalQueue;
    }
    return queue;
  }, [globalQueue, queue, queueFilter, searchQuery]);

  const filteredQueue = searchSource.filter((visit) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = visit.patient?.name?.toLowerCase().includes(query);
    const phoneMatch = visit.patient?.mobile?.includes(searchQuery);
    const idMatch = String(visit.patient?.id || '').includes(searchQuery);
    const statusMatch = visit.status?.toLowerCase().includes(query);
    const diagnosisMatch = String(visit.diagnosis || visit.diagnosisDetails || '').toLowerCase().includes(query);
    return nameMatch || phoneMatch || idMatch || statusMatch || diagnosisMatch;
  });

  const displayCount = searchQuery.trim().length > 0
    ? filteredQueue.length
    : queueFilter === 'completed'
      ? completedStats.total
      : stats.total;

  const getPriorityText = (priority) => {
    switch (priority) {
      case 1:
        return 'URGENT';
      case 2:
        return 'RESULTS READY';
      case 3:
        return 'NEW CONSULTATION';
      case 4:
        return 'TRIAGE';
      default:
        return 'PENDING';
    }
  };

  const formatShortTime = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStandardCard = (visit, index) => (
    <div
      key={visit.id}
      onClick={() => handlePatientSelect(visit)}
      className="relative cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] animate-in slide-in-from-left-4 fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={`bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${visit.priority === 1 ? 'border-red-200 shadow-red-100' : visit.priority === 2 ? 'border-yellow-200 shadow-yellow-100' : visit.priority === 4 ? 'border-purple-200 shadow-purple-100' : 'border-gray-200'}`}>
        <div className={`h-1 w-full ${visit.priority === 1 ? 'bg-red-500 animate-pulse' : visit.priority === 2 ? 'bg-yellow-500' : visit.priority === 4 ? 'bg-purple-500' : 'bg-blue-500'}`} />
        <div className="p-4 bg-gradient-to-br from-white to-gray-50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${visit.priority === 1 ? 'bg-red-100' : visit.priority === 2 ? 'bg-yellow-100' : visit.priority === 4 ? 'bg-purple-100' : 'bg-blue-100'}`}>
                <User className={`w-5 h-5 ${visit.priority === 1 ? 'text-red-600' : visit.priority === 2 ? 'text-yellow-600' : visit.priority === 4 ? 'text-purple-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg" style={{ color: '#0C0E0B' }}>{visit.patient?.name}</h3>
                <p className="text-sm text-gray-500 font-mono">#{visit.patient?.id}</p>
                {visit.notes?.startsWith('Transferred from') && (
                  <div className="flex items-center gap-1.5 mt-1.5 bg-purple-50 border-l-4 border-purple-500 rounded-r-md px-3 py-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-purple-700">{visit.notes.replace(/^Transferred from /, '').split(' - ')[0]}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {visit.isEmergency && (
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  EMERGENCY
                </div>
              )}
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${visit.priority === 1 ? 'bg-red-100 text-red-700' : visit.priority === 2 ? 'bg-yellow-100 text-yellow-700' : visit.priority === 4 ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {getPriorityText(visit.priority)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="capitalize font-medium">{visit.patient?.type || 'Regular'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="capitalize font-medium">{visit.patient?.gender || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="font-medium">{visit.patient?.mobile || 'No phone'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="font-medium">{visit.patient?.bloodType || 'Unknown'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 font-medium">{formatShortTime(visit.createdAt)}</span>
            </div>
            <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${visit.status === 'WAITING_FOR_DOCTOR' ? 'bg-blue-100 text-blue-700 border border-blue-200' : visit.status === 'IN_DOCTOR_QUEUE' ? 'bg-green-100 text-green-700 border border-green-200' : visit.status === 'UNDER_DOCTOR_REVIEW' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : visit.status === 'AWAITING_RESULTS_REVIEW' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
              {visit.status.replace(/_/g, ' ')}
            </div>
          </div>

          {visit.appointmentLabel && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">APPOINTMENT: {visit.appointmentLabel.type}</span>
              </div>
              {visit.appointmentLabel.reason && <p className="text-xs text-blue-600 mt-1">{visit.appointmentLabel.reason}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCompletedCard = (visit, index) => {
    const diagnosisText = String(visit.diagnosis || visit.diagnosisDetails || visit.notes || '').trim();
    const completedDateValue = visit.completedAt ? new Date(visit.completedAt) : null;
    const hasValidCompletedDate = completedDateValue && !Number.isNaN(completedDateValue.getTime()) && completedDateValue.getFullYear() >= 2000;
    const openedDateValue = visit.createdAt ? new Date(visit.createdAt) : null;
    const openedDateText = openedDateValue && !Number.isNaN(openedDateValue.getTime())
      ? openedDateValue.toLocaleString()
      : 'N/A';
    const completedDateText = hasValidCompletedDate
      ? completedDateValue.toLocaleString()
      : 'Not recorded';

    return (
      <div
        key={visit.id}
        onClick={() => handlePatientSelect(visit)}
        className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.01] animate-in slide-in-from-left-4 fade-in"
        style={{ animationDelay: `${index * 40}ms` }}
      >
        <div className="bg-white rounded-xl border border-emerald-100 shadow-sm hover:shadow-md overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <div className="p-4 space-y-3 bg-gradient-to-br from-white via-emerald-50/20 to-cyan-50/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold" style={{ color: '#0C0E0B' }}>{visit.patient?.name}</h3>
                <p className="text-xs text-gray-500 font-mono">#{visit.patient?.id}</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Completed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Opened</p>
                <p className="mt-1 font-semibold text-slate-900 leading-snug">{openedDateText}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-white px-2.5 py-2">
                <p className="text-[10px] font-semibold tracking-wide text-emerald-700 uppercase">Finished</p>
                <p className="mt-1 font-semibold text-slate-900 leading-snug">{completedDateText}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">{visit.patient?.gender || 'Unknown gender'}</div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">{visit.patient?.mobile || 'No phone'}</div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Clinical Summary</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-700">
                {diagnosisText ? diagnosisText.slice(0, 220) : 'No diagnosis summary was recorded for this visit.'}
                {diagnosisText.length > 220 ? '...' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <QueueSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 mb-6 bg-white shadow-sm border border-gray-100 rounded-xl">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
            placeholder={queueFilter === 'completed' ? 'Search completed visits by patient, phone, diagnosis, or ID...' : 'Search by patient name, phone number, or ID...'}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8 w-full">
        <button
          onClick={() => setQueueFilter('main')}
          className={`flex-1 px-4 py-4 font-bold text-center text-sm md:text-base rounded-xl transition-all shadow-sm ${queueFilter === 'main' ? 'shadow-md transform scale-[1.02]' : 'hover:opacity-90 hover:shadow-md'}`}
          style={{ backgroundColor: queueFilter === 'main' ? '#DBEAFE' : '#EFF6FF', color: queueFilter === 'main' ? '#1E40AF' : '#3B82F6', border: queueFilter === 'main' ? '2px solid #3B82F6' : '2px solid #BFDBFE' }}
        >
          Main Queue ({stats.mainQueue !== undefined ? stats.mainQueue : stats.total})
        </button>
        <button
          onClick={() => setQueueFilter('returned')}
          className={`flex-1 px-4 py-4 font-bold text-center text-sm md:text-base rounded-xl transition-all shadow-sm ${queueFilter === 'returned' ? 'shadow-md transform scale-[1.02]' : 'hover:opacity-90 hover:shadow-md'}`}
          style={{ backgroundColor: queueFilter === 'returned' ? '#D1FAE5' : '#ECFDF5', color: queueFilter === 'returned' ? '#065F46' : '#059669', border: queueFilter === 'returned' ? '2px solid #10B981' : '2px solid #A7F3D0' }}
        >
          Returned from Lab/Radiology ({stats.returnedQueue || 0})
        </button>
        <button
          onClick={() => setQueueFilter('sent')}
          className={`flex-1 px-4 py-4 font-bold text-center text-sm md:text-base rounded-xl transition-all shadow-sm ${queueFilter === 'sent' ? 'shadow-md transform scale-[1.02]' : 'hover:opacity-90 hover:shadow-md'}`}
          style={{ backgroundColor: queueFilter === 'sent' ? '#FDE68A' : '#FEF3C7', color: queueFilter === 'sent' ? '#92400E' : '#D97706', border: queueFilter === 'sent' ? '2px solid #F59E0B' : '2px solid #FCD34D' }}
        >
          Waiting for Lab/Radiology ({stats.sentQueue || 0})
        </button>
        {workspaceConfig.triageQueueEnabled && (
          <button
            onClick={() => setQueueFilter('triage')}
            className={`flex-1 px-4 py-4 font-bold text-center text-sm md:text-base rounded-xl transition-all shadow-sm ${queueFilter === 'triage' ? 'shadow-md transform scale-[1.02]' : 'hover:opacity-90 hover:shadow-md'}`}
            style={{ backgroundColor: queueFilter === 'triage' ? '#D1FAE5' : '#ECFDF5', color: queueFilter === 'triage' ? '#065F46' : '#059669', border: queueFilter === 'triage' ? '2px solid #10B981' : '2px solid #A7F3D0' }}
          >
            Triage ({stats.triageQueue !== undefined ? stats.triageQueue : triageStats.total || 0})
          </button>
        )}
        {workspaceConfig.completedVisitsEnabled && (
          <button
            onClick={() => setQueueFilter('completed')}
            className={`flex-1 px-4 py-4 font-bold text-center text-sm md:text-base rounded-xl transition-all shadow-sm ${queueFilter === 'completed' ? 'shadow-md transform scale-[1.02]' : 'hover:opacity-90 hover:shadow-md'}`}
            style={{ backgroundColor: queueFilter === 'completed' ? '#D1FAE5' : '#ECFDF5', color: queueFilter === 'completed' ? '#065F46' : '#047857', border: queueFilter === 'completed' ? '2px solid #10B981' : '2px solid #A7F3D0' }}
          >
            Completed Visits ({completedStats.total || 0})
          </button>
        )}
      </div>

      {queueFilter === 'completed' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-emerald-700">{completedStats.total || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Diagnosed</p>
                  <p className="text-2xl font-bold text-slate-800">{completedStats.diagnosed || 0}</p>
                </div>
                <Stethoscope className="w-8 h-8 text-slate-600" />
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">With Medications</p>
                  <p className="text-2xl font-bold text-pink-700">{completedStats.medications || 0}</p>
                </div>
                <Pill className="w-8 h-8 text-pink-600" />
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">With Investigations</p>
                  <p className="text-2xl font-bold text-sky-700">{completedStats.investigations || 0}</p>
                </div>
                <FlaskConical className="w-8 h-8 text-sky-600" />
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#0C0E0B' }}>
                {searchQuery.trim().length > 0 ? `Completed Visit Search (${displayCount})` : `Completed Visits (${displayCount})`}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Review finished consultations using the same consultation page in restricted mode. Ordering and completion actions stay disabled there.
              </p>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Review Date
              <input
                type="date"
                value={completedDate}
                onChange={(event) => setCompletedDate(event.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          </div>
        </>
      ) : (
        <div className={`grid grid-cols-1 ${queueFilter === 'sent' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6 w-full`}>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Urgent</p>
                <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Results Ready</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.results}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">New Consultations</p>
                <p className="text-2xl font-bold" style={{ color: '#2e13d1' }}>{stats.new}</p>
              </div>
              <Stethoscope className="w-8 h-8" style={{ color: '#2e13d1' }} />
            </div>
          </div>
          {queueFilter === 'sent' && (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Sent Patients</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.sent || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        <div>
          {queueFilter !== 'completed' && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#0C0E0B' }}>
                {searchQuery.trim().length > 0 ? `Search Results for "${searchQuery}" (${displayCount})` : queueFilter === 'main' ? `Main Patient Queue (${displayCount})` : queueFilter === 'sent' ? `Waiting for Lab/Radiology/Nurse (${displayCount})` : queueFilter === 'returned' ? `Returned with Results (${displayCount})` : `Triage Queue (${displayCount})`}
              </h2>
              {queueFilter === 'sent' && <p className="text-sm text-gray-600 mt-1">Patients who have been sent to lab, radiology, or nurse services. They will return to the main queue when services are completed.</p>}
              {queueFilter === 'triage' && <p className="text-sm text-gray-600 mt-1">Patients waiting for triage or already triaged. Open a patient to continue triage from the consultation page.</p>}
            </div>
          )}

          {filteredQueue.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Stethoscope className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {searchQuery ? 'No matching patients found' : queueFilter === 'completed' ? 'No completed visits for this date' : 'No patients in queue'}
              </h3>
              <p className="text-gray-500">
                {searchQuery ? 'Try adjusting your search query' : queueFilter === 'completed' ? 'Choose another date or wait for completed visits to appear.' : 'Patients will appear here when they are ready for consultation.'}
              </p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${queueFilter === 'completed' ? 'xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
              {filteredQueue.map((visit, index) => (
                queueFilter === 'completed' ? renderCompletedCard(visit, index) : renderStandardCard(visit, index)
              ))}
            </div>
          )}
        </div>
      </div>

      {isSearchingGlobal && queueFilter !== 'completed' && <p className="text-sm text-gray-500">Updating search results...</p>}
    </div>
  );
};

export default UnifiedQueue;