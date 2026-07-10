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
import Swal from 'sweetalert2'; 
const getCategoryColorObj = (seatIdOrType: string) => {
  if (seatIdOrType.includes('VIP') || seatIdOrType.startsWith('V-')) return {
    text: 'text-amber-500',
    bg: 'bg-amber-500',
    bgDim: 'bg-amber-500/20',
    bgLight: 'bg-amber-500/10',
    border: 'border-amber-400',
    borderDim: 'border-amber-500/50',
    shadow: 'shadow-[0_0_10px_rgba(245,158,11,0.3)]',
    textChecked: 'text-black'
  };
  if (seatIdOrType.includes('Depan') || seatIdOrType.startsWith('RD-')) return {
    text: 'text-green-500',
    bg: 'bg-green-500',
    bgDim: 'bg-green-500/20',
    bgLight: 'bg-green-500/10',
    border: 'border-green-400',
    borderDim: 'border-green-500/50',
    shadow: 'shadow-[0_0_10px_rgba(34,197,94,0.3)]',
    textChecked: 'text-black'
  };
  if (seatIdOrType.includes('Tengah') || seatIdOrType.startsWith('RT-')) return {
    text: 'text-red-500',
    bg: 'bg-red-500',
    bgDim: 'bg-red-500/20',
    bgLight: 'bg-red-500/10',
    border: 'border-red-400',
    borderDim: 'border-red-500/50',
    shadow: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]',
    textChecked: 'text-white'
  };
  if (seatIdOrType.includes('Belakang') || seatIdOrType.startsWith('RB-')) return {
    text: 'text-blue-500',
    bg: 'bg-blue-500',
    bgDim: 'bg-blue-500/20',
    bgLight: 'bg-blue-500/10',
    border: 'border-blue-400',
    borderDim: 'border-blue-500/50',
    shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.3)]',
    textChecked: 'text-white'
  };
  return {
    text: 'text-gray-500',
    bg: 'bg-gray-500',
    bgDim: 'bg-gray-500/20',
    bgLight: 'bg-gray-500/10',
    border: 'border-gray-400',
    borderDim: 'border-gray-500/50',
    shadow: 'shadow-[0_0_10px_rgba(107,114,128,0.3)]',
    textChecked: 'text-white'
  };
};

const isVipBogo = (ticket: any) => {
  if (!ticket.seatNumbers || !ticket.totalPrice) return false;
  const vipSeats = ticket.seatNumbers.filter((s: string) => s.startsWith('V-'));
  if (vipSeats.length < 2) return false;
  const normalVipPrice = vipSeats.length * 2500000;
  return ticket.totalPrice < normalVipPrice;
};

const isFreeUpgrade = (ticket: any) => {
  return ticket.seatType && (ticket.seatType.includes('Upgrade dari Depan') || ticket.seatType.includes('Upgrade dari Belakang'));
};

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
          createdAt: row.created_at,
          seatType: row.seat_type,
          totalPrice: row.total_price,
          paymentProofUrl: row.payment_proof_url
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
      Swal.fire({
        title: 'Koneksi Bermasalah',
        text: 'Gagal menyimpan kehadiran ke database. Periksa koneksi internet.',
        icon: 'error',
        background: '#111111',
        color: '#ffffff',
        confirmButtonColor: '#ef4444'
      });
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
        ticket.id.toUpperCase().substring(0, 8),
        ticket.buyerName,
        ticket.seatNumbers.join(', '),
        isFreeUpgrade(ticket) ? 'Free Upgrade' : isVipBogo(ticket) ? 'Buy 1 Get 1' : '-',
        ticket.paymentProofUrl ? 'Ada' : 'Tidak Ada',
        ticket.verified ? 'LUNAS' : 'BELUM LUNAS',
        allCheckedIn ? 'HADIR' : 'BELUM DATANG'
      ];
    });

    // 4. GENERATE TABEL OTOMATIS
    autoTable(pdf, {
      startY: 75,
      head: [['No', 'ID Tiket', 'Nama Pembeli', 'Kursi', 'Promo', 'Bukti', 'Status', 'Kehadiran']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [245, 158, 11], // Header tabel warna Amber
        textColor: [0, 0, 0],       // Teks hitam kontras
        fontStyle: 'bold',
        fontSize: 8
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 8 },  
        1: { cellWidth: 16 },  
        2: { cellWidth: 38 },  
        3: { cellWidth: 26 },  
        4: { cellWidth: 26 },
        5: { cellWidth: 16 },
        6: { cellWidth: 20 },
        7: { cellWidth: 30 }
      },
      didParseCell: (data) => {
        // Mewarnai status Lunas / Belum Lunas
        if (data.section === 'body' && data.column.index === 6) {
          if (data.cell.raw === 'LUNAS') {
            data.cell.styles.textColor = [34, 197, 94]; // Hijau
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [239, 68, 68]; // Merah
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Mewarnai bukti bayar Ada / Tidak Ada
        if (data.section === 'body' && data.column.index === 5) {
          if (data.cell.raw === 'Ada') {
            data.cell.styles.textColor = [34, 197, 94]; // Hijau
          } else {
            data.cell.styles.textColor = [239, 68, 68]; // Merah
          }
        }
        // Mewarnai baris Kehadiran khusus penonton yang sudah "HADIR" menjadi Hijau
        if (data.section === 'body' && data.column.index === 7) {
          if (data.cell.raw === 'HADIR') {
            data.cell.styles.textColor = [34, 197, 94]; // Warna hijau Tailwind
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [156, 163, 175];  // Abu-abu
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
      Swal.fire({
        title: 'Format Tidak Valid',
        text: 'Format QR Code tidak valid atau kosong.',
        icon: 'warning',
        background: '#111111',
        color: '#ffffff',
        confirmButtonColor: '#ef4444'
      });
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
        
        let promoText = '';
        if (isFreeUpgrade(foundTicket)) {
          promoText = `<span class="inline-block mt-2 text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded animate-pulse">Promo: Free Upgrade</span>`;
        } else if (isVipBogo(foundTicket)) {
          promoText = `<span class="inline-block mt-2 text-[10px] font-extrabold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded animate-pulse">Promo: Buy 1 Get 1</span>`;
        }

        Swal.fire({
          title: 'CHECK-IN BERHASIL!',
          html: `<div class="text-left">
                   <b>Pembeli:</b> ${foundTicket.buyerName}<br/>
                   <b>Kursi:</b> <span class="text-amber-500 font-mono">${foundTicket.seatNumbers.join(', ')}</span>
                   ${promoText ? `<br/>${promoText}` : ''}
                 </div>`,
          icon: 'success',
          background: '#111111',
          color: '#ffffff',
          confirmButtonColor: '#f59e0b',
          confirmButtonText: 'OK, Lanjut'
        });
      } else {
        Swal.fire({
          title: 'Sudah Check-In',
          html: `Tiket atas nama <b>${foundTicket.buyerName}</b> sudah melakukan scan sebelumnya.`,
          icon: 'info',
          background: '#111111',
          color: '#ffffff',
          confirmButtonColor: '#3b82f6' 
        });
      }
    } else {
      // 2. Jika tidak ketemu di lokal, coba paksa cari langsung ke server Supabase
      try {
        const { data, error } = await supabase.from('tickets').select('*').eq('id', scannedId).single();
        if (error || !data) {
          Swal.fire({
            title: 'Tiket Tidak Valid!',
            text: 'ID tidak terdaftar dalam database acara.',
            icon: 'error',
            background: '#111111',
            color: '#ffffff',
            confirmButtonColor: '#ef4444'
          });
          return;
        }
        
        setShowScanner(false);
        setSearchQuery(scannedId);
        await fetchTickets(); // Refresh list lokal
        
        Swal.fire({
          title: 'Tiket Ditemukan',
          text: `Tiket atas nama ${data.buyer_name} ada di database. Silahkan tekan tombol "Tandai Hadir" pada layar.`,
          icon: 'success',
          background: '#111111',
          color: '#ffffff',
          confirmButtonColor: '#f59e0b'
        });
      } catch (e) {
        Swal.fire({
          title: 'Gagal Membaca',
          text: 'QR Code tidak dikenali atau format salah.',
          icon: 'error',
          background: '#111111',
          color: '#ffffff',
          confirmButtonColor: '#ef4444'
        });
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
            Swal.fire({
              title: 'Gambar Tidak Terbaca',
              text: 'Coba screenshot ulang bagian QR Code saja secara lebih jelas.',
              icon: 'warning',
              background: '#111111',
              color: '#ffffff',
              confirmButtonColor: '#f59e0b'
            });
            return;
        }

        try {
            const code = jsQR(imageData.data, newWidth, newHeight, {
                inversionAttempts: "dontInvert",
            });
            
            if (code) {
                handleScanQR(code.data); 
            } else {
                Swal.fire({
                  title: 'QR Code Tidak Terdeteksi',
                  text: 'Tips: Crop pas di bagian kotak QR Code saja sebelum di-upload.',
                  icon: 'warning',
                  background: '#111111',
                  color: '#ffffff',
                  confirmButtonColor: '#f59e0b'
                });
            }
        } catch (err) {
            console.error("Error saat memproses QR:", err);
            Swal.fire({
              title: 'Gagal Memproses Gambar',
              text: 'Terjadi kesalahan saat memindai gambar QR.',
              icon: 'error',
              background: '#111111',
              color: '#ffffff',
              confirmButtonColor: '#ef4444'
            });
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
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {!ticket.verified && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" /> Blm Lunas
                          </span>
                        )}
                        {isFreeUpgrade(ticket) && (
                          <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded animate-pulse">
                            Free Upgrade
                          </span>
                        )}
                        {isVipBogo(ticket) && (
                          <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded animate-pulse">
                            Buy 1 Get 1
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {ticket.seatNumbers.map((s: string) => {
                        const isChecked = currentCheckedInSeats.includes(s);
                        const catColor = getCategoryColorObj(s);
                        return (
                        <button 
                          key={s} 
                          onClick={() => handleSingleCheckIn(ticket.id, s, ticket)}
                          className={cn(
                            "text-[10px] font-mono px-2 py-1 rounded border transition-colors flex items-center justify-center gap-1",
                            isChecked 
                              ? `${catColor.bgLight} border ${catColor.borderDim} ${catColor.text}` 
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
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-white/10 pb-4">
                <h3 className="font-bold text-white text-center sm:text-left">Live Seat Map (Status Pintu)</h3>
                
                <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-white/5 border border-white/10 rounded-sm" /> Kosong
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-white/10 border border-white/40 rounded-sm shadow-[0_0_8px_rgba(255,255,255,0.05)]" /> Tengah Layar
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-gray-500/20 border border-gray-500/50 rounded-sm" /> Belum Datang
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-gray-400 border border-gray-300 rounded-sm shadow-[0_0_10px_rgba(156,163,175,0.3)]" /> Di Dalam
                  </div>
                </div>
              </div>

              {/* Seat Grid - Posisinya Dinaikkan Ke Atas */}
              <div className="flex flex-col gap-8">
                {(Object.keys(PRICING) as SeatType[]).map(type => {
                  if (type === 'Reguler - Depan' || type === 'Reguler - Belakang') return null;

                  if (type === 'VIP') {
                    const catColor = getCategoryColorObj(type);
                    const colorClass = catColor.text;

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
                                  const isBooked = bookedSeats.has(seatId);
                                  const isCheckedIn = checkedInSeats.has(seatId);

                                  return (
                                    <div
                                      key={seatId}
                                      title={seatId}
                                      className={cn(
                                        "w-5 h-5 md:w-6 md:h-6 rounded-t shrink-0 flex items-center justify-center text-[8px] sm:text-[9px] font-mono transition-all duration-300 relative",
                                        isCheckedIn
                                          ? `${catColor.bg} border ${catColor.border} ${catColor.textChecked} ${catColor.shadow} z-10`
                                          : isBooked
                                            ? `${catColor.bgDim} border ${catColor.borderDim} ${catColor.text}`
                                            : "bg-white/5 border border-white/10 text-gray-700"
                                      )}
                                    >
                                      {cell.label}
                                    </div>
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
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-505">AISLE / JALAN</span>
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
                                  const isBooked = bookedSeats.has(seatId);
                                  const isCheckedIn = checkedInSeats.has(seatId);
                                  const isCenterSeat = colIndex >= 18 && colIndex <= 21;

                                  const catColor = getCategoryColorObj(seatId);
                                  const centerSeatClass = 'bg-white/10 border-white/40 text-gray-300 shadow-[0_0_8px_rgba(255,255,255,0.05)]';

                                  return (
                                    <div
                                      key={seatId}
                                      title={isCenterSeat ? `${seatId} (Kursi Tengah)` : seatId}
                                      className={cn(
                                        "w-5 h-5 md:w-6 md:h-6 rounded-t shrink-0 flex items-center justify-center text-[8px] sm:text-[9px] font-mono transition-all duration-300 relative",
                                        isCheckedIn
                                          ? `${catColor.bg} border ${catColor.border} ${catColor.textChecked} ${catColor.shadow} z-10`
                                          : isBooked
                                            ? `${catColor.bgDim} border ${catColor.borderDim} ${catColor.text}`
                                            : isCenterSeat
                                              ? cn("border font-bold", centerSeatClass)
                                              : "bg-white/5 border border-white/10 text-gray-700"
                                      )}
                                    >
                                      {cell.label}
                                    </div>
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

              {/* Screen Divider - Posisinya Diturunkan Ke Bawah */}
              <div className="w-full border-t-[8px] border-amber-500/20 mt-12 relative flex justify-center">
                <span className="absolute -top-3 bg-[#111111] px-4 text-sm font-bold text-amber-500 tracking-[0.5em] uppercase">S c r e e n</span>
                <div className="absolute bottom-0 w-3/4 h-32 bg-gradient-to-t from-amber-500/10 to-transparent blur-2xl pointer-events-none" />
              </div>

            </CardContent>
          </Card>
        </div>
        
      </div>
    </div>
  );
}