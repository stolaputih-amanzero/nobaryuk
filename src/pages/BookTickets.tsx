import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext, PRICING, SeatType } from '../store/AppContext';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { formatRupiah, cn } from '@/utils';
import { Check, Upload, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import imageCompression from 'browser-image-compression';

const sortSeats = (seats: string[]) => {
  return [...seats].sort((a, b) => {
    const partsA = a.split('-');
    const partsB = b.split('-');
    const seatA = partsA.length > 1 ? partsA[1] : a;
    const seatB = partsB.length > 1 ? partsB[1] : b;

    const matchA = seatA.match(/([A-Za-z]+)(\d+)/);
    const matchB = seatB.match(/([A-Za-z]+)(\d+)/);

    if (matchA && matchB) {
      const rowA = matchA[1];
      const numA = parseInt(matchA[2], 10);
      const rowB = matchB[1];
      const numB = parseInt(matchB[2], 10);

      if (rowA === rowB) {
        return numA - numB; 
      }
      return rowA.localeCompare(rowB); 
    }
    return a.localeCompare(b);
  });
};

export default function BookTickets() {
  const { addBooking, updateBooking } = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [dbBookings, setDbBookings] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(!!editId); 
  
  const [existingProofUrl, setExistingProofUrl] = useState<string | null>(null);

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

  // 1. Tarik Data Ketersediaan Kursi (Dipisah agar bisa dipanggil ulang saat race condition)
  const fetchReservedSeats = async () => {
    try {
      const { data, error } = await supabase.from('tickets').select('id, seat_numbers');
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

  useEffect(() => {
    fetchReservedSeats();
  }, []);

  // 2. Tarik Data Spesifik untuk EDIT langsung dari Supabase
  useEffect(() => {
    const fetchEditData = async () => {
      if (!editId) return;

      const isAdmin = localStorage.getItem('isAdminAuthenticated') === 'true';
      if (!isAdmin) {
        alert("Akses ditolak! Anda harus memasukkan PIN Admin di halaman detail tiket terlebih dahulu.");
        navigate(`/ticket/${editId}`);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', editId)
          .single();

        if (error) throw error;

        if (data) {
          setForm({
            buyerName: data.buyer_name || '',
            marketingName: data.marketing_name || '',
            seatType: data.seat_type || 'Reguler - Tengah',
            paymentMethod: data.payment_method || 'Transfer Bank',
            paymentTenor: data.payment_tenor || 'Lunas',
            notes: '',
            subtitleLanguage: data.subtitle_language || 'Indonesia',
            verified: data.is_verified || false,
            purchaseDate: data.purchase_date || new Date().toISOString().split('T')[0],
            settlementDate: data.settlement_date || '',
          });
          setSelectedSeats(data.seat_numbers || []);
          setExistingProofUrl(data.payment_proof_url);
        }
      } catch (error) {
        console.error("Gagal menarik data edit:", error);
        alert("Gagal memuat data tiket untuk diedit.");
      } finally {
        setIsLoadingEdit(false);
      }
    };

    fetchEditData();
  }, [editId]);
  
  const unavailableSeats = useMemo(() => {
    const set = new Set<string>();
    dbBookings.forEach(b => {
      if (editId && b.id === editId) return;
      b.seatNumbers.forEach((s: string) => set.add(s));
    });
    return set;
  }, [dbBookings, editId]);

  const currentTypeInfo = PRICING[form.seatType];

  const regularLayout = useMemo(() => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M'];
    return rows.map(rowLetter => {
      let cells: Array<{
        type: 'seat' | 'stairs' | 'entrance' | 'black' | 'label';
        id?: string;
        label?: string;
        category?: 'Depan' | 'Tengah' | 'Belakang';
      }> = [];
      
      cells.push({ type: 'label', label: rowLetter });
      
      if (['K', 'L', 'M'].includes(rowLetter)) {
        // Row K-M: Left seats 1-6, Stairs (2 cols), Middle seats 7-26, Stairs (2 cols), Right seats 27-32
        for (let i = 1; i <= 6; i++) {
          cells.push({ type: 'seat', id: `RD-${rowLetter}${i}`, label: `${i}`, category: 'Depan' });
        }
        cells.push({ type: 'stairs', label: 'STAIRS' });
        cells.push({ type: 'stairs' });
        for (let i = 7; i <= 26; i++) {
          cells.push({ type: 'seat', id: `RD-${rowLetter}${i}`, label: `${i}`, category: 'Depan' });
        }
        cells.push({ type: 'stairs', label: 'STAIRS' });
        cells.push({ type: 'stairs' });
        for (let i = 27; i <= 32; i++) {
          cells.push({ type: 'seat', id: `RD-${rowLetter}${i}`, label: `${i}`, category: 'Depan' });
        }
      } else if (rowLetter === 'A') {
        // Row A: Entrance (2 cols), Black buffer (6 cols), Seats A1-A26 (26 cols), Entrance (2 cols), Label
        cells.push({ type: 'entrance', label: 'ENTRANCE' });
        cells.push({ type: 'entrance' });
        for (let i = 0; i < 6; i++) cells.push({ type: 'black' });
        for (let i = 1; i <= 26; i++) {
          cells.push({ type: 'seat', id: `RB-A${i}`, label: `${i}`, category: 'Belakang' });
        }
        cells.push({ type: 'entrance', label: 'ENTRANCE' });
        cells.push({ type: 'entrance' });
      } else if (rowLetter === 'B') {
        // Row B: Entrance (2 cols), Black buffer (3 cols), Seats B1-B26 (26 cols), Black buffer (3 cols), Entrance (2 cols)
        cells.push({ type: 'entrance', label: 'ENTRANCE' });
        cells.push({ type: 'entrance' });
        for (let i = 0; i < 3; i++) cells.push({ type: 'black' });
        for (let i = 1; i <= 26; i++) {
          cells.push({ type: 'seat', id: `RB-B${i}`, label: `${i}`, category: 'Belakang' });
        }
        for (let i = 0; i < 3; i++) cells.push({ type: 'black' });
        cells.push({ type: 'entrance', label: 'ENTRANCE' });
        cells.push({ type: 'entrance' });
      } else {
        // Rows C-J: Entrance (2 cols), Black buffer (1 col), Seats 1-3 (3 cols), Stairs (2 cols), Middle seats 4-23 (20 cols), Stairs (2 cols), Right seats 24-26 (3 cols), Black buffer (1 col), Entrance (2 cols)
        const cat = 'Tengah';
        cells.push({ type: 'entrance', label: 'ENTRANCE' });
        cells.push({ type: 'entrance' });
        cells.push({ type: 'black' });
        for (let i = 1; i <= 3; i++) {
          cells.push({ type: 'seat', id: `RT-${rowLetter}${i}`, label: `${i}`, category: cat });
        }
        cells.push({ type: 'stairs', label: 'STAIRS' });
        cells.push({ type: 'stairs' });
        for (let i = 4; i <= 23; i++) {
          cells.push({ type: 'seat', id: `RT-${rowLetter}${i}`, label: `${i}`, category: cat });
        }
        cells.push({ type: 'stairs', label: 'STAIRS' });
        cells.push({ type: 'stairs' });
        for (let i = 24; i <= 26; i++) {
          cells.push({ type: 'seat', id: `RT-${rowLetter}${i}`, label: `${i}`, category: cat });
        }
        cells.push({ type: 'black' });
        cells.push({ type: 'entrance', label: 'ENTRANCE' });
        cells.push({ type: 'entrance' });
      }
      
      cells.push({ type: 'label', label: rowLetter });
      return { rowLetter, cells };
    });
  }, []);

  const vipLayout = useMemo(() => {
    const rows = ['A', 'B', 'C'];
    return rows.map(rowLetter => {
      let cells: Array<{
        type: 'seat' | 'stairs' | 'gap' | 'label';
        id?: string;
        label?: string;
      }> = [];
      
      cells.push({ type: 'label', label: rowLetter });
      
      const addPair = (start: number, end: number) => {
        for (let i = start; i <= end; i++) {
          cells.push({ type: 'seat', id: `V-${rowLetter}${i}`, label: `${i}` });
        }
      };
      
      addPair(1, 2);
      cells.push({ type: 'gap' });
      addPair(3, 4);
      cells.push({ type: 'gap' });
      addPair(5, 6);
      cells.push({ type: 'gap' });
      
      // Left Stairs (double-width cell)
      cells.push({ type: 'stairs', label: rowLetter === 'B' ? 'STAIRS' : '' });
      cells.push({ type: 'gap' });
      
      addPair(7, 8);
      cells.push({ type: 'gap' });
      addPair(9, 10);
      cells.push({ type: 'gap' });
      addPair(11, 12);
      cells.push({ type: 'gap' });
      addPair(13, 14);
      cells.push({ type: 'gap' });
      addPair(15, 16);
      cells.push({ type: 'gap' });
      
      // Right Stairs (double-width cell)
      cells.push({ type: 'stairs', label: rowLetter === 'B' ? 'STAIRS' : '' });
      cells.push({ type: 'gap' });
      
      addPair(17, 18);
      cells.push({ type: 'gap' });
      addPair(19, 20);
      
      cells.push({ type: 'label', label: rowLetter });
      return { rowLetter, cells };
    });
  }, []);


  const handleSeatClick = (seatId: string) => {
    if (unavailableSeats.has(seatId)) return;
    setSelectedSeats(prev => 
      prev.includes(seatId) ? prev.filter(s => s !== seatId) : [...prev, seatId]
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setProofFile(null);
      return;
    }

    if (file.type === 'application/pdf') {
      if (file.size > 2 * 1024 * 1024) {
        alert("Uh oh! Ukuran PDF maksimal 2MB. Silahkan perkecil file PDF Anda atau gunakan format gambar (JPG/PNG).");
        e.target.value = '';
      } else {
        setProofFile(file);
      }
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setIsCompressing(true); 
      
      try {
        const options = {
          maxSizeMB: 1.8,          
          maxWidthOrHeight: 1920,  
          useWebWorker: true,      
        };

        const compressedBlob = await imageCompression(file, options);
        
        const compressedFile = new File([compressedBlob], file.name, {
          type: compressedBlob.type,
          lastModified: Date.now(),
        });

        setProofFile(compressedFile);
        
      } catch (error) {
        console.error("Gagal mengompres gambar:", error);
        alert("Terjadi kesalahan saat memproses gambar. Silahkan coba gambar lain.");
        e.target.value = '';
      } finally {
        setIsCompressing(false); 
      }
    } else {
      setProofFile(file);
    }
  };

  const calculateTotals = () => {
    let price = 0;
    let cost = 0;
    selectedSeats.forEach(seatId => {
      const prefix = seatId.split('-')[0];
      const type = (Object.keys(PRICING) as SeatType[]).find(t => PRICING[t].prefix === prefix);
      if (type) {
        price += PRICING[type].price;
        cost += PRICING[type].cost;
      }
    });
    return { price, cost };
  };

  const { price: totalPrice, cost: totalCost } = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeats.length === 0) return alert("Pilih minimal 1 kursi!");
    
    if (editId) {
      const isAdmin = localStorage.getItem('isAdminAuthenticated') === 'true';
      if (!isAdmin) {
        alert("Akses ditolak! Aksi edit hanya untuk Admin.");
        navigate(`/ticket/${editId}`);
        return;
      }
    }

    setIsSubmitting(true); 

    try {
      // =====================================================================
      // 🛡️ RACE CONDITION CHECK: Cek ulang ke DB sebelum eksekusi lanjutan
      // =====================================================================
      const { data: latestTickets, error: checkError } = await supabase
        .from('tickets')
        .select('id, seat_numbers');

      if (checkError) throw checkError;

      const currentlyBookedSeats = new Set<string>();
      latestTickets.forEach(t => {
        if (editId && t.id === editId) return; 
        t.seat_numbers?.forEach((s: string) => currentlyBookedSeats.add(s));
      });

      const conflictSeats = selectedSeats.filter(seat => currentlyBookedSeats.has(seat));

      if (conflictSeats.length > 0) {
        alert(`🚨 KEDULUAN ORANG LAIN!\n\nMaaf, kursi ${conflictSeats.join(', ')} baru saja dipesan oleh orang lain beberapa detik yang lalu.\n\nSistem akan memperbarui peta kursi. Silakan pilih kursi yang lain.`);
        
        setIsSubmitting(false);
        setSelectedSeats([]); 
        await fetchReservedSeats(); 
        return; 
      }
      // =====================================================================

      let finalPaymentProofUrl = existingProofUrl; 

      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `proof-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('payment_proofs')
          .upload(fileName, proofFile);

        if (uploadError) {
          console.error("Gagal upload file:", uploadError);
          alert("Gagal mengunggah foto. Pastikan internet stabil dan file di bawah 2MB.");
          setIsSubmitting(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('payment_proofs')
          .getPublicUrl(fileName);

        finalPaymentProofUrl = publicUrlData.publicUrl;
      }
      
      const sortedSeats = sortSeats(selectedSeats);

      const selectedTypes = Array.from(new Set(selectedSeats.map(seatId => {
        const prefix = seatId.split('-')[0];
        return (Object.keys(PRICING) as SeatType[]).find(t => PRICING[t].prefix === prefix);
      }).filter(Boolean)));
      const ticketSeatType = selectedTypes.length > 0 ? selectedTypes.join(', ') : form.seatType;

      const ticketData = {
        buyer_name: form.buyerName,
        marketing_name: form.marketingName,
        seat_type: ticketSeatType,
        seat_numbers: sortedSeats,
        payment_method: form.paymentMethod,
        payment_tenor: form.paymentTenor,
        subtitle_language: form.subtitleLanguage,
        total_price: totalPrice,
        is_verified: form.verified,
        is_checked_in: false,
        purchase_date: form.purchaseDate,
        settlement_date: form.settlementDate === '' ? null : form.settlementDate,
        payment_proof_url: finalPaymentProofUrl, 
      };

      if (editId) {
        const { error } = await supabase.from('tickets').update(ticketData).eq('id', editId);
        if (error) throw error;

        updateBooking(editId, {
          ...form,
          seatNumbers: sortedSeats,
          totalPrice,
          totalCost,
          paymentProofUrl: finalPaymentProofUrl,
        });
        navigate(`/ticket/${editId}`);
      } else {
        const { data, error } = await supabase.from('tickets').insert([ticketData]).select();
        if (error) throw error;

        if (data && data.length > 0) {
          addBooking({
            ...form,
            id: data[0].id,
            seatNumbers: sortedSeats,
            totalPrice,
            totalCost,
            paymentProofUrl: finalPaymentProofUrl,
          } as any);
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error("Error submitting ticket:", error);
      alert("Terjadi kesalahan sistem saat menyimpan tiket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSeatType = (type: SeatType) => {
    setForm(prev => ({ ...prev, seatType: type }));
    setSelectedSeats([]); 
  };

  if (isLoadingEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-amber-500 gap-4">
         <Loader2 className="w-10 h-10 animate-spin" />
         <p className="text-gray-400 font-medium tracking-wider animate-pulse">Memuat data tiket...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom">
      
      {/* Petunjuk Pemilihan Kursi (Running Text / Info Bar) */}
      <div className="relative w-full bg-amber-500/5 border border-amber-500/20 rounded-xl py-3 px-4 text-amber-500 text-xs font-bold uppercase tracking-wider font-display flex items-center gap-3 overflow-hidden">
        <span className="shrink-0 bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-extrabold animate-pulse z-10">
          PETUNJUK
        </span>
        <div className="relative flex-1 h-4 overflow-hidden">
          <div className="absolute inset-0 flex items-center">
            <div className="animate-marquee-container flex gap-8 whitespace-nowrap">
              <div className="flex gap-8 shrink-0 whitespace-nowrap">
                <span>👉 Silakan langsung pilih Nomor Kursi yang Anda inginkan pada denah studio di panel kanan!</span>
                <span>•</span>
                <span>Lengkapi data diri donatur/pembeli pada formulir sebelum melakukan konfirmasi pesanan!</span>
                <span>•</span>
              </div>
              <div className="flex gap-8 shrink-0 whitespace-nowrap">
                <span>👉 Silakan langsung pilih Nomor Kursi yang Anda inginkan pada denah studio di panel kanan!</span>
                <span>•</span>
                <span>Lengkapi data diri donatur/pembeli pada formulir sebelum melakukan konfirmasi pesanan!</span>
                <span>•</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Form Sidebar */}
        <div className="w-full lg:w-1/3 shrink-0 order-2 lg:order-1 space-y-6 min-w-0">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">{editId ? "Edit Tiket" : "Form Data Tiket"}</h1>
          <p className="text-gray-400">{editId ? "Update detail dan pemilihan kursi untuk tiket ini." : "Masukan data diri donatur atau pembeli tiket dengan lengkap."}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4 sm:p-6 space-y-5">
              
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
                    {isCompressing ? (
                      <>
                        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-2" />
                        <p className="text-sm text-amber-500 font-medium animate-pulse">Mengompres gambar...</p>
                        <p className="text-[10px] text-gray-500">Mohon tunggu sebentar</p>
                      </>
                    ) : proofFile ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/30">
                          <Check className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm text-green-500 font-medium truncate max-w-[200px]">{proofFile.name}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{(proofFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </>
                    ) : existingProofUrl ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
                          <Check className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-blue-400 font-medium">File sudah terunggah</p>
                          <p className="text-[10px] text-gray-500 mt-1">Timpa dengan file baru jika perlu</p>
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

          <Button type="submit" disabled={isSubmitting || isCompressing} className="w-full h-14 text-lg font-bold">
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sedang Mengunggah...</>
            ) : isCompressing ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Memproses Foto...</>
            ) : (
              <>{editId ? "Simpan Perubahan" : "Konfirmasi Pesanan"} - {formatRupiah(totalPrice)}</>
            )}
          </Button>
        </form>
      </div>

      {/* Seat Selection Panel */}
      <div className="w-full lg:w-2/3 order-1 lg:order-2 min-w-0">
        <Card className="border-white/10 sticky text-gray-100 top-24 min-h-[600px] bg-white/5">
          <CardContent className="p-4 sm:p-6">
            
            {/* Seat Grid - Render All Types */}
            <div className="flex flex-col gap-8 w-full items-center">
              {(Object.keys(PRICING) as SeatType[]).map(type => {
                if (type === 'Reguler - Depan' || type === 'Reguler - Belakang') return null;

                if (type === 'VIP') {
                  const colorClass = 'text-amber-500';

                  return (
                    <div key={type} className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 pb-4">
                      <div className={cn("text-[10px] font-bold uppercase tracking-widest mb-3 text-center", colorClass)}>{type}</div>
                      <div className="flex flex-col gap-2 mx-auto w-max min-w-max px-4">
                        {vipLayout.map(({ rowLetter, cells }) => {
                          return (
                            <div key={rowLetter} className="flex justify-center gap-1">
                              {cells.map((cell, colIndex) => {
                                if (cell.type === 'label') {
                                  return (
                                    <div
                                      key={colIndex}
                                      className={cn("w-6 shrink-0 flex items-center justify-center font-bold font-mono text-[10px]", colorClass)}
                                    >
                                      {cell.label}
                                    </div>
                                  );
                                }

                                if (cell.type === 'gap') {
                                  return (
                                    <div key={colIndex} className="w-1.5 md:w-2 shrink-0" />
                                  );
                                }

                                if (cell.type === 'stairs') {
                                  return (
                                    <div
                                      key={colIndex}
                                      className="bg-blue-500/10 border border-blue-500/20 text-blue-400/80 text-[8px] font-extrabold shrink-0 w-[42px] h-5 md:w-[50px] md:h-6 flex items-center justify-center rounded-sm select-none"
                                      title="Stairs"
                                    >
                                      {cell.label}
                                    </div>
                                  );
                                }

                                const seatId = cell.id!;
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
                                      "w-5 h-5 md:w-6 md:h-6 rounded-t shrink-0 flex items-center justify-center text-[8px] sm:text-[9px] font-mono transition-all duration-300 cursor-pointer disabled:cursor-not-allowed relative",
                                      isBooked
                                        ? "bg-white/5 text-gray-600 opacity-50 border border-white/10"
                                        : isSelected
                                          ? "bg-amber-500 border border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)] transform scale-110 z-10"
                                          : "bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30 text-gray-300"
                                    )}
                                  >
                                    {cell.label}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Unified Regular Seat Layout (Rendered when type is 'Reguler - Tengah')
                return (
                  <div key="Regular-Unified" className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 pb-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-4 text-center text-gray-400">Regular Seats</div>
                    <div className="flex flex-col gap-2 mx-auto w-max min-w-max px-4">
                      {regularLayout.map(({ rowLetter, cells }) => {
                        const isRowK = rowLetter === 'K';

                        return (
                          <React.Fragment key={rowLetter}>
                            {isRowK && (
                              <div className="w-full h-8 flex items-center justify-center bg-zinc-900/40 my-3 rounded border border-white/5 relative">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">AISLE / JALAN</span>
                              </div>
                            )}
                            <div className="flex justify-center gap-1">
                              {cells.map((cell, colIndex) => {
                                if (cell.type === 'label') {
                                  let labelColor = 'text-gray-500';
                                  if (['A', 'B'].includes(rowLetter)) labelColor = 'text-blue-500';
                                  else if (['K', 'L', 'M'].includes(rowLetter)) labelColor = 'text-green-500';
                                  else labelColor = 'text-red-500';

                                  return (
                                    <div
                                      key={colIndex}
                                      className={cn("w-6 shrink-0 flex items-center justify-center font-bold font-mono text-[10px]", labelColor)}
                                    >
                                      {cell.label}
                                    </div>
                                  );
                                }

                                if (cell.type === 'black') {
                                  return (
                                    <div key={colIndex} className="w-5 h-5 md:w-6 md:h-6 shrink-0" />
                                  );
                                }

                                if (cell.type === 'entrance') {
                                  let char = '';
                                  if (colIndex === 1 || colIndex === 35) {
                                    const charMap: Record<string, string> = {
                                      B: 'E', C: 'N', D: 'T', E: 'R', F: 'A', G: 'N', H: 'C', J: 'E'
                                    };
                                    char = charMap[rowLetter] || '';
                                  }
                                  return (
                                    <div
                                      key={colIndex}
                                      className="bg-amber-500/10 border border-amber-500/20 text-amber-500/80 text-[8px] font-extrabold shrink-0 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-sm select-none"
                                      title="Entrance"
                                    >
                                      {char}
                                    </div>
                                  );
                                }

                                if (cell.type === 'stairs') {
                                  let char = '';
                                  if (colIndex === 8) {
                                    const leftStairsMap: Record<string, string> = {
                                      C: 'S', D: 'T', E: 'A', F: 'I', G: 'R', H: 'S', J: '•', K: 'S', L: 'T', M: 'A'
                                    };
                                    char = leftStairsMap[rowLetter] || '';
                                  } else if (colIndex === 29) {
                                    const rightStairsMap: Record<string, string> = {
                                      C: 'S', D: 'T', E: 'A', F: 'I', G: 'R', H: 'S', J: '•', K: 'S', L: 'T', M: 'A'
                                    };
                                    char = rightStairsMap[rowLetter] || '';
                                  }
                                  return (
                                    <div
                                      key={colIndex}
                                      className="bg-blue-500/10 border border-blue-500/20 text-blue-400/80 text-[8px] font-extrabold shrink-0 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-sm select-none"
                                      title="Stairs"
                                    >
                                      {char}
                                    </div>
                                  );
                                }

                                const seatId = cell.id!;
                                const isBooked = unavailableSeats.has(seatId);
                                const isSelected = selectedSeats.includes(seatId);
                                const isCenterSeat = colIndex >= 18 && colIndex <= 21;

                                const centerSeatClass = 'bg-white/15 border-white/50 text-white hover:bg-white/30 shadow-[0_0_8px_rgba(255,255,255,0.15)]';

                                return (
                                  <button
                                    key={seatId}
                                    type="button"
                                    onClick={() => handleSeatClick(seatId)}
                                    disabled={isBooked}
                                    title={isCenterSeat ? `${seatId} (Kursi Tengah)` : seatId}
                                    className={cn(
                                      "w-5 h-5 md:w-6 md:h-6 rounded-t shrink-0 flex items-center justify-center text-[8px] sm:text-[9px] font-mono transition-all duration-300 cursor-pointer disabled:cursor-not-allowed relative",
                                      isBooked
                                        ? "bg-white/5 text-gray-600 opacity-50 border border-white/10"
                                        : isSelected
                                          ? "bg-amber-500 border border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)] transform scale-110 z-10"
                                          : isCenterSeat
                                            ? cn("border font-bold", centerSeatClass)
                                            : "bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30 text-gray-300"
                                    )}
                                  >
                                    {cell.label}
                                  </button>
                                );
                              })}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Screen Divider */}
            <div className="w-full border-t-[8px] border-amber-500/20 mt-12 relative flex justify-center">
              <span className="absolute -top-3 bg-[#111111] px-4 text-sm font-bold text-amber-500 tracking-[0.5em] uppercase">S c r e e n</span>
              <div className="absolute bottom-0 w-3/4 h-32 bg-gradient-to-t from-amber-500/10 to-transparent blur-2xl pointer-events-none" />
            </div>

            {/* Legend & Summary */}
            <div className="mt-12 pt-6 border-t border-white/10 flex flex-wrap gap-6 justify-between items-end">
              <div className="flex gap-4 text-xs font-medium text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/10 border border-white/20 rounded-t-sm" /> Tersedia
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/15 border border-white/50 rounded-t-sm shadow-[0_0_8px_rgba(255,255,255,0.15)]" /> Tengah Layar
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
  </div>
  );
}