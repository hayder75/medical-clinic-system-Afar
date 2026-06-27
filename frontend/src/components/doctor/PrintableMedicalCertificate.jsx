import React from 'react';
import { X, Printer } from 'lucide-react';

const PrintableMedicalCertificate = ({ certificate, onClose }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) years--;
    if (years < 0) return '';
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

  const calculateTotalDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // +1 to include both start and end dates
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 print:bg-white print:p-0">
      {/* Print Controls */}
      <div className="mb-4 flex justify-between items-center print:hidden">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--dark)' }}>
          Print Medical Certificate
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-white rounded-md transition-colors flex items-center space-x-2"
            style={{ backgroundColor: 'var(--primary)' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--secondary)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--primary)'}
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center space-x-2"
          >
            <X className="h-4 w-4" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Certificate Document */}
      <div className="certificate-content bg-white shadow-lg mx-auto max-w-2xl print:shadow-none print:max-w-none print:mx-0 print:bg-white">
        {/* Header */}
        <div className="text-center py-4 border-b border-gray-300">
          <img
            src={window.__CS__?.logoUrl || '/clinic-logo.jpg'}
            alt={`${window.__CS__?.name || 'Clinic'} Logo`}
            className="h-16 w-16 mx-auto mb-2 rounded-full object-cover border-2 border-gray-300"
          />
          <h1 className="text-xl font-bold text-black">{window.__CS__?.name || 'Clinic'}</h1>
        </div>

        {/* Certificate Title */}
        <div className="text-center py-4 border-b border-gray-300">
          <div className="flex justify-between items-center">
            <div className="flex-1"></div>
            <h2 className="text-xl font-bold text-black uppercase">MEDICAL CERTIFICATE</h2>
            <div className="flex-1 text-right">
              <p className="text-sm text-black">No.: {certificate.certificateNo}</p>
            </div>
          </div>
        </div>

        {/* Patient Information */}
        <div className="py-3 border-b border-gray-300">
          <h3 className="text-sm font-bold text-black underline mb-2">Patient Information</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <p className="text-black"><strong>Name:</strong> {certificate.patient.name}</p>
            <p className="text-black"><strong>Gender:</strong> {certificate.patient.gender || '-'}</p>
            <p className="text-black"><strong>Age:</strong> {calculateAge(certificate.patient.dob)} yrs</p>
          </div>
        </div>

        {/* Certificate Details */}
        <div className="py-3 border-b border-gray-300">
          <h3 className="text-sm font-bold text-black underline mb-2">Certificate Details</h3>
          <p className="text-black text-sm"><strong>Date Issued:</strong> {formatDate(certificate.certificateDate)}</p>
        </div>

        {/* Medical Information */}
        <div className="py-3 border-b border-gray-300">
          <h3 className="text-sm font-bold text-black underline mb-2">Medical Information</h3>
          <div className="space-y-1 text-sm">
            <p className="text-black"><strong>Diagnosis:</strong> {certificate.diagnosis}</p>
            <p className="text-black"><strong>Treatment:</strong> {certificate.treatment}</p>
            {certificate.recommendations && (
              <p className="text-black"><strong>Recommendations:</strong> {certificate.recommendations}</p>
            )}
          </div>
        </div>

        {/* Rest Period */}
        <div className="py-3 border-b border-gray-300">
          <h3 className="text-sm font-bold text-black underline text-center mb-2">Rest Period</h3>
          <div className="text-center text-sm">
            <p className="text-black mb-1">
              {formatDate(certificate.restStartDate)} - {formatDate(certificate.restEndDate)}
            </p>
            <p className="text-black">
              ({calculateTotalDays(certificate.restStartDate, certificate.restEndDate)} days)
            </p>
          </div>
        </div>

        {/* Issued By */}
        <div className="py-3">
          <h3 className="text-sm font-bold text-black underline mb-2">Issued By</h3>
          <div className="text-sm">
            <p className="text-black"><strong>Dr.</strong> {certificate.doctor.fullname}</p>
            {certificate.doctor.qualifications && (
              <p className="text-black">{certificate.doctor.qualifications}</p>
            )}
          </div>
        </div>

        {/* Footer Line */}
        <div className="border-t border-gray-300 pt-4">
          <div className="text-center text-sm text-gray-600">
            <p>This certificate is issued for medical purposes only.</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-family: Arial, sans-serif !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          .print\\:max-w-none {
            max-width: none !important;
          }
          
          .print\\:mx-0 {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          
          .print\\:bg-white {
            background: white !important;
          }
          
          .print\\:p-0 {
            padding: 0 !important;
          }
          
          .bg-gray-100 {
            background: white !important;
          }
          
          .p-4 {
            padding: 0 !important;
          }
          
          .mb-4 {
            margin-bottom: 0 !important;
          }
          
          .mx-auto {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          
          /* Ensure proper page margins */
          @page {
            margin: 0.25in;
            size: A5;
          }
          
          /* Hide all navigation elements */
          nav, header, aside, .sidebar, .navigation {
            display: none !important;
          }
          
          /* Ensure certificate content fits on page */
          .certificate-content {
            page-break-inside: avoid;
            margin: 0;
            padding: 15px;
          }
          
          /* Make sure text is black for printing */
          h1, h2, h3, p, span, div {
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintableMedicalCertificate;
