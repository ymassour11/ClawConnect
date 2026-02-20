'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application } from 'pixi.js';
import { WorldSimulation } from '@/lib/simulation';
import { WorldRenderer } from '@/lib/renderer';
import { Bot, Meeting } from '@/lib/types';
import { BotInfoPanel } from './BotInfoPanel';
import { WorldHUD } from './WorldHUD';
import { MiniMap } from './MiniMap';
import { ChatStream, type ChatEntry } from './ChatStream';

export function WorldCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const simRef = useRef<WorldSimulation | null>(null);
  const rafRef = useRef<number>(0);

  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [activeMeetings, setActiveMeetings] = useState<Meeting[]>([]);
  const [botCount, setBotCount] = useState(0);
  const [meetingCount, setMeetingCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [cameraState, setCameraState] = useState({ x: 0, y: 0, zoom: 0.45, viewWidth: 0, viewHeight: 0 });
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);

  const initWorld = useCallback(async () => {
    if (!containerRef.current || appRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create Pixi app
    const app = new Application();
    await app.init({
      width,
      height,
      backgroundColor: 0x3d7828,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.appendChild(app.canvas);
    appRef.current = app;

    // Create simulation
    const sim = new WorldSimulation();
    simRef.current = sim;

    // Create renderer
    const renderer = new WorldRenderer(app, sim);
    rendererRef.current = renderer;

    renderer.onBotSelect = (bot) => {
      setSelectedBot(bot);
    };

    await renderer.init();
    setIsReady(true);
    setBotCount(sim.bots.size);

    // Game loop
    const gameLoop = (timestamp: number) => {
      sim.update(timestamp);
      renderer.update(timestamp);

      // Update UI state periodically
      if (sim.tick % 15 === 0) {
        setActiveMeetings([...sim.getActiveMeetings()]);
        setMeetingCount(sim.meetings.size);
        setBotCount(sim.bots.size);
        const cam = renderer.getCamera();
        if (cam) setCameraState(cam);
        setChatLog([...sim.chatLog]);
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);

    // Poll API bots and chats every 2 seconds
    sim.syncFromAPI(); // initial fetch
    sim.syncChatsFromAPI();
    const pollInterval = setInterval(() => {
      sim.syncFromAPI();
      sim.syncChatsFromAPI();
    }, 2000);
    return pollInterval;
  }, []);

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | undefined;

    initWorld().then((interval) => {
      pollInterval = interval;
    });

    const handleResize = () => {
      if (containerRef.current && rendererRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        rendererRef.current.resize(clientWidth, clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafRef.current);
      if (pollInterval) clearInterval(pollInterval);
      rendererRef.current?.destroy();
      appRef.current = null;
      rendererRef.current = null;
    };
  }, [initWorld]);

  const handleCloseBotPanel = () => {
    setSelectedBot(null);
    rendererRef.current?.deselectBot();
  };

  return (
    <div className="flex w-full h-full overflow-hidden bg-[#0c1020]">
      {/* Map area */}
      <div className="relative flex-1 min-w-0 overflow-hidden bg-[#3d7828]">
        {/* Pixi canvas mount point */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Vignette depth overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(10,16,8,0.4) 100%)',
          }}
        />

        {/* Loading overlay */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a2a10] z-50">
            <div className="text-center">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
                <span className="text-xl font-black text-black">CW</span>
              </div>
              <p className="text-amber-300 text-xs tracking-widest mb-2" style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}>LOADING WORLD</p>
              <div className="w-40 h-2 bg-[#2a3a1a] rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        )}

        {/* HUD overlay */}
        {isReady && (
          <>
            <WorldHUD botCount={botCount} meetingCount={meetingCount} />
            <MiniMap
              bots={simRef.current?.getBotArray() || []}
              meetings={activeMeetings}
              camera={cameraState}
            />
            {selectedBot && (
              <BotInfoPanel bot={selectedBot} onClose={handleCloseBotPanel} />
            )}
          </>
        )}
      </div>

      {/* Chat stream panel — right side */}
      <div className="w-[340px] shrink-0 h-full">
        <ChatStream
          chats={chatLog}
          bots={simRef.current?.getBotArray() || []}
        />
      </div>
    </div>
  );
}
