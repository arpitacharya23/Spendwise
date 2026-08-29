import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Wallet, 
  AlertCircle, 
  CheckCircle2, 
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { saveSupabaseProfile } from '../lib/supabaseService';

interface AuthViewProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

const AVAILABLE_CURRENCIES = [
  { symbol: '₹', code: 'INR', label: '₹ INR (Indian Rupee)' },
  { symbol: '$', code: 'USD', label: '$ USD (US Dollar)' },
  { symbol: '€', code: 'EUR', label: '€ EUR (Euro)' },
  { symbol: '£', code: 'GBP', label: '£ GBP (British Pound)' },
  { symbol: 'AED ', code: 'AED', label: 'AED (UAE Dirham)' },
  { symbol: 'C$', code: 'CAD', label: 'C$ CAD (Canadian Dollar)' },
  { symbol: 'A$', code: 'AUD', label: 'A$ AUD (Australian Dollar)' },
  { symbol: '¥', code: 'JPY', label: '¥ JPY (Japanese Yen)' },
  { symbol: 'S$', code: 'SGD', label: 'S$ SGD (Singapore Dollar)' },
];

const AVATAR_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4', '#6366F1'];

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('₹');
  const [showPassword, setShowPassword] = useState(false);
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setGoogleLoading(true);

    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setErrorMsg(err?.message || 'Google sign-in could not be started. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate with Supabase Auth (verifies email & password strictly)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        // Strict password & credentials validation: display genuine Supabase Auth error
        setErrorMsg(error.message || 'Invalid login credentials. Please check your email and password.');
        return;
      }

      if (!data?.user) {
        setErrorMsg('Authentication failed. No user found.');
        return;
      }

      const authUser = data.user;
      const userEmail = authUser.email || cleanEmail;

      // 2. Fetch or initialize user profile in public.profiles table
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      let profile: UserProfile;
      if (profileRow) {
        profile = {
          name: profileRow.name || userEmail.split('@')[0],
          email: profileRow.email || userEmail,
          currency: profileRow.currency || '₹',
          avatarColor: profileRow.avatar_color || '#3B82F6',
          monthlyBudget: Number(profileRow.monthly_budget) || 50000,
        };
      } else {
        // If profile row doesn't exist yet, insert into profiles table
        profile = {
          name: authUser.user_metadata?.name || userEmail.split('@')[0],
          email: userEmail,
          currency: authUser.user_metadata?.currency || '₹',
          avatarColor: authUser.user_metadata?.avatar_color || '#3B82F6',
          monthlyBudget: Number(authUser.user_metadata?.monthly_budget) || 50000,
        };
        await saveSupabaseProfile(profile, authUser.id);
      }

      setSuccessMsg('Signed in successfully!');
      localStorage.setItem('spendwise_auth_user', JSON.stringify(profile));
      setTimeout(() => onAuthSuccess(profile), 300);
    } catch (err: any) {
      console.error('Sign in error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const budgetNum = 50000;

      // 1. Create account strictly in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: name.trim(),
            currency,
            avatar_color: randomColor,
            monthly_budget: budgetNum,
          },
        },
      });

      if (authError) {
        setErrorMsg(authError.message || 'Failed to create account. Please check your details.');
        return;
      }

      if (!authData?.user) {
        setErrorMsg('Failed to register user. Please try again.');
        return;
      }

      const newProfile: UserProfile = {
        name: name.trim(),
        email: cleanEmail,
        currency,
        avatarColor: randomColor,
        monthlyBudget: budgetNum,
      };

      // 2. Insert into the public.profiles database table
      await saveSupabaseProfile(newProfile, authData.user.id);

      // Check if session is already established
      if (authData.session) {
        setSuccessMsg('Account created successfully! Logging you in...');
        localStorage.setItem('spendwise_auth_user', JSON.stringify(newProfile));
        setTimeout(() => {
          onAuthSuccess(newProfile);
        }, 400);
      } else {
        // If email confirmation is disabled or enabled, attempt sign in or notify
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (!signInErr && signInData?.user) {
          setSuccessMsg('Account created successfully! Logging you in...');
          localStorage.setItem('spendwise_auth_user', JSON.stringify(newProfile));
          setTimeout(() => {
            onAuthSuccess(newProfile);
          }, 400);
        } else if (signInErr?.message?.toLowerCase().includes('email not confirmed')) {
          setSuccessMsg('Account created! Please verify your email address to sign in.');
          setMode('signin');
        } else {
          setSuccessMsg('Account created successfully! Please sign in with your credentials.');
          setMode('signin');
        }
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      setErrorMsg(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
  <div
    className="min-h-screen text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 selection:bg-blue-600 selection:text-white bg-cover bg-center bg-no-repeat"
    style={{
      backgroundImage:
        "linear-gradient(rgba(5, 12, 28, 0.60), rgba(5, 12, 28, 0.60)), url('/login-bg.png')",
    }}
  >
      {/* Background decorative ambient glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/20 mb-3.5">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">SpendWise</h1>
        </div>

        {/* Main Card Container */}
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-900/90 p-1 rounded-2xl mb-6 border border-slate-700/60">
            <button
              type="button"
              id="tab-signin"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                mode === 'signin'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              id="tab-signup"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 border border-slate-600 bg-slate-900/80 hover:bg-slate-900 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting Google...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4">
                    <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4.2-5.4 4.2-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4S6.9 20.6 12 20.6c6.9 0 11.4-4.8 11.4-11.6 0-.8-.1-1.5-.2-2.1H12z" opacity="0.9"/>
                    <path fill="#34A853" d="M3.7 7.5l3.5 2.6c1-1.7 3.1-2.9 5.2-2.9 1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2.2 12 2.2 8.1 2.2 4.8 4.6 3.7 7.5z" opacity="0.9"/>
                    <path fill="#FBBC05" d="M3.7 15.3A9.5 9.5 0 0 1 3.3 11c0-.8.1-1.5.3-2.2l3.8 2.9c-.2.6-.3 1.2-.3 1.9 0 .7.1 1.3.3 1.9L3.7 15.3z" opacity="0.9"/>
                    <path fill="#4285F4" d="M12 20.6c2.6 0 4.8-.9 6.4-2.4l-3-2.3c-.8.6-1.9 1-3.4 1-2.6 0-4.8-1.7-5.4-4.1l-3.4 2.6A9.8 9.8 0 0 0 12 20.6z" opacity="0.9"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.18em] text-slate-500">
                <span className="bg-slate-800/90 px-3">or</span>
              </div>
            </div>
          </div>

          {/* SIGN IN FORM */}
          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="signin-email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="signin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="signin-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-signin"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/25 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* SIGN UP FORM */
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="signup-name">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="signup-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Srishti Sharma"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="signup-email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="signup-password">
                  Password (min. 6 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="signup-currency">
                  Preferred Currency
                </label>
                <select
                  id="signup-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                >
                  {AVAILABLE_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.symbol}>
                      {curr.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                id="btn-submit-signup"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create SpendWise Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
            By signing up or logging in, you agree to{' '}
            <a
              href="https://app.arpitacharya.com/privacy.html"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Privacy Policy
            </a>{' '}
            &{' '}
            <a
              href="https://app.arpitacharya.com/terms.html"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Terms of Service
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};
