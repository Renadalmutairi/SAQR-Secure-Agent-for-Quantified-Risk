import React from "react";

interface SaqrLogoProps {
  className?: string;
  isDarkMode?: boolean;
}

export function SaqrLogoIcon({ className = "w-10 h-10", isDarkMode = false }: SaqrLogoProps) {
  return (
    <svg 
      viewBox="0 0 500 250" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Rich Bronze/Copper Metallic Gradient */}
        <linearGradient id="saqr-bronze" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#8A4A24" />
          <stop offset="35%" stopColor="#C88B60" />
          <stop offset="65%" stopColor="#DCA884" />
          <stop offset="100%" stopColor="#6C3315" />
        </linearGradient>
        
        {/* Secondary softer sand gradient for overlapping wings */}
        <linearGradient id="saqr-sand" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9B5D37" />
          <stop offset="50%" stopColor="#E4BA9B" />
          <stop offset="100%" stopColor="#B37851" />
        </linearGradient>
      </defs>

      {/* --- FALCON HEAD & LETTERS "SAQR" SYMBOL --- */}
      <g>
        {/* Falcon Head Profile facing Left - merges into S shape */}
        <path 
          d="M 120 160 
             C 105 160, 95 152, 95 138 
             C 95 118, 115 105, 140 105 
             C 143 105, 150 106, 155 108
             C 145 100, 130 95, 115 95 
             C 70 95, 45 120, 45 145 
             C 45 170, 75 185, 115 185 
             L 155 185 
             C 155 185, 135 160, 120 160 Z" 
          fill="url(#saqr-bronze)" 
        />
        
        {/* Falcon Beak & Eye details */}
        <path 
          d="M 45 145 
             C 30 145, 15 155, 10 165 
             C 8 168, 12 170, 15 168 
             C 25 160, 38 158, 45 158 
             Z" 
          fill="url(#saqr-bronze)" 
        />
        
        {/* Eye Cutout Slit */}
        <path 
          d="M 52 138 
             C 58 135, 65 135, 70 139 
             C 64 142, 56 142, 52 138 Z" 
          fill={isDarkMode ? "#111317" : "#ffffff"} 
        />

        {/* Dynamic Sweeping Crests (Upper Wing/Feathers) */}
        <path 
          d="M 160 185 
             C 210 150, 275 80, 375 50 
             C 325 100, 270 145, 230 165 
             Z" 
          fill="url(#saqr-bronze)" 
        />

        <path 
          d="M 215 170 
             C 250 140, 310 95, 370 75 
             C 325 110, 275 150, 245 165 
             Z" 
          fill="url(#saqr-sand)" 
          opacity="0.9"
        />

        {/* 'A' Glyph - stylized triangular slice */}
        <path 
          d="M 235 185 
             L 265 135 
             L 295 185 
             L 275 185 
             L 265 160 
             L 255 185 
             Z" 
          fill="url(#saqr-bronze)" 
        />
        {/* A Inner Triangle Cutout */}
        <polygon 
          points="265,148 259,165 271,165" 
          fill={isDarkMode ? "#111317" : "#ffffff"} 
        />

        {/* 'Q' Glyph - stylized oval with an offset tail */}
        <path 
          d="M 335 135 
             C 305 135, 290 150, 290 165 
             C 290 180, 305 190, 335 190 
             C 350 190, 365 182, 368 172
             L 380 185
             L 392 185
             L 373 166
             C 375 155, 365 135, 335 135 Z
             M 335 148 
             C 350 148, 355 158, 355 162 
             C 355 168, 348 177, 335 177 
             C 322 177, 312 168, 312 162 
             C 312 155, 322 148, 335 148 Z" 
          fill="url(#saqr-bronze)" 
        />

        {/* 'R' Glyph - dynamic high-end modern R */}
        <path 
          d="M 390 135 
             L 390 185 
             L 406 185 
             L 406 165 
             L 420 165 
             L 435 185 
             L 452 185 
             L 434 160 
             C 445 158, 452 150, 452 144 
             C 452 138, 442 135, 420 135 
             Z
             M 406 145 
             L 418 145 
             C 428 145, 434 148, 434 153 
             C 434 158, 428 160, 418 160 
             L 406 160 Z" 
          fill="url(#saqr-bronze)" 
        />
      </g>
    </svg>
  );
}

export function SaqrFullLogo({ className = "w-full max-w-md", isDarkMode = false }: SaqrLogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-4 select-none ${className}`} dir="rtl">
      {/* Dynamic Emblem */}
      <SaqrLogoIcon className="w-56 h-auto transition-transform hover:scale-105 duration-300" isDarkMode={isDarkMode} />
      
      {/* Modern Arabic Calligraphy representation of "صقر" with dynamic lines */}
      <div className="mt-1 flex items-center gap-3 justify-center w-full">
        <div className={`h-[1px] w-12 ${isDarkMode ? "bg-slate-700" : "bg-slate-300"}`}></div>
        <span 
          className="text-3xl font-black tracking-widest px-2"
          style={{ 
            fontFamily: "system-ui, sans-serif",
            background: "linear-gradient(135deg, #A35C37 0%, #D99E73 50%, #783E1E 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "0.15em"
          }}
        >
          صــقــر
        </span>
        <div className={`h-[1px] w-12 ${isDarkMode ? "bg-slate-700" : "bg-slate-300"}`}></div>
      </div>

      {/* Primary Arabic Subtitle */}
      <h2 className={`text-xs md:text-sm font-bold mt-2.5 tracking-wide ${isDarkMode ? "text-gray-200" : "text-slate-700"}`}>
        منصة الذكاء المالي المتكاملة لمكافحة الاحتيال وغسل الأموال
      </h2>

      {/* Professional English Brand Tagline */}
      <p className="text-[9px] md:text-[10px] font-mono tracking-widest uppercase mt-1 text-amber-600/80 font-bold dark:text-amber-500/80">
        SAQR. SECURE AGENT FOR QUANTIFIED RISK
      </p>
    </div>
  );
}
