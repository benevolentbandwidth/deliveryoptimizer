import Link from 'next/link';
import AddressGeocoder from './components/AddressGeocoder';

export default function Home() {
  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center gap-2">      
      <Link 
      href="/edit"
      className="h-11 px-6 rounded-full border border-zinc-300 bg-white text-black text-base font-normal hover:bg-zinc-400/30 transition-colors inline-flex items-center justify-center"
      >
      Edit
      </Link>
      <AddressGeocoder />

    </div>
  );
}