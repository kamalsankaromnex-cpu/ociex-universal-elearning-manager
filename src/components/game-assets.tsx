import type { FC, SVGProps } from "react";

/** Vehicle / Daimler Truck Icon for Top Game Bar */
export const DaimlerVehicleIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="2" y="6" width="30" height="20" rx="3" fill="#38BDF8" fillOpacity="0.2" stroke="#38BDF8" strokeWidth="2" />
    <path d="M32 10H41L46 17V26H32V10Z" fill="#38BDF8" fillOpacity="0.3" stroke="#38BDF8" strokeWidth="2" />
    <circle cx="12" cy="26" r="4" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
    <circle cx="38" cy="26" r="4" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
    <rect x="7" y="10" width="8" height="6" rx="1" fill="#BAE6FD" />
    <rect x="18" y="10" width="8" height="6" rx="1" fill="#BAE6FD" />
    <path d="M35 12H39.5L42.5 17H35V12Z" fill="#BAE6FD" />
  </svg>
);

/** Illustrated Safety Character Trio (Engineer + Fox Mascot + Robot Drone) */
export const CharacterTrio: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 460 380" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="suitGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1E293B" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <linearGradient id="foxGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
      <linearGradient id="hardHat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FACC15" />
        <stop offset="100%" stopColor="#EAB308" />
      </linearGradient>
      <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
      <linearGradient id="droneGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#E2E8F0" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    {/* FOX MASCOT (Left) */}
    <g transform="translate(15, 120)">
      {/* Fox Tail */}
      <path d="M10 180 C-40 160 -50 90 -20 60 C-5 45 10 70 20 110 Z" fill="#2563EB" stroke="#1D4ED8" strokeWidth="3" />
      <path d="M-20 60 C-10 50 5 65 15 90 C-10 85 -25 75 -20 60 Z" fill="#FFFFFF" />

      {/* Fox Body */}
      <rect x="25" y="110" width="70" height="120" rx="20" fill="url(#suitGrad)" stroke="#334155" strokeWidth="2" />
      {/* High-Vis Vest stripes */}
      <rect x="25" y="130" width="70" height="14" fill="#FACC15" />
      <rect x="25" y="170" width="70" height="14" fill="#FACC15" />
      {/* Fox Legs & Boots */}
      <rect x="35" y="225" width="22" height="35" rx="5" fill="#1E293B" />
      <rect x="65" y="225" width="22" height="35" rx="5" fill="#1E293B" />
      <rect x="30" y="250" width="30" height="14" rx="4" fill="#0F172A" />
      <rect x="62" y="250" width="30" height="14" rx="4" fill="#0F172A" />

      {/* Fox Head */}
      <circle cx="60" cy="70" r="42" fill="url(#foxGrad)" />
      {/* Fox Ears */}
      <path d="M30 40 L20 -5 L55 25 Z" fill="#1D4ED8" stroke="#1E40AF" strokeWidth="2" />
      <path d="M28 32 L23 8 L46 24 Z" fill="#FDE047" />
      <path d="M90 40 L100 -5 L65 25 Z" fill="#1D4ED8" stroke="#1E40AF" strokeWidth="2" />
      <path d="M92 32 L97 8 L74 24 Z" fill="#FDE047" />
      {/* Fox White Muzzle & Cheeks */}
      <path d="M30 75 Q60 110 90 75 Q95 60 85 55 Q60 70 35 55 Q25 60 30 75 Z" fill="#FFFFFF" />
      <ellipse cx="60" cy="78" rx="8" ry="6" fill="#0F172A" />
      {/* Fox Eyes */}
      <ellipse cx="44" cy="58" rx="6" ry="8" fill="#0F172A" />
      <circle cx="42" cy="56" r="2.5" fill="#FFFFFF" />
      <ellipse cx="76" cy="58" rx="6" ry="8" fill="#0F172A" />
      <circle cx="74" cy="56" r="2.5" fill="#FFFFFF" />
      {/* Fox Smile */}
      <path d="M52 86 Q60 94 68 86" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
    </g>

    {/* HUMAN SAFETY OFFICER (Center) */}
    <g transform="translate(130, 40)">
      {/* Officer Body / Uniform */}
      <rect x="35" y="160" width="130" height="170" rx="25" fill="url(#suitGrad)" stroke="#334155" strokeWidth="3" />
      {/* High-Vis Suspenders / Bands */}
      <rect x="55" y="160" width="18" height="170" fill="#FACC15" />
      <rect x="127" y="160" width="18" height="170" fill="#FACC15" />
      <rect x="35" y="240" width="130" height="20" fill="#FACC15" />
      {/* Officer Belt & Buckle */}
      <rect x="35" y="275" width="130" height="22" fill="#0F172A" />
      <rect x="88" y="278" width="24" height="16" rx="2" fill="#94A3B8" />

      {/* Clipboard in Hand */}
      <g transform="translate(130, 210) rotate(-10)">
        <rect x="0" y="0" width="60" height="85" rx="5" fill="#78350F" stroke="#451A03" strokeWidth="2" />
        <rect x="6" y="12" width="48" height="66" rx="2" fill="#FEF3C7" />
        <rect x="20" y="-4" width="20" height="12" rx="2" fill="#CBD5E1" />
        <line x1="12" y1="24" x2="48" y2="24" stroke="#92400E" strokeWidth="2" />
        <line x1="12" y1="36" x2="48" y2="36" stroke="#92400E" strokeWidth="2" />
        <line x1="12" y1="48" x2="38" y2="48" stroke="#92400E" strokeWidth="2" />
      </g>

      {/* Officer Neck & Head */}
      <rect x="85" y="130" width="30" height="35" fill="url(#skin)" />
      <circle cx="100" cy="100" r="45" fill="url(#skin)" />

      {/* Beard & Moustache */}
      <path d="M72 105 Q100 150 128 105 Q120 135 100 138 Q80 135 72 105 Z" fill="#334155" />
      <path d="M80 108 Q100 122 120 108" stroke="#1E293B" strokeWidth="6" strokeLinecap="round" />

      {/* Glasses */}
      <rect x="68" y="86" width="26" height="18" rx="4" fill="none" stroke="#0F172A" strokeWidth="3" />
      <rect x="106" y="86" width="26" height="18" rx="4" fill="none" stroke="#0F172A" strokeWidth="3" />
      <line x1="94" y1="94" x2="106" y2="94" stroke="#0F172A" strokeWidth="3" />
      {/* Eyes */}
      <circle cx="81" cy="95" r="4" fill="#0F172A" />
      <circle cx="119" cy="95" r="4" fill="#0F172A" />

      {/* Yellow Safety Hard Hat */}
      <path d="M50 75 Q100 20 150 75 Z" fill="url(#hardHat)" stroke="#CA8A04" strokeWidth="3" />
      <ellipse cx="100" cy="74" rx="55" ry="12" fill="#EAB308" stroke="#CA8A04" strokeWidth="2" />
      {/* Daimler Truck Logo on Helmet */}
      <rect x="75" y="48" width="50" height="14" rx="2" fill="#0F172A" />
      <text x="100" y="58" fill="#F8FAFC" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">DAIMLER TRUCK</text>
    </g>

    {/* FLOATING ROBOT DRONE (Top Right) */}
    <g transform="translate(320, 70)">
      {/* Golden Halo Ring */}
      <ellipse cx="50" cy="15" rx="35" ry="9" fill="none" stroke="#FACC15" strokeWidth="4" filter="url(#glow)" />
      {/* Propeller Mount */}
      <line x1="50" y1="20" x2="50" y2="35" stroke="#94A3B8" strokeWidth="3" />

      {/* Drone Body (Egg shaped sphere) */}
      <ellipse cx="50" cy="70" rx="42" ry="38" fill="url(#droneGrad)" stroke="#CBD5E1" strokeWidth="3" />
      {/* Cyan Face Screen */}
      <ellipse cx="50" cy="70" rx="32" ry="24" fill="#0F172A" />
      {/* Cute Cyan LED Happy Eyes */}
      <path d="M35 70 Q42 62 48 70" fill="none" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" filter="url(#glow)" />
      <path d="M54 70 Q60 62 67 70" fill="none" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" filter="url(#glow)" />

      {/* Thruster Jets / Lower Pod */}
      <ellipse cx="50" cy="110" rx="14" ry="5" fill="#38BDF8" filter="url(#glow)" />
      <rect x="42" y="104" width="16" height="8" rx="2" fill="#64748B" />
    </g>
  </svg>
);

/** Scenario Illustration: Machine Guard Enclosure with Warning Hazard */
export const ScenarioMachineGuardImage: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 520 280" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>
      <linearGradient id="guardYellow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FACC15" />
        <stop offset="100%" stopColor="#CA8A04" />
      </linearGradient>
    </defs>
    {/* Factory Background */}
    <rect width="520" height="280" rx="12" fill="url(#wall)" />
    {/* Floor Grid */}
    <path d="M0 220 L520 220 M100 220 L40 280 M200 220 L160 280 M320 220 L300 280 M440 220 L440 280" stroke="#475569" strokeWidth="2" />
    {/* Industrial Machine Base */}
    <rect x="70" y="40" width="220" height="190" rx="8" fill="#1E293B" stroke="#64748B" strokeWidth="3" />
    {/* Yellow Safety Interlock Guard Enclosure */}
    <rect x="90" y="55" width="180" height="160" rx="6" fill="none" stroke="url(#guardYellow)" strokeWidth="12" />
    {/* Mesh Screen */}
    <g opacity="0.35" stroke="#FACC15" strokeWidth="2">
      <line x1="105" y1="65" x2="105" y2="205" />
      <line x1="125" y1="65" x2="125" y2="205" />
      <line x1="145" y1="65" x2="145" y2="205" />
      <line x1="165" y1="65" x2="165" y2="205" />
      <line x1="185" y1="65" x2="185" y2="205" />
      <line x1="205" y1="65" x2="205" y2="205" />
      <line x1="225" y1="65" x2="225" y2="205" />
      <line x1="245" y1="65" x2="245" y2="205" />
      <line x1="95" y1="90" x2="265" y2="90" />
      <line x1="95" y1="120" x2="265" y2="120" />
      <line x1="95" y1="150" x2="265" y2="150" />
      <line x1="95" y1="180" x2="265" y2="180" />
    </g>
    {/* Warning Triangle Hazard Plaque */}
    <g transform="translate(150, 100)">
      <polygon points="30,5 58,52 2,52" fill="#FACC15" stroke="#0F172A" strokeWidth="4" />
      <text x="30" y="44" fill="#0F172A" fontSize="30" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">!</text>
    </g>
    {/* Worker Interacting with Machine */}
    <g transform="translate(340, 60)">
      <rect x="30" y="100" width="70" height="100" rx="12" fill="#1E3A8A" />
      <rect x="42" y="70" width="46" height="35" rx="6" fill="#FDE68A" />
      {/* Yellow Helmet */}
      <path d="M38 72 Q65 40 92 72 Z" fill="#FACC15" />
      {/* Arms reaching */}
      <path d="M30 115 L-15 130" stroke="#1E3A8A" strokeWidth="16" strokeLinecap="round" />
      {/* Red Alert Warning Pulse */}
      <path d="M-25 105 L-35 95 M-25 125 L-40 125 M-25 145 L-35 155" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
    </g>
  </svg>
);

/** Scenario Illustration: Assembly Line / Robotic Arm */
export const ScenarioAssemblyLineImage: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 520 280" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="520" height="280" rx="12" fill="#1E293B" />
    {/* Conveyor Belt */}
    <rect x="50" y="190" width="420" height="24" rx="4" fill="#475569" stroke="#64748B" strokeWidth="2" />
    <circle cx="80" cy="202" r="6" fill="#94A3B8" />
    <circle cx="160" cy="202" r="6" fill="#94A3B8" />
    <circle cx="240" cy="202" r="6" fill="#94A3B8" />
    <circle cx="320" cy="202" r="6" fill="#94A3B8" />
    <circle cx="400" cy="202" r="6" fill="#94A3B8" />
    {/* Vehicle Chassis on Line */}
    <path d="M120 190 H280 L270 145 H190 L160 145 L130 165 Z" fill="#38BDF8" fillOpacity="0.4" stroke="#38BDF8" strokeWidth="3" />
    {/* Robot Arm */}
    <rect x="70" y="80" width="25" height="110" rx="4" fill="#FACC15" stroke="#CA8A04" strokeWidth="2" />
    <line x1="82" y1="80" x2="160" y2="40" stroke="#FACC15" strokeWidth="14" strokeLinecap="round" />
    <line x1="160" y1="40" x2="210" y2="110" stroke="#FACC15" strokeWidth="12" strokeLinecap="round" />
    <circle cx="160" cy="40" r="10" fill="#0F172A" />
    <circle cx="210" cy="110" r="8" fill="#0F172A" />
    {/* Warning Sign */}
    <g transform="translate(350, 110)">
      <polygon points="35,10 65,65 5,65" fill="#FACC15" stroke="#0F172A" strokeWidth="4" />
      <text x="35" y="56" fill="#0F172A" fontSize="34" fontWeight="bold" textAnchor="middle">!</text>
    </g>
  </svg>
);

/** Answer Card Icons */
export const IconInjury: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="6" y="6" width="20" height="20" rx="5" fill="#FEE2E2" stroke="#EF4444" strokeWidth="2" />
    <line x1="16" y1="11" x2="16" y2="21" stroke="#EF4444" strokeWidth="3" />
    <line x1="11" y1="16" x2="21" y2="16" stroke="#EF4444" strokeWidth="3" />
  </svg>
);

export const IconDamage: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="16" cy="16" r="6" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2" />
    <path d="M16 2v4M16 26v4M2 16h4M26 16h4M6.1 6.1l2.8 2.8M23.1 23.1l2.8 2.8M6.1 25.9l2.8-2.8M23.1 8.9l2.8-2.8" stroke="#0284C7" strokeWidth="2.5" />
  </svg>
);

export const IconProduction: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 26V13l8 5V13l8 5V7l8 5v14H4z" fill="#F1F5F9" stroke="#475569" strokeWidth="2" />
    <line x1="22" y1="10" x2="28" y2="16" stroke="#DC2626" strokeWidth="3" />
    <line x1="28" y1="10" x2="22" y2="16" stroke="#DC2626" strokeWidth="3" />
  </svg>
);

export const IconEnvironment: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M26 6C16 6 8 13 8 23c7 0 16-3 18-17z" fill="#DCFCE7" stroke="#16A34A" strokeWidth="2" />
    <path d="M8 23C12 17 19 12 26 6" stroke="#16A34A" strokeWidth="2" />
  </svg>
);

export const IconFinancial: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <ellipse cx="16" cy="10" rx="9" ry="4" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
    <path d="M7 10v6c0 2.2 4 4 9 4s9-1.8 9-4v-6" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
    <path d="M7 16v6c0 2.2 4 4 9 4s9-1.8 9-4v-6" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" />
  </svg>
);

export const IconApexCommittee: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="16" cy="10" r="4" fill="#DBEAFE" stroke="#1D4ED8" strokeWidth="2" />
    <path d="M8 24c0-4 4-6 8-6s8 2 8 6" fill="#DBEAFE" stroke="#1D4ED8" strokeWidth="2" />
    <circle cx="7" cy="12" r="3" stroke="#64748B" strokeWidth="1.5" />
    <circle cx="25" cy="12" r="3" stroke="#64748B" strokeWidth="1.5" />
  </svg>
);

export const IconSubCommittee: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="16" cy="8" r="3" fill="#E0E7FF" stroke="#4338CA" strokeWidth="2" />
    <line x1="16" y1="11" x2="16" y2="18" stroke="#4338CA" strokeWidth="2" />
    <line x1="9" y1="18" x2="23" y2="18" stroke="#4338CA" strokeWidth="2" />
    <circle cx="9" cy="23" r="3" fill="#E0E7FF" stroke="#4338CA" strokeWidth="2" />
    <circle cx="23" cy="23" r="3" fill="#E0E7FF" stroke="#4338CA" strokeWidth="2" />
  </svg>
);

export const IconAdHoc: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="16" cy="16" r="5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="2" />
    <path d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2.2 2.2M22.3 22.3l2.2 2.2M7.5 24.5l2.2-2.2M22.3 9.7l2.2-2.2" stroke="#CA8A04" strokeWidth="2" />
  </svg>
);
