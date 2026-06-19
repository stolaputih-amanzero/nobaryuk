import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, ExternalLink, Bell, Film } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Link } from 'react-router-dom';
import { differenceInSeconds } from 'date-fns';
import { supabase } from '../supabaseClient'; 

interface Movie {
  title: string;
  synopsis: string;
  poster_url: string;
}

export default function HomePage() {
  const showTime = new Date('2026-07-11T13:00:00+07:00');
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  
  const [movie, setMovie] = useState<Movie | null>(null);

  useEffect(() => {
    const fetchMovie = async () => {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .single(); 

      if (error) {
        console.error("Gagal mengambil data film:", error);
      } else {
        setMovie(data);
      }
    };

    fetchMovie();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = differenceInSeconds(showTime, new Date());
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        clearInterval(timer);
      } else {
        setTimeLeft({
          d: Math.floor(diff / (24 * 3600)),
          h: Math.floor((diff % (24 * 3600)) / 3600),
          m: Math.floor((diff % 3600) / 60),
          s: diff % 60,
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-12 pb-12 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Hero Section */}
      <section className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 min-h-[400px]">
        <div className="absolute inset-0 bg-black">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-[#0A0A0A]/80 to-transparent z-10" />
          <img 
            src="/background.png" 
            alt={movie?.title || "Cinema Hero"} 
            className="w-full h-full object-cover opacity-100 grayscale hover:grayscale-0 transition-all duration-700"
          />
        </div>
        
        {/* PERBAIKAN: Menambahkan pt-20 di HP agar teks turun dan tidak terpotong ke atas */}
        <div className="relative z-20 px-6 py-12 pt-24 md:pt-16 md:px-12 flex flex-col justify-end h-full min-h-[400px]">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider mb-4 md:mb-6 w-max">
            <Film className="w-4 h-4" />
            <span>Nonton Bareng GPI 2026</span>
          </div>
          
          {/* PERBAIKAN: Menurunkan ukuran font di HP (text-4xl) agar tidak memicu pemotongan baris (clipping) */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-3 md:mb-4 leading-tight break-words">
            Children of Heaven <span className="text-2xl md:text-4xl text-gray-300 font-normal whitespace-nowrap">(2026)</span>
          </h1>
          
          <p className="text-sm md:text-base text-gray-400 max-w-2xl mb-6 md:mb-8">
            {movie ? movie.synopsis : "Memuat sinopsis film dari database..."}
          </p>
          
          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
            <Link to="/book" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-10 px-8 text-xs rounded-full bg-amber-500 text-black animate-btn-flash">
                Booking Tiket
              </Button>
            </Link>
            <a href="https://id.wikipedia.org/wiki/Children_of_Heaven" target="_blank" rel="noreferrer" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-10 px-6 rounded-full uppercase tracking-wider text-[10px] border-white/20">
                <ExternalLink className="w-4 h-4 mr-2" /> Detail Film
              </Button>
            </a>
          </div>

          {/* Running Text */}
          <div className="mt-6 overflow-hidden w-full max-w-2xl bg-amber-500/5 rounded-full border border-amber-500/20 py-2 text-amber-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest font-display backdrop-blur-sm">
            <div className="animate-marquee-container flex gap-8">
              <div className="flex gap-8 shrink-0">
                <span>🎟️ Klik tombol di atas untuk memulai booking tiket nonton bareng sekarang juga!</span>
                <span>•</span>
                <span>Amankan kursi terbaik Anda sebelum kehabisan!</span>
                <span>•</span>
                <span>Nobar Children of Heaven 2026</span>
                <span>•</span>
              </div>
              <div className="flex gap-8 shrink-0">
                <span>🎟️ Klik tombol di atas untuk memulai booking tiket nonton bareng sekarang juga!</span>
                <span>•</span>
                <span>Amankan kursi terbaik Anda sebelum kehabisan!</span>
                <span>•</span>
                <span>Nobar Children of Heaven 2026</span>
                <span>•</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Countdown and Event Details */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 overflow-hidden relative">
          <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full" />
          <CardContent className="p-8">
            <h3 className="font-display font-semibold text-2xl mb-6 text-white flex items-center gap-2">
              <Clock className="text-amber-500" /> Countdown to Premiere
            </h3>
            {timeLeft ? (
              <div className="grid grid-cols-4 gap-2 md:gap-4 text-center">
                {[
                  { label: "Hari", value: timeLeft.d },
                  { label: "Jam", value: timeLeft.h },
                  { label: "Menit", value: timeLeft.m },
                  { label: "Detik", value: timeLeft.s },
                ].map((item, idx) => (
                  <div key={idx} className="bg-black/50 border border-white/10 rounded-xl p-3 md:p-6 backdrop-blur-sm">
                    <div className="text-2xl md:text-5xl font-bold text-amber-500 font-display mb-1 md:mb-2">{item.value.toString().padStart(2, '0')}</div>
                    <div className="text-[10px] md:text-sm text-gray-400 font-medium uppercase tracking-wider">{item.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-500">Memuat countdown...</div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-center bg-white/5 border-amber-500/20">
          <CardContent className="p-8 space-y-6">
            <div>
              <div className="text-sm text-gray-400 font-medium mb-1">Tanggal Tayang</div>
              <div className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" /> Sabtu, 11 Juli 2026
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 font-medium mb-1">Waktu</div>
              <div className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" /> 13:00 WIB
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 font-medium mb-1">Lokasi Venue</div>
              <div className="text-lg font-semibold text-white flex items-start gap-2">
                <MapPin className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" /> 
                <span>Cinema 1 Cinepolis<br/><span className="text-sm text-gray-400">Lt. 1 - Senayan Park, Jakarta</span></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Preparation Guidelines */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-3xl font-display font-semibold mb-6 flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </span>
            Panduan Klaim Tiket
          </h2>
          <div className="space-y-4">
            {[
              "Pastikan barcode tiket PDF/JPG sudah diunduh di perangkat Anda sebelum tiba di venue.",
              "Datang selambat-lambatnya 15 menit sebelum jam tayang (Pukul 12:45 WIB).",
              "Tunjukkan barcode tiket digital Anda kepada panitia di meja registrasi Cinepolis Cinema 1.",
              "Pastikan nama dan nomor seat pada tiket digital sesuai.",
            ].map((text, i) => (
               <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                 <div className="w-8 h-8 rounded-full bg-white/10 text-gray-300 flex items-center justify-center font-bold text-sm shrink-0">
                   {i+1}
                 </div>
                 <p className="text-gray-300 text-sm leading-relaxed">{text}</p>
               </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-display font-semibold mb-6">Rundown Acara</h2>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 px-8 relative overflow-hidden">
            <div className="absolute left-10 top-8 bottom-8 w-px bg-white/10" />
            <div className="space-y-8 relative">
              {[
                { time: "12:00 - 13:00", title: "Registrasi & Klaim Tiket", desc: "Klaim tiket fisik dan pembagian Nobar Snack Pack." },
                { time: "12:00 - 13:00", title: "Makan Siang Buffet", desc: "Khusus untuk tamu dengan tiket VIP." },
                { time: "13:00 - 13:20", title: "Pintu Cinema Dibuka & Seremoni", desc: "Penonton memasuki Cinema 1, penayangan video sponsor, seremoni pembukaan, dan sesi foto bersama." },
                { time: "13:20 - 15:00", title: "Penayangan Film & Penutupan", desc: "Pemutaran Children of Heaven (Subtitle ID), penutupan dan ucapan terimakasih." },
              ].map((item, i) => (
                <div key={i} className="flex gap-6 relative">
                  <div className="w-4 h-4 rounded-full bg-amber-500 ring-4 ring-black mt-1 shrink-0 z-10" />
                  <div>
                    <div className="text-sm font-bold text-amber-500 mb-1">{item.time}</div>
                    <div className="font-semibold text-white mb-1">{item.title}</div>
                    <div className="text-sm text-gray-400">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}