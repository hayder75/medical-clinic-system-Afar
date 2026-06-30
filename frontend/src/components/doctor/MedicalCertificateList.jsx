import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Search, Plus, Edit, Trash2, Eye, Download, Calendar, User, FileText, Printer } from 'lucide-react';
import api from '../../services/api';
import MedicalCertificateForm from './MedicalCertificateForm';
import { getImageUrl } from '../../utils/imageUrl';

const MedicalCertificateList = () => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  const fetchCertificates = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const response = await api.get('/medical-certificates', {
        params: {
          page,
          limit: pagination.limit,
          search,
        }
      });

      setCertificates(response.data?.certificates || []);
      setPagination(response.data?.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
    } catch (error) {
      console.error('Error fetching certificates:', error);
      toast.error('Failed to fetch certificates');
      setCertificates([]);
      setPagination({ page: 1, limit: 10, total: 0, pages: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCertificates(1, searchQuery);
  };

  const handlePageChange = (newPage) => {
    fetchCertificates(newPage, searchQuery);
  };

  const handleCreateNew = () => {
    setEditingCertificate(null);
    setShowForm(true);
  };

  const handleEdit = (certificate) => {
    setEditingCertificate(certificate);
    setShowForm(true);
  };

  const handleDelete = async (certificate) => {
    if (!window.confirm(`Are you sure you want to delete certificate ${certificate.certificateNo}?`)) {
      return;
    }

    try {
      await api.delete(`/medical-certificates/${certificate.id}`);
      toast.success('Certificate deleted successfully');
      fetchCertificates(pagination.page, searchQuery);
    } catch (error) {
      console.error('Error deleting certificate:', error);
      toast.error('Failed to delete certificate');
    }
  };

  const handleGeneratePDF = async (certificate) => {
    try {
      const response = await api.get(`/medical-certificates/${certificate.id}/pdf`);

      // Create a temporary link to download the PDF
      const link = document.createElement('a');
      link.href = getImageUrl(response.data.filePath);
      link.download = response.data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handlePrint = (certificate) => {
    // Create a temporary print component
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medical Certificate - ${certificate.certificateNo}</title>
          <style>
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              font-family: 'Segoe UI', Arial, sans-serif !important;
            }
            
            @page {
              margin: 0;
              size: A4;
            }
            
            .certificate-content {
              page-break-after: avoid;
              margin: 0;
              padding: 10mm 15mm;
              max-width: none;
            }
            
            h1, h2, h3, p, span, div {
              color: black !important;
            }
            
            .text-center { text-align: center; }
            .text-3xl { font-size: 20px; }
            .text-2xl { font-size: 18px; }
            .text-lg { font-size: 14px; }
            .text-base { font-size: 13px; }
            .text-sm { font-size: 11px; }
            .text-xs { font-size: 10px; }
            .font-bold { font-weight: bold; }
            .font-semibold { font-weight: 600; }
            .uppercase { text-transform: uppercase; }
            .underline { text-decoration: underline; }
            .border-b { border-bottom: 1px solid #ccc; }
            .border-gray-300 { border-color: #ccc; }
            .py-8 { padding-top: 16px; padding-bottom: 16px; }
            .py-6 { padding-top: 12px; padding-bottom: 12px; }
            .py-4 { padding-top: 8px; padding-bottom: 8px; }
            .py-2 { padding-top: 4px; padding-bottom: 4px; }
            .mb-4 { margin-bottom: 8px; }
            .mb-2 { margin-bottom: 4px; }
            .mb-1 { margin-bottom: 2px; }
            .space-y-2 > * + * { margin-top: 4px; }
            .space-y-4 > * + * { margin-top: 8px; }
            .space-y-1 > * + * { margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="certificate-content">
            ${generateCertificateHTML(certificate)}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const generateCertificateHTML = (certificate) => {
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
      return diffDays + 1;
    };

    return `
      <style>
        .certificate-header { 
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 15px; 
          margin-bottom: 25px; 
          border-bottom: 3px solid #2563eb;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .logo {
          width: 80px;
          height: 80px;
          border-radius: 50%; object-fit: cover;
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
          font-size: 11px;
          color: #64748b;
          margin: 0;
          font-style: italic;
        }
        .cert-title-section {
          text-align: center;
          margin-bottom: 25px;
        }
        .cert-title {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 5px;
        }
        .cert-no {
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .info-box {
          padding: 15px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        .info-title {
          font-size: 12px;
          font-weight: 700;
          color: #1e40af;
          text-transform: uppercase;
          margin-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 5px;
        }
        .info-row {
          display: flex;
          margin-bottom: 6px;
          font-size: 13px;
        }
        .info-label {
          font-weight: 600;
          color: #64748b;
          width: 100px;
        }
        .info-value {
          color: #1e293b;
          font-weight: 700;
        }
        .medical-content {
          margin-bottom: 25px;
          padding: 15px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        .diagnosis-box {
          margin-bottom: 15px;
        }
        .diagnosis-label {
          font-size: 12px;
          font-weight: 700;
          color: #1e40af;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .diagnosis-text {
          font-size: 14px;
          color: #1e293b;
          line-height: 1.5;
          font-weight: 500;
        }
        .rest-period-box {
          text-align: center;
          padding: 15px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          margin-bottom: 25px;
        }
        .rest-title {
          font-size: 14px;
          font-weight: 700;
          color: #0369a1;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .rest-dates {
          font-size: 16px;
          font-weight: 800;
          color: #0c4a6e;
        }
        .rest-days {
          font-size: 13px;
          color: #0369a1;
          margin-top: 4px;
          font-style: italic;
        }
        .cert-footer {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .doctor-sign-box {
          text-align: center;
        }
        .sign-line {
          width: 220px;
          border-top: 2px solid #0f172a;
          margin-bottom: 5px;
        }
        .sign-label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
        }
      </style>

      <div class="certificate-header">
        <div class="header-left">
          <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="Clinic Logo" class="logo" onerror="this.style.display='none'">
          <div class="clinic-info">
            <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
            <p class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</p>
          </div>
        </div>
        <div class="header-right">
          <div class="cert-no">Certificate No: ${certificate.certificateNo}</div>
          <div class="cert-no">Date Issued: ${formatDate(certificate.certificateDate)}</div>
        </div>
      </div>

      <div class="cert-title-section">
        <h2 class="cert-title">Medical Certificate</h2>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <div class="info-title">Patient Information</div>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${certificate.patient.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Gender:</span>
            <span class="info-value">${certificate.patient.gender || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Age:</span>
            <span class="info-value">${calculateAge(certificate.patient.dob)} Years</span>
          </div>
        </div>
        <div class="info-box">
          <div class="info-title">Doctor Information</div>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">Dr. ${certificate.doctor.fullname}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Qualification:</span>
            <span class="info-value">${certificate.doctor.qualifications?.join(', ') || 'General Practitioner'}</span>
          </div>
        </div>
      </div>

      <div class="medical-content">
        <div class="diagnosis-box">
          <div class="diagnosis-label">Diagnosis / Clinical Findings</div>
          <div class="diagnosis-text">${certificate.diagnosis}</div>
        </div>
        ${certificate.treatment ? `
          <div class="diagnosis-box">
            <div class="diagnosis-label">Treatment Provided</div>
            <div class="diagnosis-text">${certificate.treatment}</div>
          </div>
        ` : ''}
        ${certificate.recommendations ? `
          <div class="diagnosis-box">
            <div class="diagnosis-label">Medical Recommendations</div>
            <div class="diagnosis-text">${certificate.recommendations}</div>
          </div>
        ` : ''}
      </div>

      ${certificate.restStartDate && certificate.restEndDate ? `
      <div class="rest-period-box">
        <div class="rest-title">Recommended Rest Period</div>
        <div class="rest-dates">
          From ${formatDate(certificate.restStartDate)} to ${formatDate(certificate.restEndDate)}
        </div>
        <div class="rest-days">
          (Total of ${calculateTotalDays(certificate.restStartDate, certificate.restEndDate)} days)
        </div>
      </div>
      ` : ''}

      ${certificate.appointmentDate ? `
      <div class="rest-period-box" style="background: #fdf4ff; border-color: #f5d0fe;">
        <div class="rest-title" style="color: #86198f;">Upcoming Appointment</div>
        <div class="rest-dates" style="color: #4a044e; font-size: 14px; font-weight: 600;">
          The patient has an appointment on ${formatDate(certificate.appointmentDate)}
        </div>
      </div>
      ` : ''}

      <div class="cert-footer">
        <div class="doctor-sign-box">
          <!-- Left side spacer if needed, previously stamp -->
        </div>
        <div class="doctor-sign-box">
          <div class="sign-line"></div>
          <div class="sign-label">Doctor's Signature</div>
          <div class="info-value" style="font-size: 12px; margin-top: 5px;">Dr. ${certificate.doctor.fullname}</div>
        </div>
      </div>
    `;
  };

  const handleFormSave = (certificate) => {
    setShowForm(false);
    setEditingCertificate(null);
    fetchCertificates(pagination.page, searchQuery);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingCertificate(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'EXPIRED':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (showForm) {
    return (
      <MedicalCertificateForm
        certificate={editingCertificate}
        onSave={handleFormSave}
        onCancel={handleFormCancel}
        isEditing={!!editingCertificate}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--dark)' }}>
            Medical Certificates
          </h1>
          <p className="text-gray-600 mt-1">
            Manage patient medical certificates and sick leave documents
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 text-white rounded-md transition-colors flex items-center space-x-2"
          style={{ backgroundColor: 'var(--primary)' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--secondary)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--primary)'}
        >
          <Plus className="h-5 w-5" />
          <span>Create Certificate</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-md p-4 w-full max-w-full overflow-hidden">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 w-full">
          <div className="flex-1 relative min-w-0">
            <input
              type="text"
              placeholder="Search by certificate number, patient name, or diagnosis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 pl-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                borderColor: 'var(--primary)',
                '--tw-ring-color': 'var(--primary)'
              }}
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-white rounded-md transition-colors whitespace-nowrap flex-shrink-0"
            style={{ backgroundColor: 'var(--primary)' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--secondary)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--primary)'}
          >
            Search
          </button>
        </form>
      </div>

      {/* Certificates List */}
      <div className="bg-white rounded-lg shadow-md">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'var(--primary)' }}></div>
            <p className="mt-2 text-gray-600">Loading certificates...</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No certificates found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery ? 'Try adjusting your search criteria' : 'Create your first medical certificate'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Certificate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Doctor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rest Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {certificates.map((certificate) => (
                    <tr key={certificate.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--dark)' }}>
                            {certificate.certificateNo}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(certificate.certificateDate)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--dark)' }}>
                            {certificate.patient.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {certificate.patient.id}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: 'var(--dark)' }}>
                          {certificate.doctor.fullname}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          {certificate.restStartDate && certificate.restEndDate ? (
                            <>
                              <div className="text-sm" style={{ color: 'var(--dark)' }}>
                                {formatDate(certificate.restStartDate)} - {formatDate(certificate.restEndDate)}
                              </div>
                              <div className="text-sm text-gray-500">
                                ({certificate.totalDays} days)
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-400 italic text-sm">No rest prescribed</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(certificate.status)}`}>
                          {certificate.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handlePrint(certificate)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Print Certificate"
                          >
                            <Printer className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleGeneratePDF(certificate)}
                            className="text-green-600 hover:text-green-900 transition-colors"
                            title="Generate PDF"
                          >
                            <Download className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(certificate)}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(certificate)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} results
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm">
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MedicalCertificateList;
