import React, { createContext, useContext, useState, useEffect } from 'react';

export type SeatType = 'Reguler - Depan' | 'Reguler - Tengah' | 'Reguler - Belakang' | 'VIP';

export interface TicketBooking {
  id: string;
  buyerName: string;
  seatType: SeatType;
  seatNumbers: string[]; 
  totalPrice: number;
  totalCost: number;
  paymentMethod: 'Cash' | 'Transfer Bank';
  paymentTenor: 'Lunas' | 'DP (Maks 2x)';
  paymentProofUrl?: string;
  marketingName: string;
  notes: string;
  verified: boolean;
  checkedIn?: boolean;
  checkedInSeats?: string[];
  createdAt: string;
  purchaseDate?: string;
  settlementDate?: string;
  subtitleLanguage: string;
}

export const PRICING = {
  'Reguler - Belakang': { price: 500000, cost: 150000, capacity: 52, rows: 2, cols: 26, prefix: 'RB', rowLetters: ['A', 'B'] },
  'Reguler - Tengah': { price: 750000, cost: 150000, capacity: 182, rows: 7, cols: 26, prefix: 'RT', rowLetters: ['C', 'D', 'E', 'F', 'G', 'H', 'I'] },
  'Reguler - Depan': { price: 250000, cost: 150000, capacity: 96, rows: 3, cols: 32, prefix: 'RD', rowLetters: ['K', 'L', 'M'] },
  'VIP': { price: 2500000, cost: 600000, capacity: 60, rows: 3, cols: 20, prefix: 'V', rowLetters: ['A', 'B', 'C'] }
};

interface AppState {
  bookings: TicketBooking[];
  addBooking: (booking: Omit<TicketBooking, 'id' | 'createdAt'>) => void;
  updateBooking: (id: string, updates: Partial<TicketBooking>) => void;
  deleteBooking: (id: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<TicketBooking[]>(() => {
    const saved = localStorage.getItem('cinepolis_bookings');
    return saved ? JSON.parse(saved) : [];
  });
  const [language, setLanguage] = useState('ID');

  useEffect(() => {
    localStorage.setItem('cinepolis_bookings', JSON.stringify(bookings));
  }, [bookings]);

  const addBooking = (bookingData: Omit<TicketBooking, 'id' | 'createdAt'>) => {
    const newBooking: TicketBooking = {
      ...bookingData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    setBookings(prev => [...prev, newBooking]);
  };

  const updateBooking = (id: string, updates: Partial<TicketBooking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBooking = (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  return (
    <AppContext.Provider value={{ bookings, addBooking, updateBooking, deleteBooking, language, setLanguage }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
