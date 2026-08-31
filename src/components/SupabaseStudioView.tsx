import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  Table, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Server,
  Layers,
  Terminal,
  Activity
} from 'lucide-react';
import { SUPABASE_SETUP_SQL, SUPABASE_USER_SCOPING_MIGRATION_SQL } from '../lib/supabaseSchemaSql';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { checkSupabaseHealth, seedSupabaseInitialData, SupabaseHealthStatus } from '../lib/supabaseService';
import { UserProfile } from '../types';

interface SupabaseStudioViewProps {
  user: UserProfile;
  onRefreshData?: () => void;
}

export const SupabaseStudioView: React.FC<SupabaseStudioViewProps> = ({ user, onRefreshData }) => {
  const [copied, setCopied] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [sqlMode, setSqlMode] = useState<'migration' | 'full'>('migration');
  const [activeTab, setActiveTab] = useState<'sql' | 'tables' | 'connection'>('sql');
  const [healthStatus, setHealthStatus] = useState<SupabaseHealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchHealth = async () => {
    setIsChecking(true);
    try {
      const status = await checkSupabaseHealth();
      setHealthStatus(status);
    } catch {
      // Ignored
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    setSeedNotice(null);
    try {
      const result = await seedSupabaseInitialData(user);
      if (result.success) {
        setSeedNotice({ type: 'success', text: result.message });
        await fetchHealth();
        if (onRefreshData) onRefreshData();
      } else {
        setSeedNotice({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setSeedNotice({ type: 'error', text: err?.message || 'Failed to seed database' });
    } finally {
      setIsSeeding(false);
    }
  };

  const tableDefinitions = [
    {
      name: 'profiles',
      desc: 'User settings, avatar colors, default currency, and monthly budget ceiling.',
      columns: ['id (text pk)', 'name (text)', 'email (text unique)', 'currency (text)', 'avatar_color (text)', 'monthly_budget (numeric)', 'created_at', 'updated_at'],
    },
    {
      name: 'accounts',
      desc: 'Bank accounts, credit cards with due dates/limits, cash wallets, and investment vaults.',
      columns: ['id (text pk)', 'name (text)', 'type (text)', 'balance (numeric)', 'credit_limit (numeric)', 'due_amount (numeric)', 'due_date (text)', 'currency (text)', 'shared_with (jsonb)'],
    },
    {
      name: 'categories',
      desc: 'User-scoped & template expense and income categories with icons, color codes, and limits.',
      columns: ['id (text pk)', 'user_email (text fk)', 'is_global (bool)', 'name (text)', 'icon (text)', 'color (text)', 'type (text)', 'budget_limit (numeric)'],
    },
    {
      name: 'transactions',
      desc: 'Universal ledger for expenses, incomes, bank-to-bank transfers, and Splitwise debt settlements.',
      columns: ['id (text pk)', 'date (text)', 'title (text)', 'amount (numeric)', 'type (text)', 'account_id (text fk)', 'category_id (text fk)', 'split_details (jsonb)', 'created_by (text)'],
    },
    {
      name: 'loans',
      desc: 'Loans & EMI repayment schedule with tenure tracking, remaining balance, and linked accounts.',
      columns: ['id (text pk)', 'user_email (text)', 'name (text)', 'lender (text)', 'total_principal (numeric)', 'remaining_principal (numeric)', 'monthly_emi (numeric)', 'paid_tenure_months (int)', 'status (text)'],
    },
    {
      name: 'groups',
      desc: 'Splitwise shared expense groups with member rosters, category tags, and currency configs.',
      columns: ['id (text pk)', 'name (text)', 'description (text)', 'category (text)', 'members (jsonb)', 'currency (text)', 'created_by (text)'],
    },
    {
      name: 'group_activity_logs',
      desc: 'WhatsApp-style timeline events for group expense additions, member joins, and settlements.',
      columns: ['id (text pk)', 'group_id (text fk)', 'action_type (text)', 'actor_name (text)', 'message (text)', 'timestamp (timestamptz)', 'details (jsonb)'],
    },
    {
      name: 'friends',
      desc: 'Direct peer-to-peer friend relationships with running net balances (owed / to-receive).',
      columns: ['id (text pk)', 'user_email (text)', 'name (text)', 'email (text)', 'phone (text)', 'net_balance (numeric)', 'avatar_color (text)', 'last_activity (text)'],
    },
    {
      name: 'rules',
      desc: 'User-scoped and global automation rules engine with keyword matching and category routing.',
      columns: ['id (text pk)', 'user_email (text fk)', 'is_global (bool)', 'name (text)', 'keyword (text)', 'keywords (jsonb)', 'match_type (text)', 'category_id (text fk)', 'is_enabled (bool)'],
    },
    {
      name: 'budgets',
      desc: 'User-scoped monthly and yearly budgets set per category for granular spending targets.',
      columns: ['id (text pk)', 'user_email (text)', 'category_id (text fk)', 'month (int)', 'year (int)', 'limit_amount (numeric)'],
    }
  ];

  const handleCopyMigrationSql = () => {
    navigator.clipboard.writeText(SUPABASE_USER_SCOPING_MIGRATION_SQL);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 2500);
  };

  const displayedSql = sqlMode === 'migration' ? SUPABASE_USER_SCOPING_MIGRATION_SQL : SUPABASE_SETUP_SQL;
  const currentCopied = sqlMode === 'migration' ? copiedMigration : copied;
  const handleCurrentCopy = sqlMode === 'migration' ? handleCopyMigrationSql : handleCopySql;

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-emerald-800/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <Database className="w-3.5 h-3.5" />
              <span>Supabase PostgreSQL Backend</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Supabase Database Studio
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              SpendWise is configured to connect to your Supabase project. Use the schema query below in your Supabase SQL Editor to set up all 8 relational tables, Row-Level Security (RLS) policies, and performance indexes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopySql}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 transition active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'SQL Copied to Clipboard!' : 'Copy Supabase SQL'}</span>
            </button>
            <button
              onClick={fetchHealth}
              disabled={isChecking}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>Check Tables</span>
            </button>
          </div>
        </div>

        {/* Credentials Pills */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-slate-400">Endpoint:</span>
            <span className="font-mono text-emerald-400 truncate max-w-[260px] sm:max-w-xs">{SUPABASE_URL}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-slate-400">Auth Key:</span>
            <span className="font-mono text-slate-300 truncate max-w-[120px]">{SUPABASE_ANON_KEY.slice(0, 16)}...</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-[11px]">Client Ready</span>
          </div>
        </div>
      </div>

      {/* Notice Banner if Seeded */}
      {seedNotice && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
          seedNotice.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {seedNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span className="font-medium">{seedNotice.text}</span>
          </div>
          <button 
            onClick={() => setSeedNotice(null)}
            className="font-bold underline text-xs cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'sql'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Setup SQL Script</span>
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'tables'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Database Tables ({tableDefinitions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('connection')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'connection'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Connection & Seeder</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SQL Script View */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          {/* SQL Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setSqlMode('migration')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  sqlMode === 'migration'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Incremental Migration SQL (Existing DB)
              </button>
              <button
                onClick={() => setSqlMode('full')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  sqlMode === 'full'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Full Schema SQL (Fresh Install)
              </button>
            </div>

            <button
              onClick={handleCurrentCopy}
              className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer ${
                sqlMode === 'migration' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {currentCopied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span>{currentCopied ? 'SQL Copied!' : (sqlMode === 'migration' ? 'Copy Migration SQL' : 'Copy Full SQL')}</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>
                  {sqlMode === 'migration' 
                    ? 'Execute User Scoping Migration SQL (Adds user_email & is_global):' 
                    : 'Execute Full Schema Setup in Supabase:'}
                </span>
              </h3>
              <ol className="text-xs text-slate-600 mt-2 space-y-1 list-decimal list-inside leading-relaxed">
                <li>Log in to your <strong>Supabase Dashboard</strong> at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-3 h-3 inline" /></a></li>
                <li>Navigate to your project <strong className="font-mono text-slate-800">(kdjptkhfvzvsevzbcmik)</strong> and click <strong>SQL Editor</strong> on the left bar.</li>
                <li>Click <strong>New query</strong>, paste the script below, and hit <strong>Run</strong>.</li>
              </ol>
            </div>
            <button
              onClick={handleCurrentCopy}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow transition flex-shrink-0 cursor-pointer"
            >
              {currentCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{currentCopied ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
            </button>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                </div>
                <span className="font-mono text-slate-300 ml-2">
                  {sqlMode === 'migration' ? 'supabase/user_scoping_migration.sql' : 'supabase/schema.sql'}
                </span>
              </div>
              <button
                onClick={handleCurrentCopy}
                className="text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700"
              >
                {currentCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{currentCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-[500px] leading-relaxed select-all">
              {displayedSql}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 2: Database Tables Overview */}
      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tableDefinitions.map((table) => {
            const tableStatus = healthStatus?.tableStatuses?.[table.name];
            const isReady = tableStatus?.exists;

            return (
              <div key={table.name} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                      <Table className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 font-mono">public.{table.name}</h4>
                      <p className="text-xs text-slate-500 line-clamp-1">{table.desc}</p>
                    </div>
                  </div>

                  {tableStatus ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      isReady 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isReady ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      <span>{isReady ? `${tableStatus.count} rows` : 'Table missing'}</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                      Ready
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Columns & Keys:</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {table.columns.map((col, idx) => (
                      <span 
                        key={idx} 
                        className="px-2 py-0.5 bg-slate-50 text-slate-700 rounded-md text-[11px] font-mono border border-slate-200/60"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: Connection & Seeder */}
      {activeTab === 'connection' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Health Status Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Supabase Connection Monitor</h4>
                    <p className="text-xs text-slate-500">Live heartbeat check with database endpoint</p>
                  </div>
                </div>
                <button
                  onClick={fetchHealth}
                  disabled={isChecking}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  title="Re-check connection"
                >
                  <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Database Status:</span>
                  <span className={`font-bold flex items-center gap-1.5 ${healthStatus?.connected ? 'text-emerald-600' : 'text-amber-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${healthStatus?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    {healthStatus?.connected ? 'Tables Verified & Online' : 'Awaiting SQL Migration'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Project Endpoint:</span>
                  <span className="font-mono font-medium text-slate-800 truncate max-w-[200px]">{SUPABASE_URL}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Last Checked:</span>
                  <span className="font-medium text-slate-700">{healthStatus?.lastChecked || 'Just now'}</span>
                </div>
              </div>
            </div>

            {/* Quick Demo Data Seeder */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Seed Demo Data to Supabase</h4>
                  <p className="text-xs text-slate-500">Populate bank accounts, loans, and Goa trip group</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Once you run the schema script in Supabase, click below to insert starter records for HDFC Bank, ICICI Credit Card, MacBook EMI, and Splitwise group expenses directly into your Supabase database.
              </p>

              <button
                onClick={handleSeedData}
                disabled={isSeeding}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-200 transition active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
                <span>{isSeeding ? 'Seeding Records to Supabase...' : 'Seed Default Demo Records'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
