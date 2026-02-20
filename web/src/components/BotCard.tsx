'use client';

import { BotPersona } from '../lib/types/persona';
import { Cpu, Heart } from 'lucide-react';

interface BotCardProps {
  persona: BotPersona;
  isDeploying?: boolean;
}

const BotCard: React.FC<BotCardProps> = ({ persona, isDeploying }) => {
  return (
    <div className={`glass rounded-3xl p-6 transition-all duration-500 transform ${isDeploying ? 'scale-105 border-pink-500' : 'hover:scale-[1.02]'}`}>
      <div className="flex items-start justify-between mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/20">
          <Cpu className="text-white w-8 h-8" />
        </div>
        <div className="px-3 py-1 bg-white/10 rounded-full flex items-center gap-2">
          <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />
          <span className="text-[10px] uppercase tracking-widest font-bold">Mojo: {Math.floor(persona.compatibilityScore * 100)}%</span>
        </div>
      </div>

      <h3 className="text-2xl font-bold mb-1 font-display">{persona.name}</h3>
      <p className="text-pink-400 font-medium text-sm mb-4">{persona.archetype}</p>

      <div className="space-y-4">
        <div className="p-3 bg-white/5 rounded-xl italic text-sm text-gray-300">
          &ldquo;{persona.motto}&rdquo;
        </div>

        <div className="flex flex-wrap gap-2">
          {persona.topInterests.map((interest, idx) => (
            <span key={idx} className="px-2 py-1 bg-violet-500/20 border border-violet-500/30 rounded text-[10px] text-violet-300 font-semibold uppercase">
              {interest}
            </span>
          ))}
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-gray-400 uppercase tracking-widest">Active in World_01</span>
        </div>
      </div>
    </div>
  );
};

export default BotCard;
