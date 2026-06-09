import React, { useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QRCodeCanvas } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ArrowLeft, Download, CheckCircle, Clock, MapPin, Film, Edit, Trash2, Loader2 } from 'lucide-react';
import { formatRupiah, cn } from '@/utils';

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { bookings, updateBooking, deleteBooking } = useAppContext();
  const ticket = bookings.find(b => b.id === id);
  const ticketRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  if (!ticket) {
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
      const imgData = await toPng(ticketRef.current, { 
        backgroundColor: '#0f172a',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });
      
      // A4 dimensions approx 210x297
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // We know html-to-image returns high quality PNG. Get dimensions.
      const img = new Image();
      img.src = imgData;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const ratio = img.width / img.height;
      const pdfHeight = pdfWidth / ratio;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Tiket_${ticket.buyerName.replace(/\s+/g, '_')}_Cinepolis.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Gagal membuat PDF. Silahkan coba lagi atau screenshot tiket ini.');
    } finally {
      setIsDownloading(false);
    }
  };

  const verifyTicket = () => {
    updateBooking(ticket.id, { 
      verified: true, 
      settlementDate: ticket.settlementDate || new Date().toISOString().split('T')[0] 
    });
  };

  const generateCalendarICS = () => {
    const eventParams = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'DTSTART:20260711T080000Z',
      'DTEND:20260711T103000Z',
      'SUMMARY:Nonton Bareng: Children of Heaven',
      'DESCRIPTION:Penayangan eksklusif Nonton Bareng film Children of Heaven (2026) di Cinepolis Senayan Park Jakarta. Harap bawa QR Tiket Anda.\\n\\nID Tiket: ' + ticket.id + '\\nNomor Kursi: ' + ticket.seatNumbers.join(', '),
      'LOCATION:Cinepolis Senayan Park - Jakarta',
      'BEGIN:VALARM',
      'TRIGGER:-PT1440M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder H-1 Nonton Bareng Children of Heaven',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\\r\\n');

    const blob = new Blob([eventParams], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Nonton_Bareng_Children_Of_Heaven.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmDelete = () => {
    if (ticket) {
      deleteBooking(ticket.id);
      navigate('/dashboard');
    }
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
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
           <Button variant="secondary" onClick={generateCalendarICS} className="whitespace-nowrap">
             <Clock className="w-4 h-4 mr-2" /> Simpan ke Kalender
           </Button>
           <Button onClick={downloadPDF} disabled={isDownloading} className="font-bold whitespace-nowrap">
             {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
             {isDownloading ? "Mengunduh..." : "Unduh PDF"}
           </Button>
        </div>
      </div>

      {/* Ticket Download Container - specifically crafted to look good in PDF */}
      <div className="max-w-xl mx-auto drop-shadow-2xl overflow-hidden rounded-2xl relative bg-white/5 border border-white/10">
        {/* Invisible wrapper ref for PDF capture with specific styling to ensure it looks exactly like UI */}
        <div ref={ticketRef} className="bg-white/5 text-gray-100 p-8 pt-0 w-[600px] h-[900px] flex flex-col justify-between" style={{ fontFamily: 'var(--font-sans)', width: '100%', height: '100%' }}>
           
           <div className="pt-8">
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
                  <div className="text-xs text-gray-500 uppercase font-bold mb-1">Pembeli / Name</div>
                  <div className="font-semibold text-lg text-white">{ticket.buyerName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase font-bold mb-1">Tanggal / Date</div>
                  <div className="font-semibold text-lg text-white">11 Juli 2026</div>
                </div>
                <div>
                   <div className="text-xs text-gray-500 uppercase font-bold mb-1">Waktu / Time</div>
                   <div className="font-semibold text-lg text-white flex items-center gap-1">
                     <Clock className="w-4 h-4 text-amber-500" /> 15:00 WIB
                   </div>
                </div>
                <div>
                   <div className="text-xs text-gray-500 uppercase font-bold mb-1">Seats ({ticket.seatType})</div>
                   <div className="font-semibold text-lg text-amber-500 font-mono tracking-wider">
                     {ticket.seatNumbers.join(', ')}
                   </div>
                </div>
                <div className="col-span-2">
                   <div className="text-xs text-gray-500 uppercase font-bold mb-1">Lokasi Studio</div>
                   <div className="font-semibold text-white flex items-center gap-2">
                     <MapPin className="w-4 h-4 text-amber-500" /> 
                     Cinema 1, Cinepolis Senayan Park Jakarta
                   </div>
                </div>
             </div>
           </div>

           <div className="pt-8 mt-8 border-t border-white/10">
             <div className="flex justify-between items-end">
               <div>
                   <div className="mb-2">
                     <span className={cn(
                       "px-3 py-1 rounded text-xs font-bold uppercase block mb-1 w-max",
                       ticket.verified ? "bg-green-500/20 text-green-400 border border-green-500/50" : "bg-red-500/20 text-red-500 border border-red-500/50"
                     )}>
                       {ticket.verified ? "Lunas & Terverifikasi" : "Belum Lunas"}
                     </span>
                     {ticket.purchaseDate && <div className="text-[10px] text-gray-500">Tgl Beli: <span className="text-gray-400">{ticket.purchaseDate}</span></div>}
                     {ticket.settlementDate && <div className="text-[10px] text-gray-500">Tgl Lunas: <span className="text-gray-400">{ticket.settlementDate}</span></div>}
                  </div>
                  <div className="text-xs text-gray-500">Ticket ID: <span className="font-mono text-gray-400">{ticket.id.toUpperCase()}</span></div>
                  <div className="text-xs text-gray-500 mt-1">Marketing: {ticket.marketingName}</div>
               </div>
               
               {/* Barcode section */}
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
           
           <div className="absolute top-1/2 -left-4 w-8 h-8 rounded-full bg-black border-r border-white/10 transform -translate-y-1/2" />
           <div className="absolute top-1/2 -right-4 w-8 h-8 rounded-full bg-black border-l border-white/10 transform -translate-y-1/2" />
           
        </div>
      </div>

      {ticket.paymentProofUrl && (
        <div className="max-w-xl mx-auto mt-6 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4">Bukti Pembayaran</h3>
          <img src={ticket.paymentProofUrl} alt="Bukti Pembayaran" className="max-h-[300px] object-contain rounded-lg border border-white/10" />
        </div>
      )}
      
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#0f172a] border border-white/10 p-6 rounded-2xl max-w-sm w-full space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Hapus Tiket</h3>
              <p className="text-gray-400 text-sm">Apakah Anda yakin ingin menghapus tiket ini? Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="flex gap-3">
               <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5" onClick={() => setIsDeleteDialogOpen(false)}>
                 Batal
               </Button>
               <Button variant="primary" className="flex-1 bg-red-500 hover:bg-red-600 border-none text-white" onClick={confirmDelete}>
                 Hapus Tiket
               </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
