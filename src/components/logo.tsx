export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-devanagari text-lg font-bold tracking-tight ${className}`}>
      नुक्कड़ <span className="tracking-wide">NETWORK</span>
    </span>
  );
}
