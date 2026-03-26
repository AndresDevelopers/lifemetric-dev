'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from '@/components/providers/LocaleProvider';

export default function SummaryHeader({ initialFrom, initialTo }: { readonly initialFrom: string; readonly initialTo: string }) {
  const { messages } = useLocale();
  const summaryMessages = messages.summary;
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [showPicker, setShowPicker] = useState(false);
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);

  const applyRange = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', fromDate);
    params.set('to', toDate);
    router.push(`?${params.toString()}`);
    setShowPicker(false);
  };

  const isDefault = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    return fromDate === weekAgoStr && toDate === todayStr;
  };

  return (
    <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-sm pl-6 pr-16 md:pr-6 h-16 flex items-center justify-between border-b border-slate-200/50">
      <h1 className="text-xl font-black tracking-tighter text-blue-800 uppercase">{summaryMessages.title}</h1>
      
      <div className="relative">
        <button 
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100 hover:border-primary/30 transition-all active:scale-95 group"
        >
          <span className="text-sm font-black text-slate-700 uppercase tracking-tighter">
            {isDefault() ? summaryMessages.last7Days : `${fromDate} - ${toDate}`}
          </span>
          <span className="material-symbols-outlined text-primary group-hover:rotate-12 transition-transform">calendar_month</span>
        </button>

        {showPicker && (
          <div className="absolute right-0 mt-3 p-6 bg-white rounded-3xl shadow-2xl border border-slate-100 w-80 animate-in zoom-in-95 duration-200">
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">{summaryMessages.customRange}</h4>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">{summaryMessages.rangeFrom}</label>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">{summaryMessages.rangeTo}</label>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <button 
                onClick={applyRange}
                className="w-full bg-primary text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all mt-2 active:scale-95"
              >
                {messages.common.save}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
