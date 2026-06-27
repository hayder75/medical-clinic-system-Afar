import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Pill, 
  Calendar,
  Save,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ContinuousInfusionProgress = ({ 
  infusion, 
  onUpdate, 
  visitId, 
  patientId 
}) => {
  const [dailyTasks, setDailyTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (infusion && infusion.id) {
      fetchDailyTasks();
    }
  }, [infusion]);

  const fetchDailyTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/continuous-infusions/${infusion.id}/tasks`);
      setDailyTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Error fetching daily tasks:', error);
      toast.error('Failed to fetch daily tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleDayCompletion = async (taskId, completed) => {
    try {
      setSaving(true);
      await api.put(`/continuous-infusions/tasks/${taskId}/complete`, {
        completed,
        notes: completed ? 'Daily dose administered' : 'Marked as not completed'
      });
      
      // Update local state
      setDailyTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, completed, administeredAt: completed ? new Date() : null }
            : task
        )
      );
      
      toast.success(completed ? 'Day marked as completed' : 'Day marked as pending');
      
      // Notify parent component
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteInfusion = async () => {
    try {
      setSaving(true);
      await api.put(`/continuous-infusions/${infusion.id}/status`, {
        status: 'COMPLETED'
      });
      
      toast.success('Continuous infusion completed successfully');
      
      // Notify parent component
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error completing infusion:', error);
      toast.error('Failed to complete infusion');
    } finally {
      setSaving(false);
    }
  };

  if (!infusion || !infusion.id) {
    return (
      <div className="flex items-center justify-center p-4">
        <AlertCircle className="h-6 w-6 text-red-600" />
        <span className="ml-2 text-red-600">No continuous infusion data available</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Clock className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2">Loading infusion progress...</span>
      </div>
    );
  }

  const completedDays = dailyTasks.filter(task => task.completed).length;
  const totalDays = dailyTasks.length;
  const isFullyCompleted = completedDays === totalDays;
  const progressPercentage = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Pill className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Continuous Infusion Progress
            </h3>
            <p className="text-sm text-gray-600">
              {infusion.medicationOrder?.name} - {infusion.dailyDose}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-gray-600">Visit ID: {visitId}</div>
          <div className="text-sm text-gray-600">Patient: {patientId}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Progress: {completedDays}/{totalDays} days
          </span>
          <span className="text-sm text-gray-600">
            {Math.round(progressPercentage)}% complete
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Daily Progress Grid */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">
          Daily Administration Schedule
        </h4>
        
        <div className="grid grid-cols-7 gap-3">
          {dailyTasks.map((task, index) => {
            const taskDate = new Date(task.scheduledFor);
            const isToday = taskDate.toDateString() === new Date().toDateString();
            const isPast = taskDate < new Date() && !task.completed;
            
            return (
              <div
                key={task.id}
                className={`
                  relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                  ${task.completed 
                    ? 'bg-green-50 border-green-300 text-green-800' 
                    : isPast 
                      ? 'bg-red-50 border-red-300 text-red-800'
                      : isToday
                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                        : 'bg-gray-50 border-gray-300 text-gray-600'
                  }
                  hover:shadow-md
                `}
                onClick={() => handleDayCompletion(task.id, !task.completed)}
              >
                {/* Day Number */}
                <div className="text-center">
                  <div className="text-lg font-bold">
                    {taskDate.getDate()}
                  </div>
                  <div className="text-xs">
                    {taskDate.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                </div>
                
                {/* Status Icon */}
                <div className="absolute top-1 right-1">
                  {task.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : isPast ? (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                
                {/* Day Label */}
                <div className="text-xs text-center mt-1">
                  Day {index + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status and Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isFullyCompleted ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm font-medium text-gray-700">
              {isFullyCompleted ? 'Infusion Complete' : 'In Progress'}
            </span>
          </div>
          
          {infusion.status && (
            <div className="px-3 py-1 bg-gray-100 rounded-full">
              <span className="text-xs font-medium text-gray-600">
                {infusion.status}
              </span>
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          {isFullyCompleted && infusion.status !== 'COMPLETED' && (
            <button
              onClick={handleCompleteInfusion}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {saving ? 'Completing...' : 'Complete Infusion'}
            </button>
          )}
          
          <button
            onClick={fetchDailyTasks}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-start space-x-2">
          <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Instructions:</strong> Click on each day's box to mark the injection as administered. 
            Green boxes indicate completed days, red boxes indicate missed days, and blue boxes indicate today's dose.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContinuousInfusionProgress;
