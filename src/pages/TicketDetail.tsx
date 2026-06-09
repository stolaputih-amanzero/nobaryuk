import React, { useRef, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QRCodeCanvas } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { ArrowLeft, Download, CheckCircle, Clock, MapPin, Film, Edit, Trash2, Loader2, FileText, ExternalLink } from 'lucide-react';
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
  const ticketRef = useRef<HTMLDivElement>(null);
  
  const [ticket, setTicket] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const backgroundImage = "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&auto=format&fit=crop&q=80";

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
            // PERBAIKAN: Hubungkan data link gambar dari Supabase ke state
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

  const downloadPDF = async () => {
    if (!ticketRef.current) return;
    setIsDownloading(true);
    try {
      // Perbaikan: Paksa ukuran canvas penangkapan gambar konstan di HP maupun Laptop
      const imgData = await toPng(ticketRef.current, { 
        backgroundColor: '#0A0A0A',
        pixelRatio: 3, // Meningkatkan ketajaman teks saat dicetak
        width: 500,    // Paksa lebar standar tiket cetak 
        height: 800,   // Paksa tinggi standar tiket cetak
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '500px',
          height: '800px',
        }
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // Hitung rasio tinggi proporsional berdasarkan resolusi paksaan di atas
      const pdfHeight = (800 * pdfWidth) / 500; 
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Tiket_${ticket.buyerName.replace(/\s+/g, '_')}_Cinepolis.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Gagal membuat PDF. Silahkan coba lagi atau screenshot tiket ini.');
    } finally {
      setIsDownloading(false);
    }
  };

  const verifyTicket = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          is_verified: true, 
          settlement_date: ticket.settlementDate || today 
        })
        .eq('id', ticket.id);

      if (error) throw error;

      setTicket((prev: any) => ({
        ...prev,
        verified: true,
        settlementDate: prev.settlementDate || today
      }));
      
      alert("Tiket berhasil ditandai Lunas!");
    } catch (error) {
      console.error("Gagal memverifikasi tiket:", error);
      alert("Gagal memperbarui status tiket di database.");
    }
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticket.id);

      if (error) throw error;
      
      setIsDeleteDialogOpen(false);
      navigate('/dashboard');
    } catch (error) {
      console.error("Gagal menghapus tiket:", error);
      alert("Terjadi kesalahan saat menghapus tiket.");
    }
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link to="/dashboard" className="text-gray-400 hover:text-white flex items-center gap-2 font-medium transition-colors">
          <ArrowLeft className="w-5 h-5" /> Kembali
        </Link>
        <div className="flex flex-wrap gap-3">
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
           <Button onClick={downloadPDF} disabled={isDownloading} className="font-bold whitespace-nowrap">
             {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
             {isDownloading ? "Mengunduh..." : "Unduh PDF"}
           </Button>
        </div>
      </div>

      <div className="max-w-xl mx-auto drop-shadow-2xl overflow-hidden rounded-2xl relative border border-white/10">
        
        <div 
          ref={ticketRef} 
          className="relative text-gray-100 p-8 pt-0 w-[600px] h-[900px] flex flex-col justify-between bg-black" 
          style={{ fontFamily: 'var(--font-sans)', width: '100%', height: '100%' }}
        >
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img 
              src={backgroundImage} 
              alt="Background Sepatu" 
              className="w-full h-full object-cover opacity-20 grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
          </div>
           
           <div className="pt-8 relative z-10">
             <div className="text-center mb-8 pb-8 border-b border-white/10 border-dashed">
               <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-500/10 text-amber-500 mb-4">
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

           <div className="pt-8 mt-8 border-t border-white/10 relative z-10">
             <div className="flex justify-between items-end">
               <div>
                   <div className="mb-2">
                     <span className={cn(
                       "px-3 py-1 rounded text-xs font-bold uppercase block mb-1 w-max",
                       ticket.verified ? "bg-green-500/20 text-green-400 border border-green-500/50" : "bg-amber-500/20 text-amber-500 border border-amber-500/50"
                     )}>
                       {ticket.verified ? "Lunas & Terverifikasi" : "Belum Lunas"}
                     </span>
                     {ticket.purchaseDate && <div className="text-[10px] text-gray-500">Tgl Beli: <span className="text-gray-400">{ticket.purchaseDate}</span></div>}
                     {ticket.settlementDate && <div className="text-[10px] text-gray-500">Tgl Lunas: <span className="text-gray-400">{ticket.settlementDate}</span></div>}
                  </div>
                  <div className="text-xs text-gray-400">Ticket ID: <span className="font-mono text-gray-300">{ticket.id.toUpperCase()}</span></div>
                  <div className="text-xs text-gray-400 mt-1">Marketing: {ticket.marketingName}</div>
               </div>
               
               <div className="bg-white p-2 rounded-lg">
                 <QRCodeCanvas 
                   value={JSON.stringify({ 
                     id: ticket.id, 
                     buyer: ticket.buyerName, 
                     seats: ticket.seatNumbers.join(','),
                     verified: ticket.verified
                   })}
                   size={100}
                   level="H"
                   includeMargin={false}
                 />
               </div>
             </div>
           </div>
           
           <div className="absolute top-1/2 -left-4 w-8 h-8 rounded-full bg-[#0A0A0A] border-r border-white/10 transform -translate-y-1/2 z-10" />
           <div className="absolute top-1/2 -right-4 w-8 h-8 rounded-full bg-[#0A0A0A] border-l border-white/10 transform -translate-y-1/2 z-10" />
           
        </div>
      </div>

      {/* BLOK TAMPILAN BUKTI PEMBAYARAN */}
      {ticket.paymentProofUrl && (
        <div className="max-w-xl mx-auto mt-6 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4">Bukti Pembayaran</h3>
          
          {/* Cek apakah file yang di-upload adalah PDF atau Gambar */}
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
            <div className="relative group">
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
      
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-white/10 p-6 rounded-2xl max-w-sm w-full space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Hapus Tiket</h3>
              <p className="text-gray-400 text-sm">Apakah Anda yakin ingin menghapus tiket ini? Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="flex gap-3">
               <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5" onClick={() => setIsDeleteDialogOpen(false)}>
                 Batal
               </Button>
               <Button variant="outline" className="flex-1 bg-red-500 hover:bg-red-600 border-none text-white" onClick={confirmDelete}>
                 Hapus Tiket
               </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}