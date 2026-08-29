import React, { useState } from 'react';
import { X, User, Mail, DollarSign, Palette, Check, Phone, Globe } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSave: (updatedUser: UserProfile) => void;
}

const AVATAR_COLORS = [
  '#2563EB', // Blue
  '#16A34A', // Green
  '#DC2626', // Red
  '#9333EA', // Purple
  '#EA580C', // Orange
  '#0D9488', // Teal
  '#4F46E5', // Indigo
  '#0F172A', // Slate
];

const CURRENCIES = [
  { symbol: '₹', code: 'INR', label: '₹ Indian Rupee (INR)' },
  { symbol: '$', code: 'USD', label: '$ US Dollar (USD)' },
  { symbol: '€', code: 'EUR', label: '€ Euro (EUR)' },
  { symbol: '£', code: 'GBP', label: '£ British Pound (GBP)' },
  { symbol: '¥', code: 'JPY', label: '¥ Japanese Yen (JPY)' },
  { symbol: 'A$', code: 'AUD', label: 'A$ Australian Dollar (AUD)' },
  { symbol: 'C$', code: 'CAD', label: 'C$ Canadian Dollar (CAD)' },
  { symbol: 'AED', code: 'AED', label: 'AED UAE Dirham (AED)' },
  { symbol: 'S$', code: 'SGD', label: 'S$ Singapore Dollar (SGD)' },
];

const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸', label: 'United States (+1)' },
  { code: '+44', country: 'GB', flag: '🇬🇧', label: 'United Kingdom (+44)' },
  { code: '+61', country: 'AU', flag: '🇦🇺', label: 'Australia (+61)' },
  { code: '+91', country: 'IN', flag: '🇮🇳', label: 'India (+91)' },
  { code: '+971', country: 'AE', flag: '🇦🇪', label: 'UAE (+971)' },
  { code: '+65', country: 'SG', flag: '🇸🇬', label: 'Singapore (+65)' },
  { code: '+852', country: 'HK', flag: '🇭🇰', label: 'Hong Kong (+852)' },
  { code: '+81', country: 'JP', flag: '🇯🇵', label: 'Japan (+81)' },
  { code: '+49', country: 'DE', flag: '🇩🇪', label: 'Germany (+49)' },
  { code: '+33', country: 'FR', flag: '🇫🇷', label: 'France (+33)' },
  { code: '+7', country: 'RU', flag: '🇷🇺', label: 'Russia (+7)' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
}) => {
  const [name, setName] = useState(user.name);
  const [email] = useState(user.email);
  const [currency, setCurrency] = useState(user.currency || '₹');
  const [avatarColor, setAvatarColor] = useState(user.avatarColor || '#2563EB');
  const [phone, setPhone] = useState(user.phone || '');
  const [countryCode, setCountryCode] = useState(user.countryCode || '+91');

  const selectedCountry = COUNTRY_CODES.find((entry) => entry.code === countryCode) || COUNTRY_CODES[3];

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      email: email.trim() || user.email,
      currency,
      avatarColor,
      phone: phone.trim() || undefined,
      countryCode,
    });
    onClose();
  };

  const initials = (name.trim() || user.name)
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">User Profile Settings</h2>
              <p className="text-xs text-slate-500">Manage account identity & currency</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar Preview & Color Selection */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-md transition-colors"
              style={{ backgroundColor: avatarColor }}
            >
              {initials || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Avatar Theme Color
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
                      avatarColor === color ? 'ring-2 ring-offset-2 ring-blue-600 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {avatarColor === color && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Arpit Acharya"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                readOnly
                disabled
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Mobile Number
            </label>
            <div className="flex items-center gap-2">
              <div className="relative w-28">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600 text-sm">
                  <span>{selectedCountry.flag}</span>
                </div>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full pl-10 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition appearance-none cursor-pointer"
                >
                  {COUNTRY_CODES.map((country, index) => (
                    <option key={index} value={country.code}>
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
                  placeholder="98765 43210"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Preferred Currency */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Default Currency
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition appearance-none cursor-pointer"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.symbol} value={c.symbol}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
