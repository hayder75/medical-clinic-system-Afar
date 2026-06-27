import React from 'react';
import { Users, Calendar, Phone, CreditCard, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReceptionDashboard = () => {
  const navigate = useNavigate();

  const dashboardCards = [
    {
      title: 'Patient Registration & Visit Creation',
      description: 'Register new patients or create visits for existing patients',
      icon: Users,
      color: 'bg-blue-500',
      link: '/reception/register'
    },
    {
      title: 'Patient Management',
      description: 'Manage patient card status, activation, and billing',
      icon: Calendar,
      color: 'bg-green-500',
      link: '/reception/patients'
    },
    {
      title: 'Appointments Management',
      description: 'View all appointments and send patients to doctor queue',
      icon: Clock,
      color: 'bg-purple-500',
      link: '/reception/appointments'
    },
    {
      title: 'Pre-Registration',
      description: 'Handle phone call registrations and appointments',
      icon: Phone,
      color: 'bg-orange-500',
      link: '/reception/pre-registration'
    },
    {
      title: 'Billing Status',
      description: 'View pending billings and payment status',
      icon: CreditCard,
      color: 'bg-red-500',
      link: '/billing'
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reception Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to the reception management system</p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {dashboardCards.map((card, index) => {
          const IconComponent = card.icon;
          return (
            <div
              key={index}
              onClick={() => navigate(card.link)}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
            >
              <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                <IconComponent className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h3>
              <p className="text-sm text-gray-600">{card.description}</p>
            </div>
          );
        })}
      </div>

      {/* Important Notes Section */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">System Workflow</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Step 1:</strong> Register patient with basic info — <em>no card billing at registration</em></li>
                <li><strong>Step 2:</strong> Create visit — patient is sent to nurse triage immediately</li>
                <li><strong>Step 3:</strong> Nurse triages, assigns doctor — card type auto-determined from doctor's <code>requiredCardType</code></li>
                <li><strong>Step 4:</strong> If card activation/upgrade needed, billing is auto-created and sent to billing</li>
                <li><strong>Step 5:</strong> Patient pays at billing → visit proceeds to doctor queue</li>
                <li><strong>Emergency:</strong> Emergency visits bypass upfront payment — services are tracked and billed together</li>
                <li>No money handling at reception — all payments processed by billing department</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceptionDashboard;

