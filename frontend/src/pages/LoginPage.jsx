import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Heart, Shield, Users, Activity, Stethoscope, Droplets } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const roleRoutes = {
        ADMIN: '/admin', DOCTOR: '/doctor/dashboard', NURSE: '/nurse',
        RECEPTIONIST: '/reception', BILLING_OFFICER: '/billing',
        PHARMACY_BILLING_OFFICER: '/pharmacy-billing', PHARMACIST: '/pharmacy',
        LAB_TECHNICIAN: '/lab', RADIOLOGIST: '/radiology', REPORT: '/report',
        INVENTORY_MANAGER: '/inventory'
      };
      navigate(roleRoutes[user.role] || '/login', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await api.get('/auth/login-users');
        setUsers(response.data.users || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setFormData({
      ...formData,
      username: user.username
    });
  };

  const formatUserLabel = (user) => {
    if (user.role === 'DOCTOR') {
      const prefix = user.fullname?.startsWith('Dr.') ? '' : 'Dr. ';
      return `${prefix}${user.fullname || user.username}${user.specialty ? ` - ${user.specialty}` : ''}`;
    }
    if (user.role === 'ADMIN') return `${user.fullname || user.username} - 🔑 Admin`;
    return `${user.fullname || user.username} - ${user.role}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (users.length > 0 && !selectedUser) {
      toast.error('Please select a user from the dropdown');
      return;
    }

    if (!formData.username) {
      toast.error('Please select a user or enter username');
      return;
    }

    setLoading(true);

    try {
      const result = await login(formData);

      if (result.success) {
        toast.success('Login successful!');
        navigate('/');
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      toast.error('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-200/40 to-cyan-200/20 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-indigo-200/30 to-blue-200/20 blur-[100px]" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-gradient-to-br from-sky-200/20 to-blue-100/10 blur-[80px]" />
      </div>

      {/* Subtle pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-[size:32px_32px] opacity-30 pointer-events-none" />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(3deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(-2deg); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 7s ease-in-out infinite 1.5s; }
        .animate-slide-up { animation: slide-up 0.5s ease-out forwards; }
        .animate-slide-up-delayed { animation: slide-up 0.5s ease-out 0.15s forwards; opacity: 0; }
        .animate-slide-up-delayed-2 { animation: slide-up 0.5s ease-out 0.3s forwards; opacity: 0; }
      `}</style>

      <div className="relative min-h-screen flex">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-[55%] flex-col items-center justify-center p-12 relative">
          {/* Floating icon bubbles */}
          <div className="absolute top-16 left-16 animate-float">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-lg shadow-blue-200/50 border border-blue-100 flex items-center justify-center">
              <Heart className="w-7 h-7 text-rose-500" />
            </div>
          </div>
          <div className="absolute top-32 right-20 animate-float-delayed">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-lg shadow-blue-200/50 border border-blue-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
          <div className="absolute bottom-36 left-20 animate-float-delayed">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-lg shadow-blue-200/50 border border-blue-100 flex items-center justify-center">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="absolute bottom-40 right-24 animate-float">
            <div className="w-11 h-11 rounded-2xl bg-white shadow-lg shadow-blue-200/50 border border-blue-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <div className="absolute top-1/2 left-12 animate-float-delayed">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-lg shadow-blue-200/50 border border-blue-100 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-cyan-500" />
            </div>
          </div>
          <div className="absolute top-1/3 right-12 animate-float">
            <div className="w-13 h-13 rounded-2xl bg-white shadow-lg shadow-blue-200/50 border border-blue-100 flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-indigo-500" />
            </div>
          </div>

          {/* Main branding */}
          <div className="text-center animate-slide-up">
            {/* Logo */}
            <div className="relative mb-8 inline-block">
              <div className="absolute inset-0 rounded-full shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]" />
              <img
                src={window.__CS__?.logoUrl || '/clinic-logo.jpg'}
                alt={`${window.__CS__?.name || 'Clinic'} Logo`}
                className="w-56 h-56 rounded-full object-cover border-4 border-white shadow-xl relative"
              />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center shadow-lg">
                <div className="w-3 h-3 bg-white rounded-full" />
              </div>
            </div>

            {/* Text */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 tracking-[0.2em] uppercase font-medium">Welcome to</p>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
                {window.__CS__?.name || 'Clinic'}
              </h1>
              <p className="text-base text-slate-400 max-w-md mx-auto leading-relaxed">
                {window.__CS__?.tagline || 'We are committed to providing exceptional healthcare services with compassion and excellence.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full lg:w-[45%] flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md animate-slide-up-delayed">
            {/* Form card */}
            <div className="bg-white rounded-3xl shadow-2xl shadow-blue-200/40 border border-blue-100/50 p-8 lg:p-10">
              {/* Form header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 mb-5 shadow-sm">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1">Welcome Back</h2>
                <p className="text-slate-400 text-sm">Sign in to access your account</p>
              </div>

              {/* Form */}
              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* User Selection */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-600">
                    Select Account
                  </label>
                  {loadingUsers ? (
                    <div className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-400 text-sm">
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border border-blue-200 border-t-blue-500 mr-2 align-middle" />
                      Loading users...
                    </div>
                  ) : users.length > 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowUserDropdown(!showUserDropdown)}
                        className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200 text-left flex items-center justify-between"
                      >
                        <span className={selectedUser ? 'text-sm text-slate-700' : 'text-sm text-slate-400'}>
                          {selectedUser ? formatUserLabel(selectedUser) : '-- Select your account --'}
                        </span>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showUserDropdown && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-[70vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b border-slate-100 px-3 py-2">
                              <input
                                type="text"
                                placeholder="Search users..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 outline-none focus:border-blue-400"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            {users
                              .filter(u => !userSearch || (u.fullname || u.username).toLowerCase().includes(userSearch.toLowerCase()))
                              .map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => {
                                    handleSelectUser(user);
                                    setShowUserDropdown(false);
                                    setUserSearch('');
                                  }}
                                  className={`w-full text-left px-4 py-2.5 text-xs hover:bg-blue-50 flex items-center justify-between transition-colors ${selectedUser?.id === user.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                                >
                                  <span className="font-medium">{formatUserLabel(user)}</span>
                                  <span className="text-[10px] uppercase tracking-wider text-slate-400">{user.role === 'ADMIN' ? '🔑' : user.role === 'DOCTOR' ? '⚕' : user.role === 'NURSE' ? '💉' : user.role === 'LAB_TECHNICIAN' ? '🔬' : ''}</span>
                                </button>
                              ))}
                            {users.filter(u => !userSearch || (u.fullname || u.username).toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                              <div className="px-4 py-3 text-xs text-slate-400 text-center">No users found</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <input
                      name="username"
                      type="text"
                      required
                      className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200"
                      placeholder="Enter your username"
                      value={formData.username}
                      onChange={handleChange}
                    />
                  )}
                </div>

                {/* Selected user info */}
                {selectedUser && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 animate-slide-up">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {(selectedUser.fullname || selectedUser.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700">
                          {formatUserLabel(selectedUser)}
                        </div>
                        <div className="text-xs text-blue-500/70">{selectedUser.role === 'DOCTOR' ? (selectedUser.specialty || 'Doctor') : selectedUser.role}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-600">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="w-full px-4 py-3.5 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all duration-200"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || (users.length > 0 && !selectedUser)}
                    className="group relative w-full flex justify-center py-3.5 px-4 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-200/50 hover:shadow-xl hover:shadow-blue-300/50 hover:-translate-y-0.5"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white" />
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-2">
                        Sign In
                        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </span>
                    )}
                  </button>
                  {users.length > 0 && !selectedUser && (
                    <p className="text-xs text-amber-500 mt-3 text-center">Please select a user to continue</p>
                  )}
                </div>
              </form>
            </div>

            {/* Footer */}
            <p className="text-center text-slate-300 text-xs mt-6 animate-slide-up-delayed-2">
              &copy; {new Date().getFullYear()} {window.__CS__?.name || 'Clinic'}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
