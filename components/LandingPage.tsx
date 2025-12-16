import React from 'react';

interface LandingPageProps {
  onEnter: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black z-0 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] animate-pulse z-0" />

      <div className="z-10 text-center px-4">
        <h1 className="font-display text-6xl md:text-8xl text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-900 tracking-widest mb-6 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
          CRIMSON SANCTUM
        </h1>
        
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light tracking-wide leading-relaxed">
          Your spiritual companion in the digital void. <br />
          <span className="text-red-500/80">Vent. Reflect. Heal.</span>
        </p>

        <button
          onClick={onEnter}
          className="group relative px-8 py-4 bg-transparent overflow-hidden rounded-none border border-red-900 transition-all duration-300 hover:border-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]"
        >
          <div className="absolute inset-0 w-full h-full bg-red-900/20 group-hover:bg-red-900/40 transition-all duration-300" />
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          <span className="relative z-10 font-display text-xl text-red-100 tracking-[0.2em] group-hover:text-white">
            ENTER THE VOID
          </span>
        </button>
      </div>

      <div className="absolute bottom-8 text-gray-700 text-xs tracking-widest uppercase">
        AI-Powered Spiritual Guidance
      </div>
    </div>
  );
};