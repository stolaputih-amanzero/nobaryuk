import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PRICING, SeatType } from '../store/AppContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils';
import { Search, CheckCircle2, UserCheck, AlertCircle, QrCode, X, Loader2, UploadCloud, FileText } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { supabase } from '../supabaseClient';
import jsQR from 'jsqr';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

export default function CheckIn() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ambil data tiket dari Supabase saat halaman dimuat
  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase.from('tickets').select('*');
      if (error) throw error;

      if (data) {
        const formatted = data.map((row: any) => ({
          id: row.id,
          buyerName: row.buyer_name,
          seatNumbers: row.seat_numbers || [],
          verified: row.is_verified,
          checkedIn: row.is_checked_in,
          checkedInSeats: row.is_checked_in ? row.seat_numbers : [],
          createdAt: row.created_at
        }));
        formatted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setBookings(formatted);
      }
    } catch (error) {
      console.error("Gagal menarik data tiket:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Fungsi untuk mengubah status check-in ke Supabase & State Lokal
  const updateCheckInStatus = async (id: string, isCheckedIn: boolean, checkedSeats: string[]) => {
    setBookings(prev => prev.map(b => b.id === id ? {
      ...b,
      checkedIn: isCheckedIn,
      checkedInSeats: checkedSeats
    } : b));

    try {
      await supabase.from('tickets').update({
        is_checked_in: isCheckedIn,
      }).eq('id', id);
    } catch (error) {
      console.error("Gagal update Check-In di Supabase", error);
      alert("Gagal menyimpan kehadiran ke database. Periksa koneksi internet.");
    }
  };

const downloadAttendancePDF = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const today = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 1. TAMPILAN HEADER LAPORAN
    pdf.setFillColor(10, 10, 10); // Warna Hitam Elegan Cinematix
    pdf.rect(0, 0, 210, 40, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('CINEMATIX', 15, 18);

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(245, 158, 11); // Warna Amber Khas Aplikasi
    pdf.text('Nonton Bareng Event 2026 — Laporan Kehadiran', 15, 25);

    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Dicetak pada: ${today}`, 145, 25);

    // 2. KOTAK STATISTIK RINGKASAN
    const totalTiket = bookings.length;
    const totalHadir = bookings.filter(b => b.checkedIn).length;
    const belumHadir = totalTiket - totalHadir;

    // Background Kotak Abu-abu
    pdf.setFillColor(245, 245, 245);
    pdf.rect(15, 48, 180, 20, 'F');

    pdf.setTextColor(50, 50, 50);
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(`Total Tiket: ${totalTiket}`, 25, 60);
    pdf.text(`Sudah Hadir: ${totalHadir}`, 85, 60);
    pdf.text(`Belum Datang: ${belumHadir}`, 145, 60);

    // 3. STRUKTUR DATA UNTUK TABEL
    const tableRows = bookings.map((ticket, index) => {
      const currentCheckedInSeats = ticket.checkedInSeats || (ticket.checkedIn ? ticket.seatNumbers : []);
      const allCheckedIn = currentCheckedInSeats.length === ticket.seatNumbers.length;
      
      return [
        index + 1,
        ticket.id.toUpperCase().substring(0, 8) + '...', // Persingkat UUID agar tabel muat
        ticket.buyerName,
        ticket.seatNumbers.join(', '),
        allCheckedIn ? 'HADIR' : 'BELUM DATANG'
      ];
    });

    // 4. GENERATE TABEL OTOMATIS
    autoTable(pdf, {
      startY: 75,
      head: [['No', 'ID Tiket', 'Nama Pembeli', 'Nomor Kursi', 'Status Kehadiran']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [245, 158, 11], // Header tabel warna Amber
        textColor: [0, 0, 0],       // Teks hitam kontras
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 10 },  // No
        1: { cellWidth: 30 },  // ID Tiket
        2: { cellWidth: 55 },  // Nama
        3: { cellWidth: 45 },  // Kursi
        4: { cellWidth: 40 }   // Status
      },
      didParseCell: (data) => {
        // Trik mewarnai baris Status khusus penonton yang sudah "HADIR" menjadi Hijau
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw === 'HADIR') {
            data.cell.styles.textColor = [34, 197, 94]; // Warna hijau Tailwind
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [239, 68, 68];  // Warna merah Tailwind
          }
        }
      }
    });

    // 5. SIMPAN FILE PDF
    pdf.save(`Laporan_Kehadiran_Cinematix_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // LOGIKA BARU: Membaca ID dari QR Code (Mendukung format URL maupun UUID mentah)
  const handleScanQR = async (text: string) => {
    if (!text) return;

    // PERBAIKAN 1: Ekstrak ID saja dari bagian akhir jika input berupa URL link
    const scannedId = text.includes('/') ? text.split('/').pop()?.trim() || '' : text.trim();
    console.log("Membaca ID Tiket Ter-ekstrak:", scannedId);

    if (!scannedId) {
      alert("❌ Format QR Code tidak valid atau kosong.");
      return;
    }

    // 1. Cari tiket di data lokal bookings
    const foundTicket = bookings.find(b => b.id.toLowerCase() === scannedId.toLowerCase());

    if (foundTicket) {
      setSearchQuery(scannedId); 
      setShowScanner(false);

      const currentCheckedInSeats = foundTicket.checkedInSeats || [];
      const allCheckedIn = currentCheckedInSeats.length === foundTicket.seatNumbers.length;

      if (!allCheckedIn) {
        // Otomatis tandai semua kursi milik pembeli tersebut sebagai HADIR
        await updateCheckInStatus(foundTicket.id, true, [...foundTicket.seatNumbers]);
        alert(`🎉 CHECK-IN BERHASIL!\n\nPembeli: ${foundTicket.buyerName}\nKursi: ${foundTicket.seatNumbers.join(', ')}`);
      } else {
        alert(`ℹ️ Tiket ini sudah melakukan Check-In sebelumnya.\n\nPembeli: ${foundTicket.buyerName}`);
      }
    } else {
      // 2. Jika tidak ketemu di lokal, coba paksa cari langsung ke server Supabase
      try {
        const { data, error } = await supabase.from('tickets').select('*').eq('id', scannedId).single();
        if (error || !data) {
          alert("❌ Tiket Tidak Valid! ID tidak terdaftar dalam database acara.");
          return;
        }
        
        setShowScanner(false);
        setSearchQuery(scannedId);
        await fetchTickets(); // Refresh list lokal
        alert(`Tiket ditemukan di database: ${data.buyer_name}. Silahkan tekan tombol "Tandai Hadir" pada layar.`);
      } catch (e) {
        alert("❌ QR Code tidak dikenali atau format salah.");
      }
    }
  };

  // Upload Foto Screenshot dan Ekstrak QR Code (Metode Alternatif)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 600;
        const scale = Math.min(MAX_WIDTH / img.width, 1);
        const newWidth = Math.floor(img.width * scale);
        const newHeight = Math.floor(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        const imageData = ctx.getImageData(0, 0, newWidth, newHeight);
        
        if (!imageData || imageData.data.length === 0) {
            alert("Gambar tidak terbaca, coba screenshot ulang bagian QR Code saja.");
            return;
        }

        try {
            const code = jsQR(imageData.data, newWidth, newHeight, {
                inversionAttempts: "dontInvert",
            });
            
            if (code) {
                handleScanQR(code.data); 
            } else {
                alert("QR Code tidak terdeteksi dari foto. Tips: Crop pas di bagian kotak QR Code saja sebelum di-upload.");
            }
        } catch (err) {
            console.error("Error saat memproses QR:", err);
            alert("Gagal memproses gambar QR.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBulkCheckIn = (id: string, allCheckedIn: boolean, seats: string[]) => {
    updateCheckInStatus(id, !allCheckedIn, !allCheckedIn ? [...seats] : []);
  };

  const handleSingleCheckIn = (id: string, seat: string, ticket: any) => {
    let currentCheckedInSeats = ticket.checkedInSeats || (ticket.checkedIn ? [...ticket.seatNumbers] : []);
    
    let newList = [...currentCheckedInSeats];
    if (newList.includes(seat)) {
      newList = newList.filter((s: string) => s !== seat);
    } else {
      newList.push(seat);
    }
    
    const isAllChecked = newList.length === ticket.seatNumbers.length;
    updateCheckInStatus(id, isAllChecked, newList);
  };

  const { bookedSeats, checkedInSeats } = useMemo(() => {
    const booked = new Set<string>();
    const checkedIn = new Set<string>();
    
    bookings.forEach(b => {
      b.seatNumbers.forEach((s: string) => {
        booked.add(s);
        if (b.checkedInSeats && b.checkedInSeats.includes(s)) {
          checkedIn.add(s);
        } else if (b.checkedIn && (!b.checkedInSeats || b.checkedInSeats.length === 0)) {
          checkedIn.add(s);
        }
      });
    });
    
    return { bookedSeats: booked, checkedInSeats: checkedIn };
  }, [bookings]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return showAll ? bookings : bookings.slice(0, 10);
    }
    const query = searchQuery.toLowerCase();
    return bookings.filter(b => 
      b.id.toLowerCase().includes(query) || 
      b.buyerName.toLowerCase().includes(query) ||
      b.seatNumbers.some((s: string) => s.toLowerCase().includes(query))
    );
  }, [searchQuery, bookings, showAll]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-amber-500 gap-4">
         <Loader2 className="w-10 h-10 animate-spin" />
         <p className="text-gray-400 font-medium tracking-wider animate-pulse">Memuat data kursi real-time...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative pb-12">
      
      {/* SCANNER OVERLAY SCREEN */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl overflow-hidden p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-bold flex items-center gap-2"><QrCode className="text-amber-500 w-5 h-5"/> Scan QR Tiket</h3>
              <button onClick={() => setShowScanner(false)} className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="rounded-2xl overflow-hidden bg-black aspect-square border-2 border-dashed border-amber-500/50 relative">
              {/* PERBAIKAN 2: Mengubah ke prop onScan dan menangani format array data */}
              <Scanner
                onScan={(result) => {
                  if (!result) return;
                  // Antisipasi: jika library mengembalikan bentuk array (v2) atau string langsung (v1)
                  const scannedText = Array.isArray(result) ? result[0]?.rawValue : result;
                  if (scannedText) {
                    handleScanQR(scannedText);
                  }
                }} 
                onError={(error) => console.log("Scanner Error:", error?.message)}
                constraints={{ 
                  facingMode: 'environment', 
                  width: { ideal: 1280 },    
                  height: { ideal: 720 } 
                }}
              />
              <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none" />
            </div>
            <p className="text-center text-gray-400 mt-6 text-sm">Arahkan kamera ke QR Code di tengah e-ticket PDF pengunjung.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Registrasi Kehadiran (Check-In)</h1>
          <p className="text-gray-400">Verifikasi tiket pembeli yang hadir dan pantau okupansi kursi secara real-time.</p>
        </div>
        
        {/* TOMBOL BARU UNTUK DOWNLOAD LAPORAN PDF */}
        <Button 
          onClick={downloadAttendancePDF}
          className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold whitespace-nowrap border border-white/10 self-start sm:self-center"
        >
          <FileText className="w-4 h-4 mr-2 text-amber-500" /> Cetak PDF Kehadiran
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Search & List */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="p-5 space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Cari ID Tiket, Nama, Kursi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <button 
                  onClick={() => setShowScanner(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-black px-4 rounded-lg flex items-center justify-center font-bold transition-colors shrink-0"
                  title="Gunakan Kamera Scanner"
                >
                  <QrCode className="w-5 h-5" />
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 rounded-lg flex items-center justify-center font-bold transition-colors shrink-0 border border-white/10"
                  title="Upload Gambar/Screenshot Tiket"
                >
                  <UploadCloud className="w-5 h-5" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                </button>
              </div>

              <div className="space-y-3">
                {searchQuery && searchResults.length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    Tidak ditemukan tiket dengan kata kunci tersebut.
                  </div>
                )}
                {!searchQuery && bookings.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <UserCheck className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Belum ada tiket terdaftar. Check-in penonton akan muncul di sini.</p>
                  </div>
                )}
                
                {searchResults.map(ticket => {
                  const currentCheckedInSeats = ticket.checkedInSeats || (ticket.checkedIn ? ticket.seatNumbers : []);
                  const allCheckedIn = currentCheckedInSeats.length === ticket.seatNumbers.length;
                  
                  return (
                  <div key={ticket.id} className="bg-black border border-white/10 rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-amber-500/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white text-sm">{ticket.buyerName}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">ID: {ticket.id.toUpperCase()}</div>
                      </div>
                      {!ticket.verified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3" /> Blm Lunas
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {ticket.seatNumbers.map((s: string) => {
                        const isChecked = currentCheckedInSeats.includes(s);
                        return (
                        <button 
                          key={s} 
                          onClick={() => handleSingleCheckIn(ticket.id, s, ticket)}
                          className={cn(
                            "text-[10px] font-mono px-2 py-1 rounded border transition-colors flex items-center justify-center gap-1",
                            isChecked 
                              ? "bg-amber-500/10 border-amber-500/50 text-amber-500" 
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          {s} {isChecked && <CheckCircle2 className="w-3 h-3" />}
                        </button>
                        );
                      })}
                    </div>

                    <Button 
                      variant={allCheckedIn ? 'outline' : 'primary'}
                      onClick={() => handleBulkCheckIn(ticket.id, allCheckedIn, ticket.seatNumbers)}
                      className={cn("w-full h-8 text-xs mt-1", allCheckedIn && "border-green-500/50 text-green-500 hover:bg-green-500/10 bg-transparent")}
                    >
                      {allCheckedIn ? (
                         <><CheckCircle2 className="w-3 h-3 mr-1.5" /> Batalkan Kehadiran</>
                      ) : (
                         <><UserCheck className="w-3 h-3 mr-1.5" /> Tandai Hadir (Semua)</>
                      )}
                    </Button>
                  </div>
                )})}

                {!searchQuery && bookings.length > 10 && !showAll && (
                  <Button variant="outline" className="w-full text-xs text-amber-500 border-white/10 hover:bg-white/5 hover:text-amber-500" onClick={() => setShowAll(true)}>
                    Tampilkan Lebih Banyak
                  </Button>
                )}
                {!searchQuery && showAll && bookings.length > 10 && (
                  <Button variant="outline" className="w-full text-xs text-amber-500 border-white/10 hover:bg-white/5 hover:text-amber-500" onClick={() => setShowAll(false)}>
                    Sembunyikan
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-white/10 bg-white/5">
            <CardContent className="p-5 flex items-center justify-between">
               <div>
                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tiket Di-scan</div>
                 <div className="text-2xl font-bold text-white">
                   {bookings.filter(b => b.checkedIn).length} <span className="text-sm text-gray-500 font-normal">/ {bookings.length}</span>
                 </div>
               </div>
               <div className="text-right">
                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kursi Terisi</div>
                 <div className="text-2xl font-bold text-amber-500">
                   {checkedInSeats.size} <span className="text-sm text-gray-500 font-normal">/ {bookedSeats.size}</span>
                 </div>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Seat Map */}
        <div className="lg:col-span-2">
          <Card className="border-white/10 bg-white/5 min-h-[600px] sticky top-24">
            <CardContent className="p-6">
              
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <h3 className="font-bold text-white">Live Seat Map (Status Pintu)</h3>
                
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-white/5 border border-white/10 rounded-sm" /> Kosong
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-white/20 border border-gray-500 rounded-sm" /> Belum Datang
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-amber-500 border border-amber-400 rounded-sm" /> Di Dalam
                  </div>
                </div>
              </div>

              {/* Seat Grid - Posisinya Dinaikkan Ke Atas */}
              <div className="flex flex-col gap-8">
                {(Object.keys(PRICING) as SeatType[]).map(type => {
                  const currentTypeInfo = PRICING[type];
                  return (
                    <div key={type} className="flex flex-col items-center">
                      <div className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-3 text-center">{type}</div>
                      <div className="flex flex-col gap-2 w-full items-center">
                        {Array.from({ length: currentTypeInfo.rows }).map((_, rIndex) => {
                          const rowLetter = currentTypeInfo.rowLetters ? currentTypeInfo.rowLetters[rIndex] : String.fromCharCode(65 + rIndex);
                          return (
                          <div key={rIndex} className="flex flex-wrap justify-center gap-1.5">
                            <div className="w-6 shrink-0 flex items-center justify-center text-gray-600 font-mono text-[10px] mr-1">{rowLetter}</div>
                            {Array.from({ length: currentTypeInfo.cols }).map((_, cIndex) => {
                              const seatId = `${currentTypeInfo.prefix}-${rowLetter}${cIndex + 1}`;
                              const isBooked = bookedSeats.has(seatId);
                              const isCheckedIn = checkedInSeats.has(seatId);
                              
                              return (
                                <div
                                  key={seatId}
                                  title={seatId}
                                  className={cn(
                                    "w-5 h-5 md:w-6 md:h-6 rounded-t shrink-0 flex items-center justify-center text-[8px] sm:text-[9px] font-mono transition-all duration-300",
                                    isCheckedIn 
                                      ? "bg-amber-500 border border-amber-400 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                                      : isBooked
                                        ? "bg-white/20 border border-gray-500 text-gray-300"
                                        : "bg-white/5 border border-white/10 text-gray-700"
                                  )}
                                >
                                   {cIndex + 1}
                                </div>
                              )
                            })}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Screen Divider - Posisinya Diturunkan Ke Bawah */}
              <div className="w-full border-t-[4px] border-white/10 mt-10 relative flex justify-center">
                <span className="absolute -top-3 text-[10px] bg-[#111111] px-4 font-bold text-gray-500 tracking-[0.3em] uppercase">S c r e e n</span>
                <div className="absolute bottom-0 w-1/2 h-24 bg-gradient-to-t from-white/5 to-transparent blur-xl pointer-events-none" />
              </div>

            </CardContent>
          </Card>
        </div>
        
      </div>
    </div>
  );
}