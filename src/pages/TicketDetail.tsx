import React, { useRef, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { ArrowLeft, Download, CheckCircle, Clock, MapPin, Film, Edit, Trash2, Loader2, FileText, ExternalLink, MessageCircle } from 'lucide-react';
import { cn } from '@/utils';
import { supabase } from '../supabaseClient'; 

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

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // DUA REFERENSI: 1 untuk Tiket, 1 untuk Halaman Apresiasi VIP
  const ticketRef = useRef<HTMLDivElement>(null);
  const appreciationRef = useRef<HTMLDivElement>(null);
  
  const [ticket, setTicket] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const backgroundImage = "/background.png";

  useEffect(() => {
    const fetchTicketDetail = async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
          setTicket({
            id: data.id,
            buyerName: data.buyer_name,
            marketingName: data.marketing_name,
            seatType: data.seat_type,
            seatNumbers: sortSeats(data.seat_numbers || []),
            paymentMethod: data.payment_method,
            paymentTenor: data.payment_tenor,
            subtitleLanguage: data.subtitle_language,
            totalPrice: data.total_price,
            verified: data.is_verified,
            purchaseDate: data.purchase_date,
            settlementDate: data.settlement_date,
            paymentProofUrl: data.payment_proof_url, 
          });
        }
      } catch (error) {
        console.error("Gagal menarik detail tiket:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchTicketDetail();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-amber-500 gap-4">
         <Loader2 className="w-10 h-10 animate-spin" />
         <p className="text-gray-400 font-medium tracking-wider animate-pulse">Memuat tiket...</p>
      </div>
    );
  }

  if (!ticket && !isLoading) {
    return (
      <div className="text-center py-24 text-gray-400">
        <h2 className="text-2xl font-bold text-white mb-2">Tiket tidak ditemukan</h2>
        <p>Data tiket yang Anda cari tidak ada dalam database kami.</p>
        <Link to="/dashboard"><Button className="mt-6">Kembali ke Dashboard</Button></Link>
      </div>
    );
  }

  // FUNGSI PDF BARU: Menggabungkan Tiket & Desain Apresiasi Visual
  const downloadPDF = async () => {
    if (!ticketRef.current || !appreciationRef.current) return;
    setIsDownloading(true);
    
    const nodeTicket = ticketRef.current;
    const nodeApresiasi = appreciationRef.current;
    const parentNode = nodeTicket.parentElement;
    
    const originalWidth = nodeTicket.style.width;
    const originalHeight = nodeTicket.style.height;
    const originalParentOverflow = parentNode ? parentNode.style.overflow : '';

    try {
      nodeTicket.style.setProperty('width', '600px', 'important'); 
      nodeTicket.style.setProperty('height', 'auto', 'important'); 
      if (parentNode) {
        parentNode.style.setProperty('overflow', 'visible', 'important');
      }
      
      // Tunggu render QR & Font
      await new Promise(resolve => setTimeout(resolve, 300));

      const actualWidth = 600;
      const ticketHeight = nodeTicket.offsetHeight; 
      const apresiasiHeight = 846; // Ukuran A4 Proporsional

      // 1. Snapshot Halaman 1 (Tiket Utama)
      const imgTicket = await toPng(nodeTicket, { 
        backgroundColor: '#0A0A0A',
        pixelRatio: 2, 
        width: actualWidth,
        height: ticketHeight,
        style: { width: `${actualWidth}px`, height: `${ticketHeight}px`, margin: '0', transform: 'none' }
      });

      // 2. Snapshot Halaman 2 (Apresiasi VIP Tersembunyi)
      const imgApresiasi = await toPng(nodeApresiasi, { 
        backgroundColor: '#0A0A0A',
        pixelRatio: 2, 
        width: actualWidth,
        height: apresiasiHeight,
        style: { width: `${actualWidth}px`, height: `${apresiasiHeight}px`, margin: '0', transform: 'none' }
      });
      
      // Kembalikan Tampilan Website
      nodeTicket.style.width = originalWidth;
      nodeTicket.style.height = originalHeight;
      if (parentNode) {
        parentNode.style.overflow = originalParentOverflow;
      }

      // 3. Susun ke dalam jsPDF
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [actualWidth, ticketHeight] });
      
      // Masukkan Halaman 1
      pdf.addImage(imgTicket, 'PNG', 0, 0, actualWidth, ticketHeight);

      // Tambah & Masukkan Halaman 2
      pdf.addPage([actualWidth, apresiasiHeight], 'p');
      pdf.addImage(imgApresiasi, 'PNG', 0, 0, actualWidth, apresiasiHeight);

      pdf.save(`Tiket_Nobar_${ticket.buyerName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      nodeTicket.style.width = originalWidth;
      nodeTicket.style.height = originalHeight;
      if (parentNode) {
        parentNode.style.overflow = originalParentOverflow;
      }
      alert('Gagal membuat PDF. Silahkan coba lagi.');
    } finally {
      setIsDownloading(false);
    }
  };

  // FUNGSI KIRIM WHATSAPP OTOMATIS
  const sendWhatsApp = () => {
    const waText = `Yang kami kasihi *${ticket.buyerName}*,

Salam hangat dari tim GPI Cinematix 2026.

Melalui pesan ini, kami menginformasikan bahwa pembayaran Anda telah berhasil kami verifikasi. Kami sangat mengapresiasi dan berterima kasih atas donasi serta dukungan yang diberikan untuk menyukseskan acara Nonton Bareng GPI 2026.

Terlampir adalah dokumen PDF yang berisi e-Ticket Anda (pada halaman pertama) dan surat apresiasi dari kepanitiaan kami (pada halaman kedua).

Mohon untuk menyimpan dokumen ini dan menyiapkan QR Code di halaman pertama saat proses registrasi kehadiran di lokasi.

*Detail Kursi:* ${ticket.seatNumbers.join(', ')}
*Waktu:* Sabtu, 11 Juli 2026 | 12:00 WIB
*Tempat:* Cinema 1, Lt.1 - Cinepolis Senayan Park Jakarta

Kami sangat menantikan kehadiran Anda. Terima kasih atas kepercayaan dan kontribusi mulia yang telah diberikan.

Salam hormat,
*GPI Cinematix 2026 Committee*`;

    const encodedText = encodeURIComponent(waText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const verifyTicket = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ is_verified: true, settlement_date: ticket.settlementDate || today })
        .eq('id', ticket.id);

      if (error) throw error;

      setTicket((prev: any) => ({ ...prev, verified: true, settlementDate: prev.settlementDate || today }));
      alert("Tiket berhasil ditandai Lunas!");
    } catch (error) {
      console.error("Gagal memverifikasi tiket:", error);
      alert("Gagal memperbarui status tiket di database.");
    }
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase.from('tickets').delete().eq('id', ticket.id);
      if (error) throw error;
      
      setIsDeleteDialogOpen(false);
      navigate('/dashboard');
    } catch (error) {
      console.error("Gagal menghapus tiket:", error);
      alert("Terjadi kesalahan saat menghapus tiket.");
    }
  };

  const handleDelete = () => setIsDeleteDialogOpen(true);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 pb-12 relative overflow-x-hidden">
      
      {/* Header & Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link to="/dashboard" className="text-gray-400 hover:text-white flex items-center gap-2 font-medium transition-colors">
          <ArrowLeft className="w-5 h-5" /> Kembali
        </Link>
        <div className="flex flex-wrap justify-center gap-3">
           <Link to={`/book?edit=${ticket.id}`}>
             <Button variant="outline" className="whitespace-nowrap border-white/10 text-white hover:bg-white/5">
               <Edit className="w-4 h-4 mr-2" /> Edit Tiket
             </Button>
           </Link>
           <Button variant="outline" onClick={handleDelete} className="whitespace-nowrap border-red-500/30 text-red-500 hover:bg-red-500/10">
             <Trash2 className="w-4 h-4 mr-2" /> Hapus
           </Button>
           {!ticket.verified && (
             <Button variant="outline" onClick={verifyTicket} className="border-green-500/30 text-green-400 hover:bg-green-500/10 whitespace-nowrap">
               <CheckCircle className="w-4 h-4 mr-2" /> Tandai Lunas
             </Button>
           )}
           
           {/* Tombol Kirim WA Otomatis */}
           <Button onClick={sendWhatsApp} className="font-bold whitespace-nowrap bg-green-500 text-white hover:bg-green-600 border-none">
             <MessageCircle className="w-4 h-4 mr-2" /> Buat Pesan WA
           </Button>

           {/* Tombol Download PDF */}
           <Button onClick={downloadPDF} disabled={isDownloading} className="font-bold whitespace-nowrap bg-amber-500 text-black hover:bg-amber-600">
             {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
             {isDownloading ? "Mengunduh..." : "Unduh PDF"}
           </Button>
        </div>
      </div>

      {/* TICKET CARD START (HALAMAN 1 PDF) */}
      <div className="max-w-xl mx-auto drop-shadow-2xl overflow-hidden rounded-2xl relative border border-white/10">
        <div 
          ref={ticketRef} 
          className="relative text-gray-100 p-8 pt-0 w-[600px] h-max min-h-[900px] flex flex-col justify-between bg-black" 
          style={{ fontFamily: 'var(--font-sans)', width: '100%', height: '100%' }}
        >
          {/* Background Overlay */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img 
              src={backgroundImage} 
              alt="Background" 
              className="w-full h-full object-cover opacity-50 grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/95" />
          </div>
            
           {/* Top Section - Event Details */}
           <div className="pt-8 relative z-10">
             <div className="text-center mb-8 pb-8 border-b border-white/10 border-dashed">
               <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-500/10 text-amber-500 mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                 <Film className="w-8 h-8" />
               </div>
               <h1 className="text-4xl font-display font-bold uppercase tracking-widest text-white mb-2">Cine<span className="text-amber-500">matix</span></h1>
               <p className="text-gray-400 tracking-widest font-mono text-sm uppercase">Nonton Bareng Event 2026</p>
             </div>

             <div className="mb-8">
               <h2 className="text-2xl font-bold font-display text-white mb-1">Children of Heaven (2026)</h2>
               <p className="text-amber-500 font-medium pb-2 border-b border-white/10">Subtitle: {ticket.subtitleLanguage}</p>
             </div>

             <div className="grid grid-cols-2 gap-y-6">
                <div>
                  <div className="text-xs text-gray-400 uppercase font-bold mb-1">Pembeli / Name</div>
                  <div className="font-semibold text-lg text-white">{ticket.buyerName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase font-bold mb-1">Tanggal / Date</div>
                  <div className="font-semibold text-lg text-white">11 Juli 2026</div>
                </div>
                <div>
                   <div className="text-xs text-gray-400 uppercase font-bold mb-1">Waktu / Time</div>
                   <div className="font-semibold text-lg text-white flex items-center gap-1">
                     <Clock className="w-4 h-4 text-amber-500" /> 11:30 WIB
                   </div>
                </div>
                <div>
                   <div className="text-xs text-gray-400 uppercase font-bold mb-1">Seats ({ticket.seatType})</div>
                   <div className="font-semibold text-lg text-amber-500 font-mono tracking-wider leading-relaxed">
                     {ticket.seatNumbers.join(', ')}
                   </div>
                </div>
                <div className="col-span-2">
                   <div className="text-xs text-gray-400 uppercase font-bold mb-1">Lokasi Studio</div>
                   <div className="font-semibold text-white flex items-center gap-2">
                     <MapPin className="w-4 h-4 text-amber-500" /> 
                     Cinema 1, Cinepolis Senayan Park Jakarta
                   </div>
                </div>
             </div>
           </div>

           <div className="pt-8 mt-8 border-t border-white/10 border-dashed relative z-10 flex flex-col items-center">
             <div className="flex flex-col items-center mb-6 text-center w-full">
                <span className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold uppercase mb-3 border",
                  ticket.verified 
                    ? "bg-green-500/10 text-green-400 border-green-500/30" 
                    : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                )}>
                  {ticket.verified ? "Lunas & Terverifikasi" : "Belum Lunas"}
                </span>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-gray-400">
                  <span>Marketing: <span className="text-gray-200 font-medium">{ticket.marketingName}</span></span>
                  {ticket.purchaseDate && <span>Tgl Beli: <span className="text-gray-200">{ticket.purchaseDate}</span></span>}
                </div>
             </div>

             <div className="bg-white p-4 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-4">
               <QRCodeSVG 
                 value={`${window.location.origin}/checkin/${ticket.id}`}
                 size={240}
                 level="H"
                 includeMargin={true}
                 bgColor={"#FFFFFF"}
                 fgColor={"#000000"}
               />
             </div>

             <div className="text-center space-y-1">
               <div className="text-[10px] text-gray-400 uppercase tracking-widest">Scan untuk Check-in</div>
               <div className="font-mono text-sm text-amber-500 font-bold tracking-widest">{ticket.id.toUpperCase()}</div>
             </div>
           </div>
           
           <div className="absolute top-[60%] -left-4 w-8 h-8 rounded-full bg-[#0A0A0A] border-r border-white/10 transform -translate-y-1/2 z-10" />
           <div className="absolute top-[60%] -right-4 w-8 h-8 rounded-full bg-[#0A0A0A] border-l border-white/10 transform -translate-y-1/2 z-10" />
        </div>
      </div>
      {/* TICKET CARD END */}

      {/* BLOK TAMPILAN BUKTI PEMBAYARAN */}
      {ticket.paymentProofUrl && (
        <div className="max-w-xl mx-auto mt-6 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4">Bukti Pembayaran</h3>
          
          {ticket.paymentProofUrl.toLowerCase().includes('.pdf') ? (
             <div className="flex flex-col items-center gap-3 py-4">
               <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
                 <FileText className="w-8 h-8 text-red-500" />
               </div>
               <p className="text-gray-400 text-sm">Bukti pembayaran berupa dokumen PDF.</p>
               <a href={ticket.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                 <Button variant="outline" className="border-white/10 hover:bg-white/10 text-white mt-2">
                   Buka File PDF <ExternalLink className="w-4 h-4 ml-2" />
                 </Button>
               </a>
             </div>
          ) : (
            <div className="relative group w-full flex justify-center">
              <img 
                src={ticket.paymentProofUrl} 
                alt="Bukti Pembayaran" 
                className="max-h-[400px] object-contain rounded-lg border border-white/10" 
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                <a href={ticket.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" className="font-bold">
                    Buka Gambar Penuh <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Modal Hapus Tiket */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-white/10 p-6 rounded-2xl max-w-sm w-full space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Hapus Tiket</h3>
              <p className="text-gray-400 text-sm">Apakah Anda yakin ingin menghapus tiket ini? Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="flex gap-3">
               <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5 text-white" onClick={() => setIsDeleteDialogOpen(false)}>
                 Batal
               </Button>
               <Button variant="outline" className="flex-1 bg-red-500 hover:bg-red-600 border-none text-white" onClick={confirmDelete}>
                 Hapus Tiket
               </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
        HALAMAN 2 PDF (APRESIASI VIP) - DISEMBUNYIKAN DARI LAYAR WEBSITE 
        ==================================================================
      */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
        <div 
          ref={appreciationRef}
          className="relative w-[600px] h-[846px] bg-[#0A0A0A] p-10 flex flex-col items-center justify-center overflow-hidden"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {/* Background Sama Persis Dengan Tiket */}
          <div className="absolute inset-0 z-0">
            <img 
              src={backgroundImage} 
              alt="Premium Background" 
              className="w-full h-full object-cover opacity-80 grayscale"
            />
            {/* Gradien yang sangat gelap agar teks putih kontras & terbaca jelas */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/80 to-black/95" />
          </div>

          {/* Konten & Bingkai VIP */}
          <div className="relative z-10 w-full h-full border-[3px] border-amber-500 p-2 rounded-sm shadow-[0_0_50px_rgba(245,158,11,0.15)]">
            <div className="border border-white/20 h-full p-12 flex flex-col items-center justify-center text-center">
              
              <h3 className="text-white text-base tracking-[0.4em] font-bold mb-10 uppercase">
                Cine<span className="text-amber-500">matix</span> <span className="text-gray-500 font-normal text-sm">ELITE</span>
              </h3>
              
              <h1 className="text-4xl text-amber-500 font-bold tracking-[0.15em] mb-6">
                APRESIASI EKSKLUSIF
              </h1>
              
              <div className="w-24 h-px bg-white/20 mb-10" />
              
              <p className="text-gray-400 text-xs tracking-[0.2em] uppercase mb-4">
                DIBERIKAN DENGAN PENUH KEHORMATAN KEPADA:
              </p>
              
              <h2 className="text-4xl text-white font-bold mb-12 px-4 leading-tight uppercase tracking-wider">
                {ticket.buyerName}
              </h2>
              
              <p className="text-gray-300 text-[15px] leading-[1.8] mb-16 max-w-sm">
                Kami menyampaikan penghargaan setinggi-tingginya atas partisipasi dan dedikasi Anda. Kontribusi Anda tidak hanya menyempurnakan malam penayangan ini, tetapi juga mewujudkan dampak nyata bagi inisiatif <span className="italic">fundraising</span> yang kita bangun bersama.
                <br/><br/>
                Selamat menikmati persembahan sinematik eksklusif dari kami.
              </p>

              <div className="mt-auto">
                <p className="text-amber-500 font-bold tracking-widest uppercase text-sm border-t border-amber-500/30 pt-4">
                  GPI CINEMATIX 2026 COMMITTEE
                </p>
              </div>
              
            </div>
          </div>
        </div>
      </div>
      {/* ======================= AKHIR HALAMAN 2 ======================= */}

    </div>
  );
}