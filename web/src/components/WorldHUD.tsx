'use client';

interface WorldHUDProps {
  botCount: number;
  meetingCount: number;
}

export function WorldHUD({ botCount, meetingCount }: WorldHUDProps) {
  return (
    <>
      {/* Top-left: Logo + title */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-3">
        <div className="flex items-center gap-2.5 bg-[#1a1a2e]/90 backdrop-blur-sm border border-[#3a3a5e] rounded-lg px-3 py-2 shadow-xl">
          <div className="relative">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md" style={{ imageRendering: 'pixelated' }}>
              <span className="text-[10px] font-black text-black tracking-tight">CW</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#1a1a2e]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xs tracking-tight leading-none" style={{ fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '8px' }}>CLAWBOT WORLD</h1>
            <p className="text-emerald-400/60 text-[8px] font-mono mt-0.5">LIVE</p>
          </div>
        </div>
      </div>

      {/* Top-right: Stats */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
        <div className="bg-[#1a1a2e]/90 backdrop-blur-sm border border-[#3a3a5e] rounded-lg px-3 py-2 flex items-center gap-3 shadow-xl">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-[10px] font-mono font-bold">{botCount}</span>
            <span className="text-white/30 text-[10px]">bots</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400 text-[10px] font-mono font-bold">{meetingCount}</span>
            <span className="text-white/30 text-[10px]">meets</span>
          </div>
        </div>
      </div>

      {/* Bottom-center: Controls hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30">
        <div className="bg-[#1a1a2e]/70 backdrop-blur-sm border border-[#3a3a5e]/50 rounded-md px-3 py-1 flex items-center gap-3">
          <span className="text-white/25 text-[9px] font-mono">DRAG pan</span>
          <span className="text-white/10">|</span>
          <span className="text-white/25 text-[9px] font-mono">SCROLL zoom</span>
          <span className="text-white/10">|</span>
          <span className="text-white/25 text-[9px] font-mono">CLICK bot</span>
        </div>
      </div>
    </>
  );
}
