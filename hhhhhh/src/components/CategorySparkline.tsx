import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MonthlySpendPoint {
  monthKey: string;
  shortLabel: string;
  fullLabel: string;
  amount: number;
}

interface CategorySparklineProps {
  data: MonthlySpendPoint[];
  color: string;
  currency: string;
  width?: number;
  height?: number;
}

export const CategorySparkline: React.FC<CategorySparklineProps> = ({
  data,
  color,
  currency,
  width = 68,
  height = 24,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return null;
  }

  const amounts = data.map((d) => d.amount);
  const maxVal = Math.max(...amounts, 0);
  const minVal = Math.min(...amounts);
  const allZero = maxVal === 0;

  // Calculate 6-month metrics
  const total6M = amounts.reduce((sum, a) => sum + a, 0);
  const avg6M = Math.round(total6M / data.length);
  const latestAmount = data[data.length - 1]?.amount || 0;
  const previousAmount = data.length >= 2 ? data[data.length - 2]?.amount || 0 : 0;
  const diffFromPrev = latestAmount - previousAmount;
  const percentChangePrev = previousAmount > 0 
    ? Math.round((diffFromPrev / previousAmount) * 100) 
    : (latestAmount > 0 ? 100 : 0);

  // SVG Geometry Calculation
  const xPad = 4;
  const yPad = 4;
  const graphWidth = width - 2 * xPad;
  const graphHeight = height - 2 * yPad;

  const points = data.map((d, i) => {
    const x = xPad + (i / Math.max(1, data.length - 1)) * graphWidth;
    let y = height - yPad;
    if (!allZero && maxVal > 0) {
      y = (height - yPad) - (d.amount / maxVal) * graphHeight;
    }
    return {
      x,
      y: Number.isFinite(y) ? y : height - yPad,
      amount: d.amount,
      shortLabel: d.shortLabel,
      fullLabel: d.fullLabel,
    };
  });

  // Build smooth bezier path
  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaD = pathD ? `${pathD} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z` : '';

  // Safe unique ID for gradient
  const gradientId = `spark-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}-${data[0]?.monthKey || 'default'}`;

  return (
    <div 
      className="relative flex items-center group/spark cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredIndex(null);
      }}
    >
      {/* SVG Canvas */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill Gradient Area */}
        {!allZero && areaD && (
          <path d={areaD} fill={`url(#${gradientId})`} />
        )}

        {/* Flat dashed baseline if all 0 */}
        {allZero ? (
          <line
            x1={xPad}
            y1={height - yPad}
            x2={width - xPad}
            y2={height - yPad}
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="2 3"
          />
        ) : (
          /* Smooth Sparkline Path */
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* End dot on latest month */}
        {!allZero && lastPoint && (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="2.5"
            fill={color}
            stroke="#FFFFFF"
            strokeWidth="1"
          />
        )}

        {/* Active hovered point dot */}
        {hoveredIndex !== null && points[hoveredIndex] && !allZero && (
          <circle
            cx={points[hoveredIndex].x}
            cy={points[hoveredIndex].y}
            r="3.5"
            fill="#FFFFFF"
            stroke={color}
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Floating Rich Popover Tooltip on Hover */}
      {isHovered && (
        <div 
          className="absolute bottom-full right-0 mb-2 z-50 p-3 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800 w-64 text-left pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tooltip Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                6-Month Spending Trend
              </span>
            </div>
            {/* Trend direction badge */}
            {!allZero && (
              <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                diffFromPrev > 0 
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50' 
                  : diffFromPrev < 0 
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50' 
                    : 'bg-slate-800 text-slate-400'
              }`}>
                {diffFromPrev > 0 ? (
                  <>
                    <TrendingUp className="w-2.5 h-2.5" />
                    <span>+{percentChangePrev}%</span>
                  </>
                ) : diffFromPrev < 0 ? (
                  <>
                    <TrendingDown className="w-2.5 h-2.5" />
                    <span>{percentChangePrev}%</span>
                  </>
                ) : (
                  <>
                    <Minus className="w-2.5 h-2.5" />
                    <span>0%</span>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Month-by-Month Mini Bar Breakdown */}
          <div className="grid grid-cols-6 gap-1 mb-2.5 pt-1">
            {data.map((item, idx) => {
              const barPercent = maxVal > 0 ? Math.min(100, Math.max(8, (item.amount / maxVal) * 100)) : 8;
              const isSelected = hoveredIndex === idx || (hoveredIndex === null && idx === data.length - 1);
              return (
                <div 
                  key={item.monthKey}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  className={`flex flex-col items-center gap-1 p-1 rounded-lg transition cursor-pointer ${
                    isSelected ? 'bg-slate-800 ring-1 ring-slate-700' : 'hover:bg-slate-800/60'
                  }`}
                >
                  <div className="w-full h-10 flex items-end justify-center">
                    <div 
                      className="w-full rounded-t transition-all"
                      style={{ 
                        height: `${item.amount > 0 ? barPercent : 4}%`,
                        backgroundColor: item.amount > 0 ? (isSelected ? color : `${color}B3`) : '#475569'
                      }}
                    />
                  </div>
                  <span className={`text-[9px] font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                    {item.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Details for Selected Month or Summary */}
          {hoveredIndex !== null ? (
            <div className="bg-slate-800/80 rounded-xl p-2 text-xs flex items-center justify-between border border-slate-700/50">
              <span className="text-slate-300 font-medium">{data[hoveredIndex]?.fullLabel}:</span>
              <span className="font-extrabold text-white">
                {currency}{data[hoveredIndex]?.amount.toLocaleString('en-IN')}
              </span>
            </div>
          ) : (
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>6M Total:</span>
                <span className="font-bold text-slate-200">{currency}{total6M.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>6M Monthly Avg:</span>
                <span className="font-bold text-slate-200">{currency}{avg6M.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
