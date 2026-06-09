import React, { useState, useMemo } from 'react';
import { useAppContext, PRICING, TicketBooking, SeatType } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatRupiah } from '@/utils';
import { format, differenceInDays } from 'date-fns';
import { AlertTriangle, CheckCircle2, TrendingUp, Users, DollarSign, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { bookings } = useAppContext();
  
  const showDate = new Date('2026-07-11T15:00:00+07:00');
  
  // Analytics
  const stats = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let soldSeats = 0;
    const marketingStats: Record<string, number> = {};
    const typeStats: Record<string, number> = {
      'Reguler - Depan': 0,
      'Reguler - Tengah': 0,
      'Reguler - Belakang': 0,
      'VIP': 0,
    };

    bookings.forEach(b => {
      revenue += b.totalPrice;
      soldSeats += b.seatNumbers.length;
      cost += b.totalCost || (PRICING[b.seatType].cost * b.seatNumbers.length);
      
      marketingStats[b.marketingName] = (marketingStats[b.marketingName] || 0) + b.seatNumbers.length;
      typeStats[b.seatType] += b.seatNumbers.length;
    });

    return { revenue, cost, profit: revenue - cost, soldSeats, marketingStats, typeStats };
  }, [bookings]);

  const totalCapacity = Object.values(PRICING).reduce((acc, curr) => acc + curr.capacity, 0);
  const costH7 = stats.cost * 0.5;
  const daysUntilShow = differenceInDays(showDate, new Date());
  
  // Warning computations
  const needs50PercentPayment = daysUntilShow <= 7 && daysUntilShow > 3;
  const needsFullPayment = daysUntilShow <= 3;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Penjualan Tiket</h1>
          <p className="text-gray-400">Ringkasan analitik dan manajemen pesanan event Nonton Bareng.</p>
        </div>
      </div>

      {/* Alert Banners */}
      {needs50PercentPayment && (
        <div className="bg-amber-500/10 border border-amber-500/50 rounded-xl p-4 flex gap-4 text-amber-200">
          <AlertTriangle className="shrink-0 text-amber-500" />
          <div>
            <h4 className="font-semibold text-amber-500">Peringatan Jatuh Tempo Pembayaran H-7!</h4>
            <p className="text-sm mt-1">Saat ini adalah H-7 sebelum penayangan. Segera bayarkan 50% biaya tiket ke pihak Cinepolis: <strong>{formatRupiah(costH7)}</strong> dari total tagihan {formatRupiah(stats.cost)}.</p>
          </div>
        </div>
      )}
      
      {needsFullPayment && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex gap-4 text-red-200">
          <AlertTriangle className="shrink-0 text-red-500" />
          <div>
            <h4 className="font-semibold text-red-500">Peringatan Jatuh Tempo Pembayaran H-3!</h4>
            <p className="text-sm mt-1">Sisa hari sangat singkat. Anda diwajibkan melunasi sisa tagihan tiket ke pihak Cinepolis secara penuh: <strong>{formatRupiah(stats.cost)}</strong>.</p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Penjualan" value={formatRupiah(stats.revenue)} icon={<TrendingUp />} />
        <MetricCard title="Total Cost Cinepolis" value={formatRupiah(stats.cost)} icon={<DollarSign />} />
        <MetricCard title="Proyeksi Laba Bersih" value={formatRupiah(stats.profit)} icon={<CheckCircle2 />} className="text-green-500" />
        <MetricCard title="Tiket Terjual" value={`${stats.soldSeats} / ${totalCapacity}`} icon={<Ticket />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Availability Progress */}
        <Card className="lg:col-span-1 border-white/10">
          <CardHeader>
            <CardTitle>Ketersediaan Kursi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(PRICING).map(([type, info]) => {
              const sold = stats.typeStats[type] || 0;
              const percent = (sold / info.capacity) * 100;
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300">{type}</span>
                    <span className="font-mono text-gray-400">{info.capacity - sold} sisa</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5">
                    <div className="bg-amber-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}></div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Marketing Leaderboard */}
        <Card className="lg:col-span-2 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-amber-500" /> Sebaran Penjualan (Tim Marketing)</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.marketingStats).length === 0 ? (
               <div className="text-gray-500 py-8 text-center">Belum ada data penjualan dari tim marketing.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(stats.marketingStats).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([name, count], i) => (
                    <div key={name} className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center font-bold text-amber-500 text-sm">#{i+1}</div>
                        <span className="font-medium text-gray-200">{name}</span>
                      </div>
                      <span className="font-mono bg-black px-3 py-1 rounded text-sm text-amber-500">{count} Tiket</span>
                    </div>
                  ))}
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="border-white/10 overflow-hidden">
        <CardHeader>
          <CardTitle>Daftar Pesanan Tiket</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 text-gray-400 uppercase text-[10px] tracking-wider border-y border-white/10 sticky top-0">
              <tr>
                <th className="p-4">Pembeli & Waktu</th>
                <th className="p-4">Tipe & Kursi</th>
                <th className="p-4">Total</th>
                <th className="p-4">Status & Tenor</th>
                <th className="p-4">Marketing</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 py-12 text-center text-gray-500">
                    Tidak ada data penjualan tiket.
                  </td>
                </tr>
              ) : bookings.map((b) => (
                <tr key={b.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-gray-200">{b.buyerName}</div>
                    <div className="text-[10px] text-gray-500 font-mono mt-1">Beli: {b.purchaseDate || '-'}</div>
                    {b.settlementDate && <div className="text-[10px] text-green-500/70 font-mono">Lunas: {b.settlementDate}</div>}
                  </td>
                  <td className="p-4">
                    <span className="bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md text-[10px] font-bold">
                      {b.seatType}: {b.seatNumbers.join(', ')}
                    </span>
                  </td>
                  <td className="p-4 text-gray-200 font-mono text-xs">{formatRupiah(b.totalPrice)}</td>
                  <td className="p-4">
                     <div className="flex gap-2 items-center">
                       {b.verified ? (
                         <span className="text-green-500 font-bold flex items-center gap-1 text-xs">● Verified ({b.paymentTenor})</span>
                       ) : (
                         <span className="text-amber-500 font-bold flex items-center gap-1 text-xs">● Pending ({b.paymentTenor})</span>
                       )}
                     </div>
                  </td>
                  <td className="p-4 text-gray-400 text-xs">{b.marketingName}</td>
                  <td className="p-4 text-right space-x-2">
                    <Link to={`/ticket/${b.id}`} className="text-amber-500 hover:text-amber-400 font-bold text-xs underline underline-offset-4">Ticket</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, icon, className = "" }: { title: string; value: string; icon: React.ReactNode, className?: string }) {
  return (
    <Card className="border-white/10 bg-white/5 relative overflow-hidden">
      <div className="absolute right-0 top-0 opacity-[0.02] text-amber-500 transform scale-[3] -translate-y-2 translate-x-4">
        {icon}
      </div>
      <CardContent className="p-4 md:p-5 relative z-10 text-white">
        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 mt-2">{title}</p>
        <div className={`text-2xl font-bold font-sans ${className}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
