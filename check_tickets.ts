import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('tickets').select('*');
  if (error) {
    console.error("Error fetching tickets:", error.message);
    return;
  }
  console.log(`Found ${data.length} tickets:`);
  data.forEach((t, i) => {
    console.log(`[${i}] ID: ${t.id}, Buyer: ${t.buyer_name}, Seat Type: ${t.seat_type}, Seats: ${t.seat_numbers}, Total: ${t.total_price}, Verified: ${t.is_verified}`);
  });
}

check();
