import React, { useState, useEffect, useMemo } from 'react';
import { PRICING, SeatType } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatRupiah, cn } from '@/utils';
import { format, differenceInDays } from 'date-fns';
import { AlertTriangle, CheckCircle2, TrendingUp, Users, Ticket, Loader2, FileText, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 
import { Button } from '@/components/ui/Button';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import SalesTrendChart, { RupiahIcon } from '@/components/SalesTrendChart';

 
export default function Dashboard() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const showDate = new Date('2026-07-11T11:30:00+07:00');

  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const query = searchQuery.toLowerCase();
    return bookings.filter(b => 
      b.buyerName.toLowerCase().includes(query) || 
      b.marketingName.toLowerCase().includes(query) ||
      b.seatNumbers.some((s: string) => s.toLowerCase().includes(query)) ||
      b.seatType.toLowerCase().includes(query) ||
      b.id.toLowerCase().includes(query)
    );
  }, [bookings, searchQuery]);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('*')
          .order('created_at', { ascending: false }); 

        if (error) throw error;

        const formattedData = data.map((row: any) => {
          let seatCost = 0;
          const seatNumbers = row.seat_numbers || [];
          seatNumbers.forEach((seatId: string) => {
            const prefix = seatId.split('-')[0];
            const type = (Object.keys(PRICING) as SeatType[]).find(t => PRICING[t].prefix === prefix);
            if (type) {
              seatCost += PRICING[type].cost;
            }
          });
          return {
            id: row.id,
            buyerName: row.buyer_name,
            marketingName: row.marketing_name,
            seatType: row.seat_type as SeatType,
            seatNumbers: seatNumbers,
            paymentMethod: row.payment_method,
            paymentTenor: row.payment_tenor,
            totalPrice: row.total_price,
            totalCost: seatCost,
            verified: row.is_verified,
            purchaseDate: row.purchase_date,
            settlementDate: row.settlement_date,
            paymentProofUrl: row.payment_proof_url
          };
        });

        setBookings(formattedData);
      } catch (error) {
        console.error("Gagal menarik data dari Supabase:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, []);
  
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
      
      marketingStats[b.marketingName] = (marketingStats[b.marketingName] || 0) + b.seatNumbers.length;
      b.seatNumbers.forEach((seat: string) => {
        const prefix = seat.split('-')[0];
        const type = (Object.keys(PRICING) as SeatType[]).find(t => PRICING[t].prefix === prefix);
        if (type && typeStats[type] !== undefined) {
          typeStats[type] += 1;
        }
      });
    });

    let potentialRevenue = 0;
    Object.entries(PRICING).forEach(([type, info]) => {
      const sold = typeStats[type] || 0;
      const remaining = info.capacity - sold;
      if (remaining > 0) {
        potentialRevenue += remaining * info.price;
      }
    });

    const fixedCost = 76695000;
    return { revenue, cost: fixedCost, profit: revenue - fixedCost, soldSeats, marketingStats, typeStats, potentialRevenue };
  }, [bookings]);

  const totalCapacity = Object.values(PRICING).reduce((acc, curr) => acc + curr.capacity, 0);
  const costH7 = stats.cost * 0.5;
  const daysUntilShow = differenceInDays(showDate, new Date());
  
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

      <Button 
        onClick={() => downloadAllBookingsPDF(bookings)} 
        className="bg-amber-500 hover:bg-amber-600 text-black font-bold whitespace-nowrap"
      >
        <FileText className="w-4 h-4 mr-2" /> Cetak Manifes Booking
      </Button>

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

      {/* Tampilan Loading Data */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-amber-500 gap-4">
           <Loader2 className="w-10 h-10 animate-spin" />
           <p className="text-gray-400 font-medium tracking-wider animate-pulse">Menarik data dari database...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <MetricCard title="Total Penjualan" value={formatRupiah(stats.revenue)} icon={<TrendingUp />} />
            <MetricCard title="Total Cost Cinepolis" value={formatRupiah(stats.cost)} icon={<RupiahIcon />} />
            <MetricCard title="Proyeksi Laba Bersih" value={formatRupiah(stats.profit)} icon={<CheckCircle2 />} className="text-green-500" />
            <MetricCard title="Potensi Sisa Penjualan" value={formatRupiah(stats.potentialRevenue)} icon={<RupiahIcon />} className="text-blue-400" />
            <MetricCard title="Tiket Terjual" value={`${stats.soldSeats} / ${totalCapacity}`} icon={<Ticket />} />
          </div>

          {/* Sales Trend Chart */}
          <SalesTrendChart bookings={bookings} />

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
                      <div className="flex justify-between text-sm mb-2 items-end">
                        <span className="text-gray-300">{type}</span>
                        <div className="font-mono text-right">
                          <span className="text-amber-500">{sold}</span>
                          <span className="text-gray-500">/{info.capacity} terjual</span>
                          <span className="text-gray-600 mx-2">|</span>
                          <span className="text-gray-400">{info.capacity - sold} sisa</span>
                        </div>
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
                      {Object.entries(stats.marketingStats).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([name, count], i) => {
                        const isSelected = searchQuery.toLowerCase() === name.toLowerCase();
                        return (
                          <button 
                            key={name} 
                            onClick={() => setSearchQuery(isSelected ? '' : name)}
                            className={cn(
                              "flex justify-between items-center p-4 rounded-xl border transition-all text-left w-full group",
                              isSelected
                                ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center font-bold text-amber-500 text-sm">#{i+1}</div>
                              <span className="font-medium text-gray-200 group-hover:text-amber-400 transition-colors">{name}</span>
                            </div>
                            <span className="font-mono bg-black px-3 py-1 rounded text-sm text-amber-500">{count} Tiket</span>
                          </button>
                        );
                      })}
                    </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Table */}
          <Card className="border-white/10 overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle>Daftar Pesanan Tiket</CardTitle>
              
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Cari nama, marketing, kursi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-8 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 animate-in fade-in"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </CardHeader>
            {/* Desktop Table View (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
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
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 py-12 text-center text-gray-500">
                        {bookings.length === 0 ? "Tidak ada data penjualan tiket." : "Tidak ada tiket yang cocok dengan pencarian Anda."}
                      </td>
                    </tr>
                  ) : filteredBookings.map((b) => (
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

            {/* Mobile Cards View (shown on mobile, hidden on desktop) */}
            <div className="block md:hidden p-4 space-y-4">
              {filteredBookings.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  {bookings.length === 0 ? "Tidak ada data penjualan tiket." : "Tidak ada tiket yang cocok dengan pencarian Anda."}
                </div>
              ) : (
                filteredBookings.map((b) => (
                  <div key={b.id} className="p-4 space-y-3 bg-white/5 border border-white/10 rounded-xl transition-colors hover:border-amber-500/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-200 text-base">{b.buyerName}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">Beli: {b.purchaseDate || '-'}</div>
                        {b.settlementDate && <div className="text-[10px] text-green-500/70 font-mono">Lunas: {b.settlementDate}</div>}
                      </div>
                      <Link to={`/ticket/${b.id}`}>
                        <Button variant="outline" className="h-8 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                          Tiket
                        </Button>
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold">
                        {b.seatNumbers.join(', ')}
                      </span>
                      {b.verified ? (
                        <span className="bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                          Lunas ({b.paymentTenor})
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                          Pending ({b.paymentTenor})
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-1 text-xs">
                      <div className="text-gray-400">
                        Marketing: <span className="text-gray-300 font-medium">{b.marketingName}</span>
                      </div>
                      <div className="font-mono font-bold text-amber-500 text-sm">
                        {formatRupiah(b.totalPrice)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}
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

const isVipBogo = (ticket: any) => {
  if (!ticket.seatNumbers && !ticket.seat_numbers) return false;
  const seats = ticket.seatNumbers || ticket.seat_numbers || [];
  const vipSeats = seats.filter((s: string) => s.startsWith('V-'));
  if (vipSeats.length < 2) return false;
  const totalPrice = ticket.totalPrice || ticket.total_price || 0;
  const normalVipPrice = vipSeats.length * 2500000;
  return totalPrice < normalVipPrice;
};

const isFreeUpgrade = (ticket: any) => {
  const seatType = ticket.seatType || ticket.seat_type || '';
  return seatType && (seatType.includes('Upgrade dari Depan') || seatType.includes('Upgrade dari Belakang'));
};

const downloadAllBookingsPDF = (allTickets: any[]) => {
  try {
    const pdf = new jsPDF('l', 'mm', 'a4');
    const today = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // 1. DESAIN HEADER LAPORAN
    pdf.setFillColor(10, 10, 10);
    pdf.rect(0, 0, 297, 35, 'F'); 

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('CINEMATIX', 15, 15);

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(245, 158, 11); 
    pdf.text('Laporan Manifes Pemesanan Tiket & Rekapitulasi Finansial', 15, 22);

    pdf.setTextColor(150, 150, 150);
    pdf.text(`Tanggal Cetak: ${today}`, 240, 22);

    // 2. HITUNG RINGKASAN DATA & FINANSIAL PER KLASIFIKASI
    const totalTiket = allTickets.length;
    
    // Mengelompokkan rincian kapasitas dan terjual per kategori kursi
    // Menggunakan fallback (rows * cols) jika property capacity tidak ditulis eksplisit
    const statsPerType: Record<string, { sold: number, cap: number }> = {
      'Reguler - Depan': { sold: 0, cap: PRICING['Reguler - Depan']?.capacity || (PRICING['Reguler - Depan']?.rows * PRICING['Reguler - Depan']?.cols) || 0 },
      'Reguler - Tengah': { sold: 0, cap: PRICING['Reguler - Tengah']?.capacity || (PRICING['Reguler - Tengah']?.rows * PRICING['Reguler - Tengah']?.cols) || 0 },
      'Reguler - Belakang': { sold: 0, cap: PRICING['Reguler - Belakang']?.capacity || (PRICING['Reguler - Belakang']?.rows * PRICING['Reguler - Belakang']?.cols) || 0 },
      'VIP': { sold: 0, cap: PRICING['VIP']?.capacity || (PRICING['VIP']?.rows * PRICING['VIP']?.cols) || 0 }
    };

    let totalKursiTerjual = 0;

    // Menghitung jumlah kursi terjual untuk setiap tipe
    allTickets.forEach(t => {
      const seats = t.seatNumbers || t.seat_numbers || [];
      totalKursiTerjual += seats.length;
      
      seats.forEach((seat: string) => {
        const prefix = seat.split('-')[0];
        const type = (Object.keys(PRICING) as SeatType[]).find(key => PRICING[key].prefix === prefix);
        if (type && statsPerType[type]) {
          statsPerType[type].sold += 1;
        }
      });
    });

    const totalKapasitas = Object.values(statsPerType).reduce((sum, item) => sum + item.cap, 0);
    const kursiTersedia = totalKapasitas - totalKursiTerjual;

    const totalPendapatan = allTickets
      .filter(t => t.verified || t.is_verified)
      .reduce((acc, current) => acc + (current.totalPrice || current.total_price || 0), 0);

    const formatRupiahLocal = (angka: number) => {
      return 'Rp ' + (angka || 0).toLocaleString('id-ID');
    };

    // 3. KOTAK STATISTIK MANIFES (Diperlebar menjadi 26mm)
    pdf.setFillColor(245, 245, 245);
    pdf.rect(15, 42, 267, 26, 'F'); 

    pdf.setTextColor(50, 50, 50);
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(9);
    
    // Baris 1: Ringkasan Tiket & Pendapatan
    pdf.text(`Total Pemesanan: ${totalTiket} Tiket`, 20, 48);
    pdf.text(`Total Pendapatan (Lunas): ${formatRupiahLocal(totalPendapatan)}`, 190, 48);

    // Baris 2: Ringkasan Global
    pdf.text(`Ringkasan Global:`, 20, 55);
    pdf.setFont('Helvetica', 'normal');
    pdf.text(`Terjual: ${totalKursiTerjual} Kursi   |   Tersedia: ${kursiTersedia} Kursi   |   Total Kapasitas: ${totalKapasitas} Kursi`, 50, 55);

    // Baris 3: Rincian per Klasifikasi Kursi
    pdf.setFont('Helvetica', 'bold');
    pdf.text(`Rincian Kategori:`, 20, 62);
    pdf.setFont('Helvetica', 'normal');
    
    const d = statsPerType['Reguler - Depan'];
    const t = statsPerType['Reguler - Tengah'];
    const b = statsPerType['Reguler - Belakang'];
    const v = statsPerType['VIP'];
    
    // Contoh Hasil: Depan (12/20) • Tengah (30/50) • Belakang (15/30) • VIP (5/10)
    pdf.text(`Depan (${d.sold}/${d.cap})   •   Tengah (${t.sold}/${t.cap})   •   Belakang (${b.sold}/${b.cap})   •   VIP (${v.sold}/${v.cap})`, 50, 62);

    // 4. FORMATTING BARIS DATA UNTUK TABEL
    const tableRows = allTickets.map((ticket, index) => {
      let formattedDate = '-';
      const rawDate = ticket.purchaseDate || ticket.purchase_date;
      if (rawDate) {
        const dateObj = new Date(rawDate);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        } else {
          formattedDate = rawDate;
        }
      }

      return [
        index + 1,
        formattedDate,
        (ticket.id || '').toUpperCase().substring(0, 8),
        ticket.buyerName || ticket.buyer_name || '-',
        (ticket.seatNumbers || ticket.seat_numbers || []).join(', ') || '-',
        formatRupiahLocal(ticket.totalPrice || ticket.total_price || 0),
        isFreeUpgrade(ticket) ? 'Free Upgrade' : isVipBogo(ticket) ? 'Buy 1 Get 1' : '-',
        ticket.paymentProofUrl || ticket.payment_proof_url ? 'Ada' : 'Tidak Ada',
        ticket.paymentMethod || ticket.payment_method || '-',
        ticket.marketingName || ticket.marketing_name || '-',
        ticket.verified || ticket.is_verified ? 'LUNAS' : 'PENDING'
      ];
    });

    // 5. RENDER TABEL MENGGUNAKAN AUTOTABLE (Posisi Tabel Diturunkan ke Y: 74)
    autoTable(pdf, {
      startY: 74,
      head: [['No', 'Tgl Beli', 'ID Tiket', 'Nama Pembeli', 'Kursi', 'Total Harga', 'Promo', 'Bukti', 'Metode Bayar', 'Marketing', 'Status']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [20, 20, 20],      
        textColor: [245, 158, 11],     
        fontStyle: 'bold',
        fontSize: 8 
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 8 },  
        1: { cellWidth: 20 },   
        2: { cellWidth: 20 },  
        3: { cellWidth: 44 },  
        4: { cellWidth: 28 },  
        5: { cellWidth: 26 },  
        6: { cellWidth: 28 },  
        7: { cellWidth: 16 },  
        8: { cellWidth: 27 },  
        9: { cellWidth: 30 },  
        10: { cellWidth: 20 }   
      },
      didParseCell: (data) => {
        // Mewarnai status Lunas / Pending
        if (data.section === 'body' && data.column.index === 10) {
          if (data.cell.raw === 'LUNAS') {
            data.cell.styles.textColor = [34, 197, 94]; 
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [234, 179, 8]; 
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Mewarnai bukti bayar Ada / Tidak Ada
        if (data.section === 'body' && data.column.index === 7) {
          if (data.cell.raw === 'Ada') {
            data.cell.styles.textColor = [34, 197, 94]; 
          } else {
            data.cell.styles.textColor = [239, 68, 68]; 
          }
        }
      }
    });

    // 6. DOWNLOAD FILE PDF
    pdf.save(`Laporan_Manifes_Booking_Cinematix_${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Show premium SweetAlert2 toast notification
    Swal.fire({
      icon: 'success',
      title: 'Manifes Berhasil Diunduh!',
      text: 'Manifes booking PDF telah diunduh dan disimpan ke folder Download Anda.',
      confirmButtonColor: '#f59e0b',
      background: '#18181b',
      color: '#ffffff'
    });
  } catch (err: any) {
    console.error("Gagal mencetak manifest:", err);
    Swal.fire({
      icon: 'error',
      title: 'Gagal Mencetak Manifes',
      text: 'Terjadi kesalahan sistem: ' + err.message,
      confirmButtonColor: '#ef4444',
      background: '#18181b',
      color: '#ffffff'
    });
  }
};