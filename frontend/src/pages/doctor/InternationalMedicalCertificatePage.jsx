import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Plus, Trash2, FileCheck, User, Info, Calendar, Printer, Edit2, ChevronRight, Activity, MapPin, ClipboardList } from 'lucide-react';
import api from '../../services/api';

const InternationalMedicalCertificatePage = () => {
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Patient search state
    const [patientSearchQuery, setPatientSearchQuery] = useState('');
    const [patientResults, setPatientResults] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [isSearchingPatient, setIsSearchingPatient] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        id: null,
        patientId: '',
        visitId: '',
        certificateNo: '',
        passportNo: '',
        hasPreviousDisease: false,
        previousDiseaseDetails: '',
        hasCurrentMedicalComplains: false,
        currentMedicalComplainsDetails: '',
        height: '',
        weight: '',
        bp: '',
        bloodGroup: '',
        heent: 'Normal',
        chest: 'Normal',
        cvs: 'Normal',
        abdomen: 'Normal',
        cns: 'Normal',
        chestXRay: 'Normal',
        hiv: 'Negative',
        hbsag: 'Negative',
        vdrl: 'Negative',
        hcv: 'Negative',
        hcg: 'Negative',
        fbsRbs: 'Negative',
        finalAssessment: 'FIT',
        directoryName: ''
    });

    const fetchCertificates = async () => {
        try {
            setLoading(true);
            const response = await api.get('/international-medical-certificates/my');
            setCertificates(response.data.certificates || []);
        } catch (error) {
            console.error('Error fetching certificates:', error);
            toast.error('Failed to fetch certificates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCertificates();
    }, []);

    // Search patients as doctor types
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (patientSearchQuery.length >= 2) {
                searchPatients();
            } else {
                setPatientResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [patientSearchQuery]);

    const searchPatients = async () => {
        try {
            setIsSearchingPatient(true);
            const response = await api.get(`/patients/search?query=${patientSearchQuery}`);
            setPatientResults(response.data.patients || []);
        } catch (error) {
            console.error('Error searching patients:', error);
        } finally {
            setIsSearchingPatient(false);
        }
    };

    const handlePatientSelect = async (patient) => {
        setSelectedPatient(patient);
        setPatientSearchQuery(patient.name);
        setPatientResults([]);
        setFormData(prev => ({
            ...prev,
            patientId: patient.id
        }));
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await api.put(`/international-medical-certificates/${formData.id}`, formData);
                toast.success('Certificate updated successfully');
            } else {
                await api.post('/international-medical-certificates', formData);
                toast.success('Certificate created successfully');
            }
            resetForm();
            fetchCertificates();
        } catch (error) {
            console.error('Error saving certificate:', error);
            toast.error(error.response?.data?.message || 'Failed to save certificate');
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setIsEditing(false);
        setSelectedPatient(null);
        setPatientSearchQuery('');
        setFormData({
            id: null,
            patientId: '',
            visitId: '',
            certificateNo: '',
            passportNo: '',
            hasPreviousDisease: false,
            previousDiseaseDetails: '',
            hasCurrentMedicalComplains: false,
            currentMedicalComplainsDetails: '',
            height: '',
            weight: '',
            bp: '',
            bloodGroup: '',
            heent: 'Normal',
            chest: 'Normal',
            cvs: 'Normal',
            abdomen: 'Normal',
            cns: 'Normal',
            chestXRay: 'Normal',
            hiv: 'Negative',
            hbsag: 'Negative',
            vdrl: 'Negative',
            hcv: 'Negative',
            hcg: 'Negative',
            fbsRbs: 'Negative',
            finalAssessment: 'FIT',
            directoryName: ''
        });
    };

    const handleEdit = (cert) => {
        setSelectedPatient(cert.patient);
        setPatientSearchQuery(cert.patient.name);
        setFormData({
            ...cert,
            visitId: cert.visitId || ''
        });
        setIsEditing(true);
        setShowForm(true);
    };

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

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handlePrint = async (id) => {
        try {
            const response = await api.get(`/international-medical-certificates/${id}`);
            const cert = response.data.certificate;

            if (!cert) {
                toast.error('Could not fetch certificate details');
                return;
            }

            const printWindow = window.open('', '_blank');
            const currentDate = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>IMC - ${cert.patient?.name}</title>
                    <style>
                        @media print {
                            @page { 
                                size: A4;
                                margin: 0;
                            }
                            body { margin: 0; padding: 0; }
                        }
                        body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                            margin: 0; 
                            padding: 0;
                            color: #000;
                            line-height: 1.2;
                            font-size: 11pt;
                            background: white;
                        }
                        .container {
                            padding: 10mm 15mm;
                            min-height: 297mm;
                            box-sizing: border-box;
                        }
                        .header { 
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding-bottom: 8px; 
                            margin-bottom: 12px; 
                            border-bottom: 3px solid #2563eb;
                        }
                        .header-left {
                            display: flex;
                            align-items: center;
                            gap: 12px;
                        }
                        .logo {
                            width: 70px;
                            height: 70px;
                            object-fit: contain;
                        }
                        .clinic-name { 
                            font-size: 24px; 
                            font-weight: 800; 
                            margin: 0;
                            color: #1e40af;
                        }
                        .clinic-tagline {
                            font-size: 11px;
                            color: #64748b;
                            margin: 0;
                            font-style: italic;
                        }
                        .certificate-title { 
                            font-size: 16px; 
                            font-weight: 700; 
                            color: #000;
                            text-transform: uppercase;
                            text-decoration: underline;
                            text-align: center;
                            margin-bottom: 15px;
                        }
                        .meta-info {
                            display: flex;
                            justify-content: flex-end;
                            gap: 40px;
                            font-weight: bold;
                            margin-bottom: 10px;
                        }
                        .line-field {
                            border-bottom: 1px solid #000;
                            display: inline-block;
                            min-width: 100px;
                            padding: 0 5px;
                            font-weight: normal;
                        }
                        .patient-info-row {
                            margin-bottom: 8px;
                            display: flex;
                            flex-wrap: wrap;
                            gap: 20px;
                        }
                        .photo-box {
                            width: 100px;
                            height: 120px;
                            border: 2px solid #000;
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            float: right;
                            margin-left: 20px;
                            font-weight: bold;
                            font-size: 14px;
                        }
                        .section-title {
                            font-weight: bold;
                            text-decoration: underline;
                            margin: 15px 0 8px 0;
                            text-transform: uppercase;
                            font-size: 12pt;
                        }
                        .checkbox-item {
                            display: inline-flex;
                            align-items: center;
                            gap: 10px;
                            margin-right: 20px;
                        }
                        .box {
                            width: 20px;
                            height: 20px;
                            border: 1px solid #000;
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: bold;
                        }
                        .grid-layout {
                            display: grid;
                            grid-template-columns: 1fr 1.2fr;
                            gap: 20px;
                            margin: 15px 0;
                        }
                        .exam-box {
                            border: 2px solid #000;
                            border-radius: 15px;
                            padding: 12px;
                        }
                        .exam-row {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 6px;
                            border-bottom: 1px dotted #ccc;
                            padding-bottom: 2px;
                        }
                        .exam-label { font-weight: bold; }
                        .exam-value { font-weight: bold; }

                        .footer-note {
                            margin: 15px 0;
                            font-style: italic;
                            font-size: 10pt;
                        }
                        .signature-section {
                            margin-top: 15px;
                        }
                        .sig-row {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 12px;
                        }
                        .sig-field {
                            border-bottom: 1px solid #000;
                            min-width: 180px;
                            display: inline-block;
                            padding: 0 5px;
                        }
                        .address-footer {
                            margin-top: auto;
                            padding-top: 8px;
                            border-top: 2px solid #1e40af;
                            text-align: center;
                            font-size: 9pt;
                            color: #333;
                        }
                        .clearfix::after {
                            content: "";
                            clear: both;
                            display: table;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="header-left">
                                <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="" class="logo" onerror="this.style.display='none'">
                                <div>
                                    <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
                                    <p class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</p>
                                </div>
                            </div>
                        </div>

                        <div class="meta-info">
                            <span>Date: <span class="line-field">${formatDate(cert.createdAt)}</span></span>
                            <span>Ref No: <span class="line-field">${cert.certificateNo}</span></span>
                        </div>

                        <div class="clearfix">
                            <div class="photo-box">Photo</div>
                            <div class="patient-info-row">
                                <span>Full Name: <span class="line-field" style="min-width: 300px;">${cert.patient?.name}</span></span>
                                <span>Sex: <span class="line-field" style="min-width: 60px;">${cert.patient?.gender}</span></span>
                            </div>
                            <div class="patient-info-row">
                                <span>Date of Birth: <span class="line-field" style="min-width: 150px;">${formatDate(cert.patient?.dob)}</span></span>
                                <span>Age: <span class="line-field" style="min-width: 50px;">${calculateAge(cert.patient?.dob)}</span></span>
                            </div>
                            <div class="patient-info-row">
                                <span>Card No (MRN): <span class="line-field" style="min-width: 120px;">#${cert.patientId}</span></span>
                                <span>Passport No: <span class="line-field" style="min-width: 150px;">${cert.passportNo || 'N/A'}</span></span>
                            </div>
                        </div>

                        <div class="section-title">Applicant's Self Declaration</div>
                        <div style="margin-bottom: 10px;">
                            <span style="margin-right: 30px;">Previous Disease if any:</span>
                            <div class="checkbox-item">Yes <div class="box">${cert.hasPreviousDisease ? 'X' : ''}</div></div>
                            <div class="checkbox-item">No <div class="box">${!cert.hasPreviousDisease ? 'X' : ''}</div></div>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <span style="margin-right: 30px;">Current Medical Complains / If any:</span>
                            <div class="checkbox-item">Yes <div class="box">${cert.hasCurrentMedicalComplains ? 'X' : ''}</div></div>
                            <div class="checkbox-item">No <div class="box">${!cert.hasCurrentMedicalComplains ? 'X' : ''}</div></div>
                        </div>
                        <div style="margin-bottom: 15px;">
                            If YES SPECIFY: <span class="line-field" style="min-width: 450px;">${cert.previousDiseaseDetails || cert.currentMedicalComplainsDetails || 'None'}</span>
                        </div>

                        <div class="footer-note">
                            "I certified that the above statements are true and have no objection that the whole medical result passed to any other relevant unit / office."
                        </div>
                        <div style="margin-bottom: 15px;">
                            Name: <span class="line-field" style="min-width: 200px;">${cert.patient?.name}</span>
                            Signature: <span class="line-field" style="min-width: 150px;"></span>
                        </div>

                        <div class="section-title">Doctors / Physicians Examination Result</div>
                        <div class="patient-info-row" style="font-weight: bold; gap: 30px;">
                            <span>HEIGHT: <span class="line-field">${cert.height || '_____'} cm</span></span>
                            <span>WEIGHT: <span class="line-field">${cert.weight || '_____'} kg</span></span>
                            <span>B/P: <span class="line-field">${cert.bp || '_______'} mmHg</span></span>
                            <span>BLOOD GROUP/RH: <span class="line-field">${cert.bloodGroup || '_______'}</span></span>
                        </div>

                        <div class="grid-layout">
                            <div>
                                <div style="font-weight: bold; margin-bottom: 5px; text-decoration: underline;">Medical Examination</div>
                                <div class="exam-box">
                                    <div class="exam-row" style="border-bottom: 2px solid #000; font-weight: 900; background: #f0f0f0; margin-bottom: 10px;">
                                        <span>SYSTEM</span>
                                        <span>NORMAL/ABNORMAL</span>
                                    </div>
                                    <div class="exam-row"><span class="exam-label">HEENT</span> <span class="exam-value">${cert.heent}</span></div>
                                    <div class="exam-row"><span class="exam-label">CHEST</span> <span class="exam-value">${cert.chest}</span></div>
                                    <div class="exam-row"><span class="exam-label">CVS</span> <span class="exam-value">${cert.cvs}</span></div>
                                    <div class="exam-row"><span class="exam-label">ABDOMEN</span> <span class="exam-value">${cert.abdomen}</span></div>
                                    <div class="exam-row"><span class="exam-label">CNS</span> <span class="exam-value">${cert.cns}</span></div>
                                    <div class="exam-row" style="border-bottom: 0;"><span class="exam-label">CHEST X-RAY</span> <span class="exam-value">${cert.chestXRay}</span></div>
                                </div>
                            </div>
                            <div>
                                <div style="font-weight: bold; margin-bottom: 5px; text-decoration: underline;">Laboratory Investigation</div>
                                <div class="exam-box">
                                     <div class="exam-row" style="border-bottom: 2px solid #000; font-weight: 900; background: #f0f0f0; margin-bottom: 10px;">
                                        <span>TEST</span>
                                        <span>RESULT (NEG/POS)</span>
                                    </div>
                                    <div class="exam-row"><span class="exam-label">HIV</span> <span class="exam-value">${cert.hiv}</span></div>
                                    <div class="exam-row"><span class="exam-label">HBsAG</span> <span class="exam-value">${cert.hbsag}</span></div>
                                    <div class="exam-row"><span class="exam-label">VDRL</span> <span class="exam-value">${cert.vdrl}</span></div>
                                    <div class="exam-row"><span class="exam-label">HCV</span> <span class="exam-value">${cert.hcv}</span></div>
                                    <div class="exam-row"><span class="exam-label">HCG (Pregnancy)</span> <span class="exam-value">${cert.hcg}</span></div>
                                    <div class="exam-row" style="border-bottom: 0;"><span class="exam-label">FBS/RBS</span> <span class="exam-value">${cert.fbsRbs}</span></div>
                                </div>
                            </div>
                        </div>

                        <div style="margin: 15px 0; font-weight: 900; font-size: 14pt; display: flex; align-items: center; gap: 20px;">
                            FINAL ASSESSMENT OF THE DOCTOR / PHYSICIAN: 
                            <div style="display: flex; gap: 15px;">
                                <div class="checkbox-item">FIT <div class="box" style="width: 30px; height: 30px; font-size: 20px;">${cert.finalAssessment === 'FIT' ? 'X' : ''}</div></div>
                                <div class="checkbox-item">UNFIT <div class="box" style="width: 30px; height: 30px; font-size: 20px;">${cert.finalAssessment === 'UNFIT' ? 'X' : ''}</div></div>
                            </div>
                        </div>

                        <div class="signature-section">
                            <div class="sig-row">
                                <span>Name of Doctor: <span class="line-field" style="min-width: 250px;">${cert.doctor?.fullname?.toLowerCase().startsWith('dr.') ? cert.doctor?.fullname : `Dr. ${cert.doctor?.fullname}`}</span></span>
                                <span>Sign: <span class="line-field" style="min-width: 150px;"></span></span>
                            </div>
                        </div>

                        <div class="address-footer">
                            Address: Hawassa City AtoteWarka to Alito Asphalt road 300 m Behind to Alamura H/Berhan Church 
                            <br>Tell: 0913743989 / 0938489499
                        </div>
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
        } catch (error) {
            console.error('Error printing certificate:', error);
            toast.error('Failed to generate print document');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this certificate?')) return;
        try {
            await api.delete(`/international-medical-certificates/${id}`);
            toast.success('Certificate deleted successfully');
            fetchCertificates();
        } catch (error) {
            console.error('Error deleting certificate:', error);
            toast.error('Failed to delete certificate');
        }
    };

    const filteredCertificates = certificates.filter(c =>
        c.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.certificateNo?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: '#000' }}>International Medical History Certificate</h1>
                    <p className="text-gray-600">Generate medical reports for international travel and official use</p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all shadow-sm hover:shadow-md"
                        style={{ backgroundColor: '#2e13d1' }}
                    >
                        <Plus className="w-5 h-5" /> New Certificate
                    </button>
                )}
            </div>

            {showForm && (
                <div className="card bg-white p-6 rounded-xl shadow-md border border-gray-100 animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Activity className="w-6 h-6" style={{ color: '#2e13d1' }} />
                            {isEditing ? 'Edit IMC Certificate' : 'New IMC Certificate'}
                        </h2>
                        <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                            <Trash2 className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Section 1: Patient Selection */}
                        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                            <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <User className="w-4 h-4" /> Patient & Identification
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 relative">
                                    <label className="text-sm font-semibold text-gray-700">Patient Name / ID</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={patientSearchQuery}
                                            onChange={(e) => setPatientSearchQuery(e.target.value)}
                                            placeholder="Search existing patients..."
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            disabled={isEditing}
                                        />
                                        {isSearchingPatient && (
                                            <div className="absolute right-3 top-3">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                            </div>
                                        )}
                                    </div>
                                    {patientResults.length > 0 && !selectedPatient && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {patientResults.map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => handlePatientSelect(p)}
                                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex justify-between items-center"
                                                >
                                                    <div>
                                                        <p className="font-bold text-gray-900">{p.name}</p>
                                                        <p className="text-xs text-gray-500">ID: {p.id} • {p.gender} • {calculateAge(p.dob)} yrs</p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Passport Number</label>
                                    <input
                                        type="text"
                                        name="passportNo"
                                        value={formData.passportNo}
                                        onChange={handleInputChange}
                                        placeholder="Enter passport number"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Self Declaration */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold border-b pb-2 text-gray-800">1. Applicant's Self Declaration</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-bold">Previous Disease?</label>
                                        <input
                                            type="checkbox"
                                            name="hasPreviousDisease"
                                            checked={formData.hasPreviousDisease}
                                            onChange={handleInputChange}
                                            className="w-5 h-5 accent-blue-600"
                                        />
                                    </div>
                                    {formData.hasPreviousDisease && (
                                        <textarea
                                            name="previousDiseaseDetails"
                                            value={formData.previousDiseaseDetails}
                                            onChange={handleInputChange}
                                            placeholder="Specify previous diseases..."
                                            className="w-full p-3 border rounded-lg text-sm"
                                            rows="2"
                                        />
                                    )}
                                </div>
                                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-bold">Current Complains?</label>
                                        <input
                                            type="checkbox"
                                            name="hasCurrentMedicalComplains"
                                            checked={formData.hasCurrentMedicalComplains}
                                            onChange={handleInputChange}
                                            className="w-5 h-5 accent-blue-600"
                                        />
                                    </div>
                                    {formData.hasCurrentMedicalComplains && (
                                        <textarea
                                            name="currentMedicalComplainsDetails"
                                            value={formData.currentMedicalComplainsDetails}
                                            onChange={handleInputChange}
                                            placeholder="Specify current complains..."
                                            className="w-full p-3 border rounded-lg text-sm"
                                            rows="2"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Physical Parameters */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold border-b pb-2 text-gray-800">2. Physical Parameters</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Height (cm)</label>
                                    <input name="height" value={formData.height} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g. 175" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Weight (kg)</label>
                                    <input name="weight" value={formData.weight} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g. 70" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">B/P (mmHg)</label>
                                    <input name="bp" value={formData.bp} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g. 120/80" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Blood Group/RH</label>
                                    <input name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g. O+" />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Examination Results */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Medical Examination */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold border-b pb-2 text-gray-800">3. Medical Examination</h3>
                                <div className="space-y-3">
                                    {['heent', 'chest', 'cvs', 'abdomen', 'cns', 'chestXRay'].map(field => (
                                        <div key={field} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <label className="text-sm font-bold uppercase">{field.replace('XRay', ' X-Ray')}</label>
                                            <select name={field} value={formData[field]} onChange={handleInputChange} className="border p-2 rounded-lg text-sm min-w-[120px]">
                                                <option value="Normal">Normal</option>
                                                <option value="Abnormal">Abnormal</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Lab Investigations */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold border-b pb-2 text-gray-800">4. Lab Investigations</h3>
                                <div className="space-y-3">
                                    {['hiv', 'hbsag', 'vdrl', 'hcv', 'hcg', 'fbsRbs'].map(field => (
                                        <div key={field} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <label className="text-sm font-bold uppercase">{field.replace('fbsRbs', 'FBS/RBS')}</label>
                                            <select name={field} value={formData[field]} onChange={handleInputChange} className="border p-2 rounded-lg text-sm min-w-[120px]">
                                                <option value="Negative">Negative</option>
                                                <option value="Positive">Positive</option>
                                                <option value="N/A">N/A</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Section 5: Assessment */}
                        <div className="bg-gray-800 text-white p-6 rounded-xl shadow-inner">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <ClipboardList className="w-6 h-6" /> Final Medical Assessment
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold block mb-2">Patient's Fitness Status</label>
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, finalAssessment: 'FIT' }))}
                                            className={`flex-1 py-3 rounded-xl font-bold transition-all ${formData.finalAssessment === 'FIT' ? 'bg-green-600 shadow-lg' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        >
                                            FIT
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, finalAssessment: 'UNFIT' }))}
                                            className={`flex-1 py-3 rounded-xl font-bold transition-all ${formData.finalAssessment === 'UNFIT' ? 'bg-red-600 shadow-lg' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        >
                                            UNFIT
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t font-bold">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-2.5 rounded-xl border-2 border-gray-300 hover:bg-gray-50 transition-colors uppercase tracking-wider text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-12 py-2.5 rounded-xl text-white shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-wider text-sm"
                                style={{ backgroundColor: '#2e13d1' }}
                            >
                                {isEditing ? 'Update Document' : 'Generate Certificate'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm sticky top-0 z-10">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or Ref No..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: '#2e13d1' }}></div>
                        </div>
                    ) : filteredCertificates.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border-4 border-dashed border-gray-100">
                            <Activity className="w-20 h-20 mx-auto text-gray-200 mb-4" />
                            <p className="text-xl font-bold text-gray-400">No IMC Certificates Generated Yet</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredCertificates.map(cert => (
                                <div key={cert.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col border-t-4" style={{ borderTopColor: cert.finalAssessment === 'FIT' ? '#059669' : '#DC2626' }}>
                                    <div className="p-5 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-1">{cert.certificateNo}</div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${cert.finalAssessment === 'FIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {cert.finalAssessment}
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900 mb-1 group-hover:text-blue-700 transition-colors uppercase truncate">{cert.patient?.name}</h3>
                                        <div className="space-y-2 mt-4 text-sm font-medium text-gray-500">
                                            <div className="flex items-center gap-2"><User className="w-4 h-4" /> Card: #{cert.patientId}</div>
                                            <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Date: {formatDate(cert.createdAt)}</div>
                                            <div className="flex items-center gap-2"><Activity className="w-4 h-4" /> BP: {cert.bp || 'N/A'}</div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-between gap-2">
                                        <button
                                            onClick={() => handlePrint(cert.id)}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:text-blue-700 transition-all font-bold text-sm shadow-sm"
                                        >
                                            <Printer className="w-4 h-4" /> Print
                                        </button>
                                        <button
                                            onClick={() => handleEdit(cert)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cert.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InternationalMedicalCertificatePage;
