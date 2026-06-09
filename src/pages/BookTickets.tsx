import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext, PRICING, SeatType } from '../store/AppContext';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { formatRupiah, cn } from '@/utils';
import { Check, Upload } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Import Supabase Client

// FUNGSI PINTAR UNTUK MENGURUTKAN KURSI (Row A-Z, lalu Angka 1-99)
const sortSeats = (seats: string[]) => {
  return [...seats].sort((a, b) => {
    // Memisahkan prefix (contoh: 'RT-') dengan nomor kursi ('E5')
    const partsA = a.split('-');
    const partsB = b.split('-');
    const seatA = partsA.length > 1 ? partsA[1] : a;
    const seatB = partsB.length > 1 ? partsB[1] : b;

    // Menangkap Huruf dan Angka, misal 'E' dan '5'
    const matchA = seatA.match(/([A-Za-z]+)(\d+)/);
    const matchB = seatB.match(/([A-Za-z]+)(\d+)/);

    if (matchA && matchB) {
      const rowA = matchA[1];
      const numA = parseInt(matchA[2], 10);
      const rowB = matchB[1];
      const numB = parseInt(matchB[2], 10);

      // Jika barisnya sama (misal sama-sama 'E'), urutkan berdasarkan angkanya
      if (rowA === rowB) {
        return numA - numB; 
      }
      // Jika barisnya beda (misal 'E' dan 'F'), urutkan sesuai abjad
      return rowA.localeCompare(rowB); 
    }
    return a.localeCompare(b);
  });
};

export default function BookTickets() {
  const { bookings, addBooking, updateBooking } = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  // State baru untuk menyimpan data kursi yang benar-benar terpesan di Supabase
  const [dbBookings, setDbBookings] = useState<any[]>([]);

  // Ambil data pesanan langsung dari Supabase untuk memetakan kursi yang tidak tersedia
  useEffect(() => {
    const fetchReservedSeats = async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('id, seat_numbers');
        
        if (error) throw error;

        if (data) {
          const formatted = data.map((row: any) => ({
            id: row.id,
            seatNumbers: row.seat_numbers || []
          }));
          setDbBookings(formatted);
        }
      } catch (error) {
        console.error("Gagal mengambil data kursi terblokir:", error);
      }
    };

    fetchReservedSeats();
  }, []);

  const editBooking = useMemo(() => {
    return editId ? bookings.find(b => b.id === editId) : null;
  }, [editId, bookings]);

  const [form, setForm] = useState({
    buyerName: '',
    marketingName: '',
    seatType: 'Reguler - Tengah' as SeatType,
    paymentMethod: 'Transfer Bank' as 'Cash' | 'Transfer Bank',
    paymentTenor: 'Lunas' as 'Lunas' | 'DP (Maks 2x)',
    notes: '',
    subtitleLanguage: 'Indonesia',
    verified: false,
    purchaseDate: new Date().toISOString().split('T')[0],
    settlementDate: '',
  });

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);

  React.useEffect(() => {
    if (editBooking) {
      setForm({
        buyerName: editBooking.buyerName,
        marketingName: editBooking.marketingName,
        seatType: editBooking.seatType,
        paymentMethod: editBooking.paymentMethod,
        paymentTenor: editBooking.paymentTenor,
        notes: editBooking.notes,
        subtitleLanguage: editBooking.subtitleLanguage,
        verified: editBooking.verified,
        purchaseDate: editBooking.purchaseDate || new Date().toISOString().split('T')[0],
        settlementDate: editBooking.settlementDate || '',
      });
      setSelectedSeats(editBooking.seatNumbers);
    }
  }, [editBooking]);
  
  // PERBAIKAN: Hitung ketersediaan kursi berdasarkan database Supabase (dbBookings)
  const unavailableSeats = useMemo(() => {
    const set = new Set<string>();
    dbBookings.forEach(b => {
      // Jika sedang mengedit, jangan blokir kursi milik tiket itu sendiri
      if (editId && b.id === editId) return;
      b.seatNumbers.forEach(s => set.add(s));
    });
    return set;
  }, [dbBookings, editId]);

  const currentTypeInfo = PRICING[form.seatType];

  const handleSeatClick = (seatId: string) => {
    if (unavailableSeats.has(seatId)) return;
    setSelectedSeats(prev => 
      prev.includes(seatId) ? prev.filter(s => s !== seatId) : [...prev, seatId]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setProofFile(null);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Uh oh! Ukuran file maksimal 2MB. Silahkan compress foto Anda atau pilih foto lain.");
      e.target.value = '';
      return;
    }
    setProofFile(file);
  };

  const totalPrice = selectedSeats.length * currentTypeInfo.price;
  const totalCost = selectedSeats.length * currentTypeInfo.cost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeats.length === 0) return alert("Pilih minimal 1 kursi!");
    
    let paymentProofUrl = editBooking?.paymentProofUrl;
    if (proofFile) {
       paymentProofUrl = URL.createObjectURL(proofFile); 
    }
    
    // PERBAIKAN: Urutkan kursi sebelum dikirim ke database
    const sortedSeats = sortSeats(selectedSeats);

    const ticketData = {
      buyer_name: form.buyerName,
      marketing_name: form.marketingName,
      seat_type: form.seatType,
      seat_numbers: sortedSeats, // Gunakan array yang sudah terurut
      payment_method: form.paymentMethod,
      payment_tenor: form.paymentTenor,
      subtitle_language: form.subtitleLanguage,
      total_price: totalPrice,
      is_verified: form.verified,
      is_checked_in: false,
      purchase_date: form.purchaseDate,
      settlement_date: form.settlementDate === '' ? null : form.settlementDate,
    };

    if (editBooking) {
      const { error } = await supabase.from('tickets').update(ticketData).eq('id', editBooking.id);
      if (error) {
        console.error(error);
        return alert("Gagal mengupdate tiket di database!");
      }

      updateBooking(editBooking.id, {
        ...form,
        seatNumbers: sortedSeats,
        totalPrice,
        totalCost,
        paymentProofUrl,
      });
      navigate(`/ticket/${editBooking.id}`);
    } else {
      const { data, error } = await supabase.from('tickets').insert([ticketData]).select();
      if (error) {
        console.error(error);
        return alert("Gagal menyimpan tiket ke database Supabase!");
      }

      if (data && data.length > 0) {
        addBooking({
          ...form,
          id: data[0].id,
          seatNumbers: sortedSeats,
          totalPrice,
          totalCost,
          paymentProofUrl,
        });
        navigate('/dashboard');
      }
    }
  };

  const resetSeatType = (type: SeatType) => {
    setForm(prev => ({ ...prev, seatType: type }));
    setSelectedSeats([]); 
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom flex flex-col lg:flex-row gap-8">
      
      {/* Form Sidebar */}
      <div className="w-full lg:w-1/3 shrink-0 order-2 lg:order-1 space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">{editBooking ? "Edit Tiket" : "Form Data Tiket"}</h1>
          <p className="text-gray-400">{editBooking ? "Update detail dan pemilihan kursi untuk tiket ini." : "Masukan data diri donatur atau pembeli tiket dengan lengkap."}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 space-y-5">
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nama Pembeli/Donatur</label>
                <input 
                  required 
                  value={form.buyerName} 
                  onChange={e => setForm({...form, buyerName: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500" 
                  placeholder="Mis. Bapak Budi / PT Angkasa" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nama Marketing (Tim)</label>
                <input 
                  required
                  value={form.marketingName} 
                  onChange={e => setForm({...form, marketingName: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500" 
                  placeholder="Mis. Andi - Tim A" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tanggal Pembelian</label>
                  <input 
                    type="date"
                    required 
                    value={form.purchaseDate} 
                    onChange={e => setForm({...form, purchaseDate: e.target.value})}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500" 
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tanggal Pelunasan</label>
                  <input 
                    type="date"
                    value={form.settlementDate} 
                    onChange={e => setForm({...form, settlementDate: e.target.value})}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500" 
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Metode Bayar</label>
                  <select 
                    value={form.paymentMethod}
                    onChange={e => setForm({...form, paymentMethod: e.target.value as any})}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tenor / Cicilan</label>
                  <select 
                    value={form.paymentTenor}
                    onChange={e => setForm({...form, paymentTenor: e.target.value as any})}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
                    <option value="Lunas">Lunas (Cash)</option>
                    <option value="DP (Maks 2x)">DP / Cicil (Maks 2x)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Pilihan Subtitle</label>
                <select 
                  value={form.subtitleLanguage}
                  onChange={e => setForm({...form, subtitleLanguage: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="Indonesia">Indonesia</option>
                  <option value="English">English</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center justify-between">
                  <span>Bukti Pembayaran (Transfer/Cash)</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Maks. 2MB</span>
                </label>
                <div className="relative border-2 border-dashed border-white/10 rounded-lg p-6 hover:border-amber-500/50 transition-colors bg-black/50 group">
                  <input 
                    type="file" 
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    {proofFile ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/30">
                          <Check className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm text-green-500 font-medium truncate max-w-[200px]">{proofFile.name}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{(proofFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors">
                          <span className="text-gray-400 group-hover:text-amber-500 text-xl">+</span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-300">Klik atau Drag & Drop foto bukti</p>
                          <p className="text-[10px] text-gray-500 mt-1">JPG, PNG, PDF</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                 <button 
                  type="button"
                  onClick={() => setForm({...form, verified: !form.verified})}
                  className="flex items-center gap-3 cursor-pointer text-left w-full focus:outline-none group"
                 >
                    <div className={cn("w-6 h-6 rounded flex items-center justify-center border transition-colors group-hover:border-amber-500/50", form.verified ? "bg-green-500 border-green-500 group-hover:border-green-400" : "bg-white/5 border-white/20")}>
                      {form.verified && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    </div>
                    <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Tandai Langsung Verified (Pembayaran Lunas & Sah)</span>
                 </button>
              </div>

            </CardContent>
          </Card>

          <Button type="submit" className="w-full h-14 text-lg font-bold">
            {editBooking ? "Simpan Perubahan" : "Konfirmasi Pesanan"} - {formatRupiah(totalPrice)}
          </Button>
        </form>
      </div>

      {/* Seat Selection Panel */}
      <div className="w-full lg:w-2/3 order-1 lg:order-2">
        <Card className="border-white/10 sticky text-gray-100 top-24 min-h-[600px] bg-white/5">
          <CardContent className="p-6">
            
            {/* Seat Types Tabs */}
            <div className="flex flex-wrap gap-2 mb-8">
              {(Object.keys(PRICING) as SeatType[]).map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => resetSeatType(type)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                    form.seatType === type 
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/50" 
                      : "bg-black border-white/10 text-gray-400 hover:text-gray-200"
                  )}
                >
                  {type} - {formatRupiah(PRICING[type].price)}
                </button>
              ))}
            </div>

            {/* Screen Divider */}
            <div className="w-full border-t-[8px] border-amber-500/20 mb-12 relative flex justify-center">
              <span className="absolute -top-6 text-sm font-bold text-amber-500 tracking-[0.5em] uppercase">S c r e e n</span>
              <div className="absolute top-0 w-3/4 h-32 bg-gradient-to-b from-amber-500/10 to-transparent blur-2xl pointer-events-none" />
            </div>

            {/* Seat Grid */}
            <div className="flex flex-col items-center justify-center gap-3 w-full">
              {Array.from({ length: currentTypeInfo.rows }).map((_, rIndex) => {
                const rowLetter = currentTypeInfo.rowLetters ? currentTypeInfo.rowLetters[rIndex] : String.fromCharCode(65 + rIndex);
                return (
                <div key={rIndex} className="flex flex-wrap justify-center gap-2">
                  <div className="w-8 shrink-0 flex items-center justify-center text-gray-500 font-mono text-sm mr-2">{rowLetter}</div>
                  {Array.from({ length: currentTypeInfo.cols }).map((_, cIndex) => {
                    const seatId = `${currentTypeInfo.prefix}-${rowLetter}${cIndex + 1}`;
                    const isBooked = unavailableSeats.has(seatId);
                    const isSelected = selectedSeats.includes(seatId);
                    
                    return (
                      <button
                        key={seatId}
                        type="button"
                        onClick={() => handleSeatClick(seatId)}
                        disabled={isBooked}
                        title={seatId}
                        className={cn(
                          "w-6 h-6 md:w-8 md:h-8 rounded-t-lg rounded-b flex items-center justify-center text-[10px] sm:text-xs font-mono transition-all duration-200 cursor-pointer disabled:cursor-not-allowed",
                          isBooked 
                           ? "bg-white/5 text-gray-600 opacity-50 border border-white/10" 
                           : isSelected 
                            ? "bg-amber-500 border border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)] transform scale-110" 
                            : "bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30 text-gray-300"
                        )}
                      >
                         {cIndex + 1}
                      </button>
                    )
                  })}
                </div>
                );
              })}
            </div>

            {/* Legend & Summary */}
            <div className="mt-12 pt-6 border-t border-white/10 flex flex-wrap gap-6 justify-between items-end">
              <div className="flex gap-4 text-xs font-medium text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/10 border border-white/20 rounded-t-sm" /> Tersedia
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded-t-sm" /> Dipilih
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/5 border border-white/10 opacity-50 rounded-t-sm" /> Tidak Tersedia
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">Tiket Terpilih</div>
                <div className="text-xl font-bold font-display text-white">
                  {selectedSeats.length} <span className="text-amber-500 text-base font-normal">Seat</span>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>

    </div>
  );
}