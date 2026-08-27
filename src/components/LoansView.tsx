import React, { useState } from 'react';
import { 
  Landmark, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Percent, 
  AlertCircle, 
  CreditCard,
  Building2,
  TrendingDown,
  Sparkles
} from 'lucide-react';
import { Account, LoanEMI, UserProfile } from '../types';

interface LoansViewProps {
  user: UserProfile;
  loans: LoanEMI[];
  accounts: Account[];
  onAddLoan: (loan: Partial<LoanEMI>) => void;
  onPayEMI: (emi: LoanEMI, fromAccountId: string, amount: number) => void;
}

export const LoansView: React.FC<LoansViewProps> = ({
  user,
  loans,
  accounts,
  onAddLoan,
  onPayEMI,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [payingLoan, setPayingLoan] = useState<LoanEMI | null>(null);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [customPayAmount, setCustomPayAmount] = useState('');

  // Add Loan Form State
  const [loanName, setLoanName] = useState('');
  const [lender, setLender] = useState('');
  const [totalPrincipal, setTotalPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [monthlyEMI, setMonthlyEMI] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');
  const [paidMonths, setPaidMonths] = useState('0');
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [category, setCategory] = useState('Gadgets');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextDueDate, setNextDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const activeLoans = loans.filter(l => l.status === 'active');
  const totalPrincipalRemaining = activeLoans.reduce((sum, l) => sum + l.remainingPrincipal, 0);
  const totalMonthlyEMIs = activeLoans.reduce((sum, l) => sum + l.monthlyEMI, 0);

  const bankAccounts = accounts.filter(a => a.type === 'bank' || a.type === 'cash');

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanName || !totalPrincipal || !monthlyEMI) return;

    const principal = Number(totalPrincipal);
    const tenure = Number(tenureMonths) || 12;
    const paid = Number(paidMonths) || 0;
    const emiAmount = Number(monthlyEMI);
    const remaining = Math.max(0, principal - (paid * emiAmount));

    onAddLoan({
      name: loanName,
      lender: lender || 'Bank Lender',
      totalPrincipal: principal,
      remainingPrincipal: remaining,
      interestRate: Number(interestRate) || 0,
      monthlyEMI: emiAmount,
      totalTenureMonths: tenure,
      paidTenureMonths: paid,
      linkedAccountId: linkedAccountId || (bankAccounts[0]?.id || 'acc-1'),
      startDate,
      nextDueDate: nextDueDate || '2026-09-05',
      category,
      notes,
      status: 'active',
    });

    setIsAddModalOpen(false);
    // Reset
    setLoanName('');
    setLender('');
    setTotalPrincipal('');
    setMonthlyEMI('');
    setTenureMonths('');
    setInterestRate('');
  };

  const handleExecuteEMIPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingLoan || !selectedBankId) return;
    const amount = Number(customPayAmount) || payingLoan.monthlyEMI;
    onPayEMI(payingLoan, selectedBankId, amount);
    setPayingLoan(null);
    setCustomPayAmount('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Loans
          </h1>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          id="btn-add-loan"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Loan / EMI</span>
        </button>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Total Outstanding Principal</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 privacy-value">
            {user.currency}{totalPrincipalRemaining.toLocaleString()}
          </div>
          <p className="text-xs text-slate-600 mt-1">Across {activeLoans.length} active loans & EMIs</p>
        </div>

        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Total Monthly EMI Outflow</span>
          <div className="text-2xl font-extrabold text-rose-600 mt-1 privacy-value">
            {user.currency}{totalMonthlyEMIs.toLocaleString()}
          </div>
          <p className="text-xs text-slate-600 mt-1">Auto-deducted every month</p>
        </div>
      </div>

      {/* Loan Cards List */}
      {loans.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Landmark className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Loans or EMIs Added</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Track gadget EMIs, education loans, personal loans, or mortgages. When you record EMI payments, your principal and tenure update automatically.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Loan or EMI</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loans.map((loan) => {
          const progressPercent = Math.round((loan.paidTenureMonths / loan.totalTenureMonths) * 100);
          const linkedAcc = accounts.find(a => a.id === loan.linkedAccountId);

          return (
            <div
              key={loan.id}
              className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {loan.category}
                        </span>
                        {loan.interestRate === 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            0% No Cost EMI
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-slate-900 mt-1">{loan.name}</h3>
                      <p className="text-xs text-slate-700">{loan.lender}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-700 block">Monthly EMI</span>
                    <span className="font-extrabold text-lg text-slate-900 privacy-value">
                      {user.currency}{loan.monthlyEMI.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex justify-between text-xs text-slate-700">
                    <span>
                      Tenure: <strong className="text-slate-800">{loan.paidTenureMonths}</strong> of {loan.totalTenureMonths} Months
                    </span>
                    <span className="font-bold text-slate-700">{progressPercent}% Completed</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs text-slate-700">
                    <div>
                      <span>Remaining Principal:</span>
                      <p className="font-bold text-slate-900 text-sm privacy-value">{user.currency}{loan.remainingPrincipal.toLocaleString()}</p>
                    </div>
                    <div>
                      <span>Original Loan Amount:</span>
                      <p className="font-semibold text-slate-700 text-sm privacy-value">{user.currency}{loan.totalPrincipal.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-700" />
                    <span>Next Due: <strong>{new Date(loan.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-slate-700" />
                    <span>Interest: <strong>{loan.interestRate}% p.a.</strong></span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-700">
                  Linked Account: <strong className="text-slate-800">{linkedAcc ? linkedAcc.name : 'Primary Bank'}</strong>
                  {loan.notes && <span className="text-slate-700 block mt-0.5 italic">"{loan.notes}"</span>}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-700">
                  {loan.totalTenureMonths - loan.paidTenureMonths} installments left
                </span>
                <button
                  onClick={() => {
                    setPayingLoan(loan);
                    setSelectedBankId(loan.linkedAccountId);
                    setCustomPayAmount(String(loan.monthlyEMI));
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-95"
                >
                  Pay Monthly Installment
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* MODAL 1: Add New Loan / EMI */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Add New Loan or EMI</h2>
            <p className="text-xs text-slate-700 mb-4">
              Track gadgets, vehicles, personal loans, or mortgages with automated tenure calculation.
            </p>

            <form onSubmit={handleCreateLoan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Loan / EMI Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro M3, Car Loan, Home Loan"
                  value={loanName}
                  onChange={(e) => setLoanName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Lender / Bank</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC, ICICI, Apple Financial"
                    value={lender}
                    onChange={(e) => setLender(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="Gadgets">Gadgets & Electronics</option>
                    <option value="Automobile">Automobile & Vehicle</option>
                    <option value="Home">Home & Mortgage</option>
                    <option value="Personal">Personal Loan</option>
                    <option value="Education">Education Loan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Total Loan Amount ({user.currency})</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 150000"
                    value={totalPrincipal}
                    onChange={(e) => setTotalPrincipal(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Monthly EMI Amount ({user.currency})</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 12500"
                    value={monthlyEMI}
                    onChange={(e) => setMonthlyEMI(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Total Months</label>
                  <input
                    type="number"
                    placeholder="e.g. 12"
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Already Paid</label>
                  <input
                    type="number"
                    placeholder="e.g. 3"
                    value={paidMonths}
                    onChange={(e) => setPaidMonths(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Interest % p.a.</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 8.5 (or 0)"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Linked Bank Account (For Deductions)</label>
                <select
                  value={linkedAccountId}
                  onChange={(e) => setLinkedAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency}{a.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Next Due Date</label>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  Save Loan & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Pay Monthly EMI Installment */}
      {payingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Pay Monthly Loan EMI</h2>
            <p className="text-xs text-slate-700 mb-4">
              Installment #{payingLoan.paidTenureMonths + 1} of {payingLoan.totalTenureMonths} for <strong>{payingLoan.name}</strong>
            </p>

            <form onSubmit={handleExecuteEMIPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Debit From Bank Account</label>
                <select
                  required
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: {a.currency}{a.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Payment Amount ({user.currency})</label>
                <input
                  type="number"
                  required
                  value={customPayAmount}
                  onChange={(e) => setCustomPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayingLoan(null)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  Confirm & Deduct EMI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
