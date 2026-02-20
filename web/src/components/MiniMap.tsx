'use client';

import { Bot, Meeting } from '@/lib/types';
import { WORLD_WIDTH, WORLD_HEIGHT, ZONES, INTENT_CONFIG } from '@/lib/constants';

interface MiniMapProps {
  bots: Bot[];
  meetings: Meeting[];
  camera?: { x: number; y: number; zoom: number; viewWidth: number; viewHeight: number };
}

const MAP_W = 220;
const MAP_H = 165;

export function MiniMap({ bots, meetings, camera }: MiniMapProps) {
  const scaleX = MAP_W / WORLD_WIDTH;
  const scaleY = MAP_H / WORLD_HEIGHT;

  return (
    <div className="absolute bottom-16 right-4 z-30">
      <div className="bg-[#1a1a2e]/90 backdrop-blur-sm border border-[#3a3a5e] rounded-lg overflow-hidden shadow-2xl p-1.5">
        <div className="relative rounded" style={{ width: MAP_W, height: MAP_H, background: '#4a8f34' }}>
          <svg width={MAP_W} height={MAP_H} className="absolute inset-0">
            {/* River approximation */}
            <rect x={MAP_W * 0.60} y={0} width={MAP_W * 0.04} height={MAP_H} fill="#4a8ecf" fillOpacity={0.7} rx={1} />

            {/* Zone regions */}
            {ZONES.map(zone => {
              const zoneColors: Record<string, string> = {
                'town-square': '#a09888',
                'market-street': '#9b8365',
                'job-board': '#8d6c4e',
                'cafe': '#68ab48',
                'arena': '#d4c090',
                'library': '#b8b0c8',
                'workshop': '#9b8360',
                'garden': '#7ac868',
              };
              return (
                <rect
                  key={zone.id}
                  x={zone.bounds.x * scaleX}
                  y={zone.bounds.y * scaleY}
                  width={zone.bounds.width * scaleX}
                  height={zone.bounds.height * scaleY}
                  fill={zoneColors[zone.id] || zone.color}
                  fillOpacity={0.6}
                  rx={2}
                  stroke={zone.color}
                  strokeOpacity={0.5}
                  strokeWidth={1}
                />
              );
            })}

            {/* Meeting indicators */}
            {meetings.map(m => (
              <circle
                key={m.id}
                cx={m.position.x * scaleX}
                cy={m.position.y * scaleY}
                r={3}
                fill="#fbbf24"
                fillOpacity={0.8}
              >
                <animate
                  attributeName="r"
                  values="2;4;2"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
            ))}

            {/* Bot dots */}
            {bots.map(bot => (
              <circle
                key={bot.id}
                cx={bot.position.x * scaleX}
                cy={bot.position.y * scaleY}
                r={1.5}
                fill={INTENT_CONFIG[bot.intent as keyof typeof INTENT_CONFIG]?.color ?? '#888888'}
                fillOpacity={bot.state === 'meeting' ? 1 : 0.8}
              />
            ))}

            {/* Camera viewport indicator */}
            {camera && camera.viewWidth > 0 && (() => {
              const vw = (camera.viewWidth / camera.zoom) * scaleX;
              const vh = (camera.viewHeight / camera.zoom) * scaleY;
              const vx = camera.x * scaleX;
              const vy = camera.y * scaleY;
              return (
                <rect
                  x={vx}
                  y={vy}
                  width={Math.min(vw, MAP_W)}
                  height={Math.min(vh, MAP_H)}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                  rx={1}
                />
              );
            })()}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-1 pt-1 border-t border-white/5">
          {Object.entries(INTENT_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
              <span className="text-white/40 text-[8px] uppercase tracking-wider">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
