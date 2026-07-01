import React, { useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { cn, formatRupiah } from '@/utils';
import { TrendingUp, Calendar, Ticket, DollarSign, Award, Zap } from 'lucide-react';

interface Booking {
  id: string;
  buyerName: string;
  marketingName: string;
  seatType: string;
  seatNumbers: string[];
  paymentMethod: string;
  paymentTenor: string;
  totalPrice: number;
  totalCost: number;
  verified: boolean;
  purchaseDate: string;
  settlementDate: string;
}

interface SalesTrendChartProps {
  bookings: Booking[];
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
];

const formatDateIndo = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${MONTH_NAMES[monthIdx] || ''} ${year}`;
};

export default function SalesTrendChart({ bookings }: SalesTrendChartProps) {
  const [metric, setMetric] = useState<'tickets' | 'revenue'>('tickets');
  const [trendType, setTrendType] = useState<'daily' | 'cumulative'>('daily');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 1. Agregasi data penjualan berdasarkan tanggal pembelian
  const chartData = useMemo(() => {
    if (!bookings || bookings.length === 0) return [];

    // Kelompokkan data harian
    const dailyMap: Record<string, { tickets: number; revenue: number }> = {};
    bookings.forEach(b => {
      const dateStr = b.purchaseDate || new Date().toISOString().split('T')[0];
      const ticketCount = b.seatNumbers ? b.seatNumbers.length : 0;
      const rev = b.totalPrice || 0;

      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { tickets: 0, revenue: 0 };
      }
      dailyMap[dateStr].tickets += ticketCount;
      dailyMap[dateStr].revenue += rev;
    });

    const dateKeys = Object.keys(dailyMap).sort();
    if (dateKeys.length === 0) return [];

    let firstDateStr = dateKeys[0];
    let lastDateStr = dateKeys[dateKeys.length - 1];

    const parseDate = (dStr: string) => {
      const [y, m, d] = dStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    const minDate = parseDate(firstDateStr);
    const maxDate = parseDate(lastDateStr);

    // Padding jika hanya ada 1 hari data agar linimasa tetap cantik
    if (firstDateStr === lastDateStr) {
      minDate.setDate(minDate.getDate() - 2);
      maxDate.setDate(maxDate.getDate() + 2);
    }

    const list: Array<{ dateStr: string; tickets: number; revenue: number; cumTickets: number; cumRevenue: number }> = [];
    const currentDate = new Date(minDate);
    
    let runningTickets = 0;
    let runningRevenue = 0;

    while (currentDate <= maxDate) {
      const yStr = currentDate.getFullYear();
      const mStr = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${yStr}-${mStr}-${dStr}`;

      const dayData = dailyMap[dateStr] || { tickets: 0, revenue: 0 };
      
      runningTickets += dayData.tickets;
      runningRevenue += dayData.revenue;

      list.push({
        dateStr,
        tickets: dayData.tickets,
        revenue: dayData.revenue,
        cumTickets: runningTickets,
        cumRevenue: runningRevenue,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return list;
  }, [bookings]);

  // 2. Rangkuman statistik untuk dashboard analitik
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { peakDate: '-', peakVal: 0, avgVal: 0 };
    }

    let maxVal = 0;
    let peakDate = '-';
    let totalVal = 0;

    chartData.forEach(d => {
      const val = metric === 'tickets' ? d.tickets : d.revenue;
      totalVal += val;
      if (val > maxVal) {
        maxVal = val;
        peakDate = d.dateStr;
      }
    });

    const avgVal = totalVal / chartData.length;
    return { peakDate, peakVal: maxVal, avgVal };
  }, [chartData, metric]);

  if (bookings.length === 0) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500 animate-pulse" />
            Tren Penjualan Tiket
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center text-gray-500">
          Belum ada data penjualan untuk menampilkan grafik tren.
        </CardContent>
      </Card>
    );
  }

  // Konfigurasi Dimensi Grafik
  const width = 600;
  const height = 220;
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Mendapatkan nilai untuk tiap titik
  const getValue = (item: typeof chartData[0]) => {
    if (metric === 'tickets') {
      return trendType === 'daily' ? item.tickets : item.cumTickets;
    } else {
      return trendType === 'daily' ? item.revenue : item.cumRevenue;
    }
  };

  const values = chartData.map(getValue);
  const maxVal = Math.max(...values, metric === 'tickets' ? 5 : 1000000);
  const minVal = 0;

  // Konversi koordinat
  const points = chartData.map((item, index) => {
    const x = paddingLeft + (chartData.length > 1 ? index / (chartData.length - 1) : 0.5) * chartWidth;
    const val = getValue(item);
    const y = paddingTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y, item, val };
  });

  // Membuat Path String
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  // Formatter untuk label Y-Axis
  const formatYLabel = (val: number) => {
    if (metric === 'tickets') {
      return `${Math.round(val)}`;
    } else {
      if (val >= 1000000) {
        return `Rp ${(val / 1000000).toFixed(1).replace('.0', '')}jt`;
      } else if (val >= 1000) {
        return `Rp ${(val / 1000).toFixed(0)}rb`;
      }
      return `Rp ${val}`;
    }
  };

  // Handler interaksi mouse
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current || chartData.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    
    const relativeX = mouseX - paddingLeft;
    const index = Math.round((relativeX / chartWidth) * (chartData.length - 1));
    const clampedIndex = Math.min(Math.max(index, 0), chartData.length - 1);
    setHoveredIndex(clampedIndex);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Titik yang sedang di-hover
  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  // Tooltip position & data
  const tooltipLeft = activePoint 
    ? (activePoint.x > width - 170 ? activePoint.x - 175 : activePoint.x + 15) 
    : 0;

  return (
    <Card className="border-white/10 bg-white/5 relative overflow-hidden group/card shadow-2xl">
      
      {/* Background glow ambient effect */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none group-hover/card:bg-amber-500/10 transition-all duration-700" />
      
      <CardHeader className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/5 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            Grafik Tren Penjualan Tiket
          </CardTitle>
          <p className="text-xs text-gray-400">Analisis perkembangan pesanan secara real-time</p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 z-10">
          
          {/* Metrik: Tiket vs Pendapatan */}
          <div className="flex bg-black/60 rounded-lg p-0.5 border border-white/10 text-xs">
            <button
              onClick={() => { setMetric('tickets'); setHoveredIndex(null); }}
              className={cn(
                "px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                metric === 'tickets' 
                  ? "bg-amber-500 text-black shadow-lg" 
                  : "text-gray-400 hover:text-white"
              )}
            >
              <Ticket className="w-3.5 h-3.5" />
              Tiket
            </button>
            <button
              onClick={() => { setMetric('revenue'); setHoveredIndex(null); }}
              className={cn(
                "px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                metric === 'revenue' 
                  ? "bg-amber-500 text-black shadow-lg" 
                  : "text-gray-400 hover:text-white"
              )}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Pendapatan
            </button>
          </div>

          {/* Tipe Tren: Harian vs Akumulasi */}
          <div className="flex bg-black/60 rounded-lg p-0.5 border border-white/10 text-xs">
            <button
              onClick={() => { setTrendType('daily'); setHoveredIndex(null); }}
              className={cn(
                "px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer",
                trendType === 'daily' 
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                  : "text-gray-400 hover:text-white border border-transparent"
              )}
            >
              Harian
            </button>
            <button
              onClick={() => { setTrendType('cumulative'); setHoveredIndex(null); }}
              className={cn(
                "px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer",
                trendType === 'cumulative' 
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                  : "text-gray-400 hover:text-white border border-transparent"
              )}
            >
              Akumulasi
            </button>
          </div>

        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        
        {/* Analytics Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Rentang Waktu</p>
              <p className="text-xs font-semibold text-gray-300">
                {formatDateIndo(chartData[0].dateStr)} - {formatDateIndo(chartData[chartData.length - 1].dateStr)}
              </p>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Penjualan Puncak</p>
              <p className="text-xs font-semibold text-gray-300">
                {metric === 'tickets' 
                  ? `${stats.peakVal} Tiket` 
                  : formatRupiah(stats.peakVal)}
                <span className="text-[10px] text-gray-500 font-normal ml-1">({formatDateIndo(stats.peakDate)})</span>
              </p>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Rata-rata {trendType === 'daily' ? 'Harian' : 'Akumulasi'}</p>
              <p className="text-xs font-semibold text-gray-300">
                {metric === 'tickets' 
                  ? `${stats.avgVal.toFixed(1)} Tiket / hari` 
                  : `${formatRupiah(Math.round(stats.avgVal))} / hari`}
              </p>
            </div>
          </div>

        </div>

        {/* SVG Chart Area */}
        <div className="relative w-full overflow-hidden select-none">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Definitions for Gradients and Filters */}
            <defs>
              <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
              </linearGradient>
              
              <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {Array.from({ length: 4 }).map((_, idx) => {
              const val = minVal + (maxVal - minVal) * (idx / 3);
              const y = paddingTop + chartHeight - (idx / 3) * chartHeight;
              return (
                <g key={idx} className="opacity-40">
                  {/* Gridline */}
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  {/* Y Label */}
                  <text
                    x={paddingLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="#9ca3af"
                    className="text-[9px] font-mono font-medium"
                  >
                    {formatYLabel(val)}
                  </text>
                </g>
              );
            })}

            {/* Area Path Under Curve */}
            {areaPath && (
              <path
                d={areaPath}
                fill="url(#chart-area-grad)"
                className="transition-all duration-500 ease-out"
              />
            )}

            {/* Line Path Curve */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#line-glow)"
                className="transition-all duration-500 ease-out"
              />
            )}

            {/* Dots and interactive hover triggers */}
            {points.map((p, idx) => {
              const isHovered = hoveredIndex === idx;
              return (
                <g key={idx} className="transition-all duration-300">
                  {/* Glowing halo around hovered point */}
                  {isHovered && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="7"
                      fill="#f59e0b"
                      fillOpacity="0.3"
                      className="animate-ping"
                    />
                  )}
                  {/* Solid dot core */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? "4.5" : "3.5"}
                    fill={isHovered ? "#ffffff" : "#f59e0b"}
                    stroke={isHovered ? "#f59e0b" : "#0a0a0a"}
                    strokeWidth={isHovered ? "2" : "1.5"}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}

            {/* Interactive Vertical Guidance Line */}
            {activePoint && (
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={paddingTop + chartHeight}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeOpacity="0.4"
                strokeDasharray="2 2"
                className="pointer-events-none"
              />
            )}

            {/* X-Axis Border line */}
            <line
              x1={paddingLeft}
              y1={paddingTop + chartHeight}
              x2={width - paddingRight}
              y2={paddingTop + chartHeight}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />

            {/* X-Axis Date Labels (showing first, middle, and last date to avoid clutter) */}
            {points.length > 0 && (
              <>
                {/* First Date */}
                <text
                  x={points[0].x}
                  y={paddingTop + chartHeight + 15}
                  textAnchor="middle"
                  fill="#6b7280"
                  className="text-[9px] font-mono"
                >
                  {formatDateIndo(points[0].item.dateStr).substring(0, 6)}
                </text>
                
                {/* Middle Date (only if length > 2) */}
                {points.length > 2 && (
                  <text
                    x={points[Math.floor(points.length / 2)].x}
                    y={paddingTop + chartHeight + 15}
                    textAnchor="middle"
                    fill="#6b7280"
                    className="text-[9px] font-mono"
                  >
                    {formatDateIndo(points[Math.floor(points.length / 2)].item.dateStr).substring(0, 6)}
                  </text>
                )}

                {/* Last Date */}
                {points.length > 1 && (
                  <text
                    x={points[points.length - 1].x}
                    y={paddingTop + chartHeight + 15}
                    textAnchor="middle"
                    fill="#6b7280"
                    className="text-[9px] font-mono"
                  >
                    {formatDateIndo(points[points.length - 1].item.dateStr).substring(0, 6)}
                  </text>
                )}
              </>
            )}
          </svg>

          {/* Interactive Floating Tooltip */}
          {activePoint && (
            <div
              style={{
                position: 'absolute',
                left: `${(tooltipLeft / width) * 100}%`,
                top: `${((activePoint.y - 85) / height) * 100}%`,
              }}
              className="w-40 bg-zinc-950/95 border border-amber-500/40 rounded-lg p-2.5 shadow-2xl pointer-events-none z-20 animate-in fade-in zoom-in duration-100 backdrop-blur-md"
            >
              <p className="text-[10px] text-gray-500 font-mono font-bold uppercase tracking-wider mb-1.5">
                {formatDateIndo(activePoint.item.dateStr)}
              </p>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Harian:</span>
                  <span className="font-bold font-mono text-amber-400">
                    {metric === 'tickets' 
                      ? `${activePoint.item.tickets} Tiket` 
                      : formatRupiah(activePoint.item.revenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] border-t border-white/5 pt-1 mt-1">
                  <span className="text-gray-500">Akumulasi:</span>
                  <span className="font-mono text-gray-300">
                    {metric === 'tickets' 
                      ? `${activePoint.item.cumTickets} Tiket` 
                      : formatRupiah(activePoint.item.cumRevenue)}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

      </CardContent>
    </Card>
  );
}
