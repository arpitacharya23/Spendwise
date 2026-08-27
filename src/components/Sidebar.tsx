import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Calendar, 
  Wallet, 
  Landmark, 
  Users2, 
  UserCheck, 
  BarChart3, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X, 
  TrendingUp, 
  Palette, 
  Target 
} from 'lucide-react';
import { UserProfile } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: UserProfile;
  netWorth: number;
  totalDebts: number;
  onQuickAdd: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  netWorth,
  totalDebts,
  onQuickAdd,
  isCollapsed,
  setIsCollapsed,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'budgets', label: 'Budgets', icon: Target },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'categories', label: 'Categories', icon: Palette },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'loans', label: 'Loans', icon: Landmark },
    { id: 'groups', label: 'Splitwise', icon: Users2 },
    { id: 'friends', label: 'Friends', icon: UserCheck },
    { id: 'reports', label: 'Analytics', icon: BarChart3 },
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white px-4 h-16 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white">SpendWise</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onQuickAdd}
            className="p-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow flex items-center gap-1"
            title="Add Expense"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white"
            aria-label="Toggle menu"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Backdrop Drawer */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex"
          onClick={() => setIsMobileOpen(false)}
        >
          <div 
            className="w-72 bg-slate-900 border-r border-slate-800 text-white h-full p-4 flex flex-col justify-between shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Brand */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-white">SpendWise</h2>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav Items */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Drawer Bottom: Net Worth pill only */}
            <div className="pt-4 border-t border-slate-800 group">
              <div className="p-3 bg-slate-800/80 rounded-xl text-xs">
                <div className="flex items-center justify-between text-slate-400 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Net Worth</span>
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className={`text-sm font-extrabold privacy-value ${netWorth >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {user.currency}{netWorth.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sticky Left Sidebar */}
      <aside 
        className={`hidden lg:flex flex-col justify-between sticky top-0 h-screen bg-slate-900 border-r border-slate-800 text-slate-200 transition-all duration-200 ease-out z-30 flex-shrink-0 ${
          isCollapsed ? 'w-20 p-3 items-center' : 'w-64 p-4'
        }`}
      >
        {/* Top Section: Brand & Nav */}
        <div className="space-y-4 w-full">
          {/* Brand Header & Collapse Toggle */}
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2.5 w-full">
              <div className="relative group flex items-center justify-center">
                <div 
                  className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center font-bold text-white shadow cursor-pointer transition"
                  onClick={() => setActiveTab('dashboard')}
                >
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                {/* 200ms Fast Popover Tooltip */}
                <div className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-[200ms] z-50">
                  SpendWise Dashboard
                </div>
              </div>
              <button
                onClick={() => setIsCollapsed(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center space-x-3 cursor-pointer overflow-hidden"
                onClick={() => setActiveTab('dashboard')}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow flex-shrink-0">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-base tracking-tight text-white truncate">
                    SpendWise
                  </span>
                </div>
              </div>

              {/* Collapse Button */}
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition flex-shrink-0 cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1 pt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <div key={item.id} className="relative group w-full">
                  <button
                    id={`nav-${item.id}`}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-2.5' : 'space-x-3 px-3 py-2.5'} rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>

                  {/* Fast 200ms tooltip when sidebar is collapsed */}
                  {isCollapsed && (
                    <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-[200ms] z-50">
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Net Worth Summary Card */}
        {!isCollapsed && (
          <div className="pt-3 border-t border-slate-800 w-full group">
            <div className="p-3 bg-slate-800/60 hover:bg-slate-800/90 rounded-2xl border border-slate-800/80 text-xs transition cursor-default">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Net Worth</span>
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className={`text-base font-extrabold privacy-value ${netWorth >= 0 ? 'text-white' : 'text-rose-400'}`}>
                {user.currency}{netWorth.toLocaleString()}
              </div>
              <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Total Debts:</span>
                <span className="font-semibold text-slate-300 privacy-value">{user.currency}{totalDebts.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
