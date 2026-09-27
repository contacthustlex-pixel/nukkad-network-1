export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-devanagari text-lg font-bold tracking-tight text-brand-blue ${className}`}>
      नुक्कड़ <span className="text-brand-yellow">NETWORK</span>
    </span>
  );
}
