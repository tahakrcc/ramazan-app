import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { toast } from 'react-toastify';

const AdminLoginPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await API.post('/admin/secure-login-action', formData);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('role', res.data.role); // Store role
            toast.success('Giriş başarılı');
            navigate('/admin/dashboard');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Giriş başarısız');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-12 flex flex-col items-center justify-center">
                    {/* Logo - Full Visibility & Glow */}
                    <div className="relative mb-6 group">
                        <div className="absolute inset-0 bg-gold-500 blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>
                        <img src="/logo.png" alt="Logo" className="relative w-40 h-40 object-contain drop-shadow-2xl" />
                    </div>

                    {/* Text */}
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 font-serif tracking-widest drop-shadow-lg">BY RAMAZAN</h1>
                    <p className="text-gold-500 text-sm uppercase tracking-[0.4em] font-medium">Yönetim Paneli</p>
                </div>

                <div className="bg-gray-800 rounded-2xl p-8">
                    <h2 className="text-xl font-semibold text-white mb-6">Giriş Yap</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Kullanıcı Adı</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white"
                                placeholder="admin"
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Şifre</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-white"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? 'Gizle' : 'Göster'}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-gray-900 font-semibold py-3 rounded-lg hover:bg-gray-100 transition-all mt-6 disabled:opacity-50"
                        >
                            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-gray-500 text-sm mt-8">
                    © 2024 By Ramazan
                </p>
            </div>
        </div>
    );
};

export default AdminLoginPage;
