import React, { useState, useMemo } from 'react';
import { useAppContext, PRICING, SeatType } from '../store/AppContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils';
import { Search, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';

export default function CheckIn() {
  const { bookings, updateBooking } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  
  // Computations for map
  const { bookedSeats, checkedInSeats } = useMemo(() => {
    const booked = new Set<string>();
    const checkedIn = new Set<string>();
    
    bookings.forEach(b => {
      b.seatNumbers.forEach(s => {
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
      const sorted = [...bookings].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return showAll ? sorted : sorted.slice(0, 10);
    }
    const query = searchQuery.toLowerCase();
    return bookings.filter(b => 
      b.id.toLowerCase().includes(query) || 
      b.buyerName.toLowerCase().includes(query) ||
      b.seatNumbers.some(s => s.toLowerCase().includes(query))
    );
  }, [searchQuery, bookings, showAll]);

  const handleBulkCheckIn = (id: string, allCheckedIn: boolean, seats: string[]) => {
    updateBooking(id, { 
      checkedInSeats: allCheckedIn ? [] : [...seats],
      checkedIn: !allCheckedIn 
    });
  };

  const handleSingleCheckIn = (id: string, seat: string, ticket: any) => {
    let currentCheckedInSeats = ticket.checkedInSeats || (ticket.checkedIn ? [...ticket.seatNumbers] : []);
    
    let newList = [...currentCheckedInSeats];
    if (newList.includes(seat)) {
      newList = newList.filter((s: string) => s !== seat);
    } else {
      newList.push(seat);
    }
    
    updateBooking(id, {
      checkedInSeats: newList,
      checkedIn: newList.length === ticket.seatNumbers.length
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-white mb-2">Registrasi Kehadiran (Check-In)</h1>
        <p className="text-gray-400">Verifikasi tiket pembeli yang hadir dan pantau okupansi kursi secara real-time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Search & List */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="p-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Cari ID Tiket, Nama, atau Kursi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-shadow"
                />
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
                  <div key={ticket.id} className="bg-black border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white text-sm">{ticket.buyerName}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">ID: {ticket.id.toUpperCase()}</div>
                      </div>
                      {!ticket.verified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3" /> Blm Lunas
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {ticket.seatNumbers.map(s => {
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
                      className={cn("w-full h-8 text-xs mt-1", allCheckedIn && "border-green-500/50 text-green-500 hover:bg-green-500/10")}
                    >
                      {allCheckedIn ? (
                         <><CheckCircle2 className="w-3 h-3 mr-1.5" /> Batalkan Semua</>
                      ) : (
                         <><UserCheck className="w-3 h-3 mr-1.5" /> Check-in Semua Kursi</>
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
                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Kehadiran</div>
                 <div className="text-2xl font-bold text-white">
                   {bookings.filter(b => b.checkedIn).length} <span className="text-sm text-gray-500 font-normal">/ {bookings.length} Booking</span>
                 </div>
               </div>
               <div className="text-right">
                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kursi Terisi</div>
                 <div className="text-2xl font-bold text-amber-500">
                   {checkedInSeats.size} <span className="text-sm text-gray-500 font-normal">/ {bookedSeats.size} Seat</span>
                 </div>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Seat Map */}
        <div className="lg:col-span-2">
          <Card className="border-white/10 bg-white/5 min-h-[600px]">
            <CardContent className="p-6">
              
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <h3 className="font-bold text-white">Live Seat Map (Kehadiran)</h3>
                
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-white/5 border border-white/10 rounded-sm" /> Kosong
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-white/20 border border-gray-500 rounded-sm" /> Belum Hadir
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-amber-500 border border-amber-400 rounded-sm" /> Hadir
                  </div>
                </div>
              </div>

              {/* Screen Divider */}
              <div className="w-full border-t-[4px] border-white/10 mb-10 relative flex justify-center">
                <span className="absolute -top-3 text-[10px] bg-black px-4 font-bold text-gray-500 tracking-[0.3em] uppercase">S c r e e n</span>
                <div className="absolute top-0 w-1/2 h-24 bg-gradient-to-b from-white/5 to-transparent blur-xl pointer-events-none" />
              </div>

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
                                        : "bg-white/5 border border-white/10 text-gray-600"
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

            </CardContent>
          </Card>
        </div>
        
      </div>
    </div>
  );
}
