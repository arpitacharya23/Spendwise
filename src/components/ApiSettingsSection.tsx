import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  FileDown, 
  Smartphone, 
  Send, 
  Code2, 
  Sparkles, 
  ExternalLink,
  CheckCircle2,
  Terminal,
  Zap,
  HelpCircle,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { UserProfile, Account, Category, Transaction } from '../types';
import { getStoredApiKey, generateApiKey, saveStoredApiKey, getApiBaseUrl } from '../lib/apiService';
import { generateApiSpecsPdf } from '../lib/apiSpecPdf';

interface ApiSettingsSectionProps {
  user: UserProfile;
  accounts: Account[];
  categories: Category[];
  appsScriptUrl?: string;
  onAddTransaction?: (tx: Transaction) => void;
}

export const ApiSettingsSection: React.FC<ApiSettingsSectionProps> = ({
  user,
  accounts,
  categories,
  appsScriptUrl,
  onAddTransaction,
}) => {
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasCopiedKey, setHasCopiedKey] = useState(false);
  const [hasCopiedUrl, setHasCopiedUrl] = useState(false);
  const [hasCopiedCurl, setHasCopiedCurl] = useState(false);
  const [hasCopiedShortcutJson, setHasCopiedShortcutJson] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  // Active guide tab: 'manual_shortcut' | 'siri' | 'bank_sms'
  const [activeGuideTab, setActiveGuideTab] = useState<'manual_shortcut' | 'siri' | 'bank_sms'>('manual_shortcut');

  // Test Runner state
  const [testAmount, setTestAmount] = useState('350');
  const [testTitle, setTestTitle] = useState('Coffee & Snacks');
  const [testAccount, setTestAccount] = useState(accounts[0]?.name || 'Primary Bank');
  const [testCategory, setTestCategory] = useState(categories[0]?.name || 'Food & Dining');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; response?: any } | null>(null);

  // Endpoint explorer expanded states
  const [expandedEndpoint, setExpandedEndpoint] = useState<string>('shortcuts_log');

  const baseUrl = getApiBaseUrl();

  useEffect(() => {
    if (accounts.length > 0 && (!testAccount || testAccount === 'Primary Bank')) {
      setTestAccount(accounts[0].name);
    }
  }, [accounts]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setHasCopiedKey(true);
    setTimeout(() => setHasCopiedKey(false), 2500);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`${baseUrl}/shortcuts/log`);
    setHasCopiedUrl(true);
    setTimeout(() => setHasCopiedUrl(false), 2500);
  };

  const handleRegenerateKey = () => {
    if (window.confirm('Are you sure you want to regenerate your API key? Any existing iOS Shortcuts or scripts will need to be updated with the new key.')) {
      const newKey = generateApiKey();
      setApiKey(newKey);
      saveStoredApiKey(newKey);
    }
  };

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      generateApiSpecsPdf({
        user,
        apiKey,
        baseUrl,
        accounts,
        categories,
        appsScriptUrl,
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to generate PDF:', e);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const curlExample = `curl -X POST "${baseUrl}/shortcuts/log" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{
    "amount": ${testAmount || 350},
    "title": "${testTitle || 'Coffee & Snacks'}",
    "account": "${testAccount || 'HDFC Bank'}",
    "category": "${testCategory || 'Food & Dining'}",
    "type": "expense"
  }'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlExample);
    setHasCopiedCurl(true);
    setTimeout(() => setHasCopiedCurl(false), 2500);
  };

  const shortcutDictionaryJson = JSON.stringify({
    amount: "Input (Number)",
    title: "Input (Text)",
    account: testAccount || "Primary Bank",
    category: testCategory || "Food & Dining",
    type: "expense",
    note: "Logged via iOS Shortcut"
  }, null, 2);

  const handleCopyShortcutJson = () => {
    navigator.clipboard.writeText(shortcutDictionaryJson);
    setHasCopiedShortcutJson(true);
    setTimeout(() => setHasCopiedShortcutJson(false), 2500);
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testAmount || isNaN(Number(testAmount))) {
      setTestResult({ success: false, message: 'Please enter a valid numeric amount' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${baseUrl}/shortcuts/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          amount: Number(testAmount),
          title: testTitle.trim() || 'Quick Expense',
          account: testAccount,
          category: testCategory,
          type: 'expense',
          note: 'Tested from SpendWise Settings API Console',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || 'Transaction received successfully!',
          response: data,
        });

        // Optionally create in local store if handler is supplied
        if (onAddTransaction && data.transaction) {
          const matchedAcc = accounts.find(
            (a) => a.name.toLowerCase() === (testAccount || '').toLowerCase()
          ) || accounts[0];
          const matchedCat = categories.find(
            (c) => c.name.toLowerCase() === (testCategory || '').toLowerCase()
          ) || categories[0];

          const newTx: Transaction = {
            id: data.transaction.id || `tx_${Date.now()}`,
            title: data.transaction.title,
            amount: data.transaction.amount,
            type: 'expense',
            accountId: matchedAcc ? matchedAcc.id : 'default',
            categoryId: matchedCat ? matchedCat.id : 'general',
            date: data.transaction.date || new Date().toISOString().split('T')[0],
            time: data.transaction.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            notes: data.transaction.notes || 'API Test Log',
            createdBy: user.email,
            updatedAt: new Date().toISOString(),
          };
          onAddTransaction(newTx);
        }
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Server rejected the request.',
          response: data,
        });
      }
    } catch (err: any) {
      console.error('API Test Error:', err);
      setTestResult({
        success: false,
        message: err?.message || 'Failed to connect to API server.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/80 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              REST API & Integrations
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                v1.2.0 Active
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect Apple iPhone Shortcuts, Siri, Tasker, webhooks, and third-party automations.
            </p>
          </div>
        </div>

        {/* Download PDF Action Button */}
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 flex-shrink-0"
          title="Download complete formatted PDF with all API specs and iPhone Shortcuts guide"
        >
          {pdfSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Specs Downloaded!</span>
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download API Specs (PDF)'}</span>
            </>
          )}
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. API Credentials & Key Card */}
      {/* ---------------------------------------------------- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              API Credentials & Endpoints
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Keep your API key private</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              API Base URL
            </label>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <code className="text-xs font-mono text-slate-800 flex-1 truncate">{baseUrl}</code>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                title="Copy Base URL"
              >
                {hasCopiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* User API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Personal Secret API Key
              </label>
              <button
                type="button"
                onClick={handleRegenerateKey}
                className="text-[10px] text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1 cursor-pointer"
                title="Regenerate a fresh API Key"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Regenerate Key</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <code className="text-xs font-mono text-slate-800 flex-1 truncate">
                {showApiKey ? apiKey : '••••••••••••••••••••••••••••••••••••••••'}
              </code>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title={showApiKey ? 'Hide Key' : 'Show Key'}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleCopyKey}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                title="Copy API Key"
              >
                {hasCopiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-600 bg-white/80 border border-slate-200/80 rounded-xl p-3 flex items-start gap-2">
          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-800">Quick Authentication:</strong> Pass your key in either the{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[10px]">x-api-key: {showApiKey ? apiKey : 'YOUR_API_KEY'}</code>{' '}
            header or as a Bearer token{' '}
            <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono text-[10px]">Authorization: Bearer {showApiKey ? apiKey : 'YOUR_API_KEY'}</code>.
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Apple iPhone Shortcuts Guide (Step-by-Step) */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              iPhone Shortcuts Setup Guide
            </h3>
          </div>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            ⚡ 1-Tap & Siri Voice Logging
          </span>
        </div>

        {/* Guide Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveGuideTab('manual_shortcut')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeGuideTab === 'manual_shortcut'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>1-Click Shortcut Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveGuideTab('siri')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeGuideTab === 'siri'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Siri Voice Commands</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveGuideTab('bank_sms')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeGuideTab === 'bank_sms'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Bank SMS Automation</span>
          </button>
        </div>

        {/* Tab 1: Manual 1-Click Shortcut */}
        {activeGuideTab === 'manual_shortcut' && (
          <div className="space-y-4 bg-slate-50/70 border border-slate-200 rounded-2xl p-5 text-xs text-slate-700">
            <p className="font-semibold text-slate-800">
              Create an iOS Shortcut in under 60 seconds to log any expense directly to SpendWise from your Home Screen or Action Button:
            </p>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3 items-start bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900">Open the Shortcuts App on your iPhone</h4>
                  <p className="text-slate-500 text-[11px]">
                    Tap the <strong>"+"</strong> button in the top-right corner to create a new shortcut. Rename it to <strong>"Log Expense"</strong>.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3 items-start bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900">Add User Input Prompts</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                    <li>
                      Add action <strong>"Ask for Input"</strong> → Set Type to <strong>Number</strong> → Prompt: <em>"How much did you spend?"</em>
                    </li>
                    <li>
                      Add action <strong>"Ask for Input"</strong> → Set Type to <strong>Text</strong> → Prompt: <em>"What was this for? (e.g. Starbucks, Groceries)"</em>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3 items-start bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900">Add "Get Contents of URL" Action (Webhook POST)</h4>
                  <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] space-y-1 overflow-x-auto">
                    <p className="text-blue-400"># Action Configuration:</p>
                    <p>URL: <span className="text-emerald-400">{baseUrl}/shortcuts/log</span></p>
                    <p>Method: <span className="text-amber-400">POST</span></p>
                    <p className="text-slate-400">Headers:</p>
                    <p className="pl-4">x-api-key: <span className="text-amber-300">{apiKey}</span></p>
                    <p className="pl-4">Content-Type: application/json</p>
                    <p className="text-slate-400">Request Body: JSON</p>
                    <p className="pl-4">amount : (Provided Number)</p>
                    <p className="pl-4">title : (Provided Text)</p>
                    <p className="pl-4">account : "{testAccount || 'HDFC Bank'}"</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyShortcutJson}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {hasCopiedShortcutJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Shortcut JSON Template</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3 items-start bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center shrink-0 text-xs">
                  4
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900">Add Notification / Siri Voice Feedback</h4>
                  <p className="text-slate-500 text-[11px]">
                    Add action <strong>"Show Notification"</strong> or <strong>"Speak Text"</strong> with: <em>"Logged \(Provided Text) in SpendWise!"</em>. Done!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Siri Voice Commands */}
        {activeGuideTab === 'siri' && (
          <div className="space-y-3 bg-slate-50/70 border border-slate-200 rounded-2xl p-5 text-xs text-slate-700">
            <div className="flex items-center gap-2 text-indigo-700 font-bold">
              <MessageSquare className="w-4 h-4" />
              <span>Hands-Free Voice Expense Logging with Siri</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Once your shortcut is saved with the name <strong>"Log Expense"</strong>, you can activate it anytime using Siri on your iPhone, Apple Watch, CarPlay, or AirPods:
            </p>
            <div className="p-3.5 bg-white rounded-xl border border-indigo-100 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="font-bold text-slate-900">Voice Command Example:</span>
              </div>
              <p className="text-indigo-900 bg-indigo-50/80 p-2.5 rounded-lg font-mono text-[11px]">
                "Hey Siri, Log Expense" → Siri will ask: <em>"How much did you spend?"</em> → Say: <em>"450"</em> → Siri asks: <em>"What was this for?"</em> → Say: <em>"Lunch at Chipotle"</em>.
              </p>
              <p className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> SpendWise categorizes and deducts the amount immediately!
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Bank SMS Automation */}
        {activeGuideTab === 'bank_sms' && (
          <div className="space-y-3 bg-slate-50/70 border border-slate-200 rounded-2xl p-5 text-xs text-slate-700">
            <div className="flex items-center gap-2 text-emerald-700 font-bold">
              <Zap className="w-4 h-4" />
              <span>Zero-Touch Bank SMS Auto-Logging (iOS Automations)</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Automatically record transactions the instant your bank sends a debit or credit SMS alert without touching your phone:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-slate-600 text-[11px]">
              <li>
                In the <strong>Shortcuts</strong> app, tap the <strong>"Automation"</strong> tab at the bottom.
              </li>
              <li>
                Tap <strong>"+"</strong> → Choose <strong>"Message"</strong>.
              </li>
              <li>
                Set <em>Sender</em> to your bank (e.g. HDFC Bank, Chase, SBI, AMEX) and <em>Message Contains</em> to <code>debited</code> or <code>spent</code>.
              </li>
              <li>
                Set <em>Run Immediately</em> to <strong>True</strong> (Turn off "Notify When Run" for silent background execution).
              </li>
              <li>
                In the action block, use <strong>"Match Text"</strong> with regex <code>(?:INR|Rs\.?|\$)\s*([\d,]+\.?\d*)</code> to extract the spent amount, and send the POST request to <code>{baseUrl}/shortcuts/log</code>!
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Interactive Shortcut API Simulator / Test Runner */}
      {/* ---------------------------------------------------- */}
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Interactive Shortcut & API Simulator
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">Live Test Ping</span>
        </div>

        <form onSubmit={handleRunTest} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Amount</label>
              <input
                type="number"
                step="any"
                required
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                placeholder="350"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Title / Note</label>
              <input
                type="text"
                required
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="Coffee & Snacks"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Account</label>
              <select
                value={testAccount}
                onChange={(e) => setTestAccount(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name} ({a.currency}{a.balance})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Category</label>
              <select
                value={testCategory}
                onChange={(e) => setTestCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={handleCopyCurl}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {hasCopiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Code2 className="w-3.5 h-3.5" />}
              <span>{hasCopiedCurl ? 'cURL Copied!' : 'Copy cURL Command'}</span>
            </button>

            <button
              type="submit"
              disabled={isTesting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTesting ? 'Sending Request...' : 'Send Test Shortcut Request'}</span>
            </button>
          </div>
        </form>

        {testResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs space-y-2 ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <HelpCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.response && (
              <pre className="bg-white/80 p-2 rounded-lg text-[10px] font-mono overflow-x-auto text-slate-800 border border-emerald-200/60">
                {JSON.stringify(testResult.response, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4. Complete Endpoints Reference Accordion */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-blue-600" />
          Endpoints Reference & Schemas
        </h3>

        <div className="space-y-2">
          {/* Endpoint 1: Shortcuts Log */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setExpandedEndpoint(expandedEndpoint === 'shortcuts_log' ? '' : 'shortcuts_log')}
              className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  POST
                </span>
                <span className="font-mono text-xs font-bold text-slate-900 truncate">
                  /api/v1/shortcuts/log
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline truncate">
                  Fast transaction entry (Shortcuts/Siri)
                </span>
              </div>
              {expandedEndpoint === 'shortcuts_log' ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {expandedEndpoint === 'shortcuts_log' && (
              <div className="p-4 border-t border-slate-100 space-y-3 text-xs">
                <p className="text-slate-600 text-[11px]">
                  Optimized for mobile automations. Auto-matches accounts and applies categorization rules.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Request Body (JSON)</span>
                    <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-xl font-mono text-[10px] overflow-x-auto">
{`{
  "amount": 450,
  "title": "Starbucks Coffee",
  "account": "HDFC Bank",
  "category": "Food & Dining",
  "type": "expense"
}`}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Response (201 Created)</span>
                    <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded-xl font-mono text-[10px] overflow-x-auto">
{`{
  "success": true,
  "message": "Successfully logged expense",
  "transaction": {
    "id": "tx_12345",
    "amount": 450,
    "title": "Starbucks Coffee",
    "date": "2026-09-01"
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Endpoint 2: Standard Transactions */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setExpandedEndpoint(expandedEndpoint === 'transactions' ? '' : 'transactions')}
              className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  POST
                </span>
                <span className="font-mono text-xs font-bold text-slate-900 truncate">
                  /api/v1/transactions
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline truncate">
                  Create full transaction with custom IDs
                </span>
              </div>
              {expandedEndpoint === 'transactions' ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {expandedEndpoint === 'transactions' && (
              <div className="p-4 border-t border-slate-100 space-y-3 text-xs">
                <p className="text-slate-600 text-[11px]">
                  Full schema transaction endpoint for web applications and backend services.
                </p>
                <div className="bg-slate-900 text-slate-100 p-2.5 rounded-xl font-mono text-[10px] overflow-x-auto">
{`// Required fields: amount (number), title (string)
// Optional: type ("expense" | "income" | "transfer"), accountId, categoryId, notes, date, time`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
