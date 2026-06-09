import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Ticket, LayoutDashboard, PlusCircle, Home, UserCheck } from 'lucide-react';
import { AppProvider } from './store/AppContext';
import { cn } from './utils';

import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import BookTickets from './pages/BookTickets';
import TicketDetail from './pages/TicketDetail';
import CheckIn from './pages/CheckIn';

// Pindahkan navItems ke luar agar bisa dipakai di Top Navbar dan Bottom Navbar
const NAV_ITEMS = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Book', path: '/book', icon: PlusCircle },
  { name: 'Check-in', path: '/check-in', icon: UserCheck },
];

function Navbar() {
  const location = useLocation();

  return (
    <nav className="h-16 border-b border-white/10 bg-[#0F0F0F] sticky top-0 z-50 shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          
          {/* LOGO - Menggunakan gambar asli dari folder public */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-3">
            <img 
              src="/logo-preview.png" 
              alt="Logo Cinematix Elite" 
              className="w-8 h-8 md:w-10 md:h-10 object-contain rounded-md"
            />
            {/* Hapus atau komentari span teks di bawah ini JIKA di dalam gambar logo-preview.png kamu sudah ada teks "Cinematix Elite"-nya */}
            <span className="text-xl md:text-2xl font-bold font-display tracking-widest text-white">
              Cinematix <span className="text-amber-500">Elite</span>
            </span>
          </Link>
          
          {/* MENU DESKTOP - Disembunyikan di HP (hidden md:flex) */}
          <div className="hidden md:flex space-x-8 text-sm font-medium h-full">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider transition-colors h-full",
                    isActive 
                      ? "text-amber-500 border-b-2 border-amber-500 mt-0.5" 
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

        </div>
      </div>
    </nav>
  );
}

// KOMPONEN BARU: Bottom Navigation khusus HP
function BottomNav() {
  const location = useLocation();
  
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-white/10 z-50 flex items-center justify-around px-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
              isActive ? "text-amber-500" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "scale-110 transition-transform")} />
            <span className="text-[9px] font-bold tracking-wider uppercase">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    // Tambahkan pb-16 (padding-bottom) di HP agar konten paling bawah tidak tertutup oleh Bottom Nav
    <div className="min-h-screen flex flex-col bg-[#0A0A0A] text-gray-200 font-sans pb-16 md:pb-0">
      <Navbar />
      
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {children}
      </main>

      <footer className="h-10 bg-black border-t border-white/5 flex items-center px-4 sm:px-8 justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[9px] text-green-500 flex items-center gap-1 tracking-widest font-bold">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> SYSTEM OPERATIONAL
          </span>
        </div>
        <div className="flex gap-4">
          <span className="text-[9px] text-gray-400 uppercase font-bold hidden sm:inline">&copy; 2026 Cinematix Elite</span>
          <span className="text-[9px] text-gray-400 uppercase font-bold">v1.2.4</span>
        </div>
      </footer>
      
      {/* Panggil BottomNav di sini */}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/book" element={<BookTickets />} />
            <Route path="/check-in" element={<CheckIn />} />
            <Route path="/ticket/:id" element={<TicketDetail />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}