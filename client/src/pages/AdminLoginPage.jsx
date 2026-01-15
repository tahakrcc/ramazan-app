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
            localStorage.setItem('adminToken', res.data.token);
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
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-white mb-2">By Ramazan</h1>
                    <p className="text-gray-400">Yönetim Paneli</p>
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
