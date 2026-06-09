import fs from 'fs';

const files = [
  'src/pages/HomePage.tsx', 
  'src/pages/Dashboard.tsx', 
  'src/pages/BookTickets.tsx', 
  'src/pages/TicketDetail.tsx',
  'src/App.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/slate-950/g, 'black');
  content = content.replace(/slate-900/g, 'white/5');
  content = content.replace(/slate-800/g, 'white/10');
  content = content.replace(/slate-700/g, 'white/20');
  content = content.replace(/slate-600/g, 'gray-600');
  content = content.replace(/slate-500/g, 'gray-500');
  content = content.replace(/slate-400/g, 'gray-400');
  content = content.replace(/slate-300/g, 'gray-300');
  content = content.replace(/slate-200/g, 'gray-200');
  content = content.replace(/slate-100/g, 'gray-100');
  content = content.replace(/yellow-/g, 'amber-');
  content = content.replace(/glass-panel/g, 'bg-white/5 border border-white/10');
  fs.writeFileSync(file, content);
}
