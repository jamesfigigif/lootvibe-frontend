import React, { useEffect, useState, useRef } from 'react';
import { LootBox, LootItem, Rarity } from '../types';
import { RARITY_COLORS, RARITY_BG, RARITY_GRADIENTS } from '../constants';
import { ChevronLeft, Volume2, ShieldCheck, Box, Hash, Percent } from 'lucide-react';

interface OpeningStageProps {
  box: LootBox;
  winner: LootItem | null;
  onBack: () => void;
  onComplete: () => void;
  isOpening: boolean;
  // Updated Prop Type for Block Data
  rollResult: {
    item: LootItem;
    block: { height: number; hash: string };
    randomValue: number
  } | null;
}

export const OpeningStage: React.FC<OpeningStageProps> = ({ box, winner, onBack, onComplete, isOpening, rollResult }) => {
  const [reelItems, setReelItems] = useState<LootItem[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const reelGeneratedRef = useRef(false); // Track if reel has been generated

  // Use rollResult.item as the authoritative winner source
  const actualWinner = rollResult?.item || winner;

  // Configuration
  const CARD_WIDTH = 200;
  const MARGIN_X = 16; // mx-2 = 8px * 2
  const TOTAL_CARD_WIDTH = CARD_WIDTH + MARGIN_X;
  const WINNER_INDEX = 60; // Increased index for longer spin time

  useEffect(() => {
    // Use the pre-generated reel from rollResult (generated in App.tsx)
    // This ensures the reel is generated EXACTLY ONCE and matches the prize
    if (rollResult?.preGeneratedReel && reelItems.length === 0) {
      console.log('✅ Using pre-generated reel with winner:', actualWinner?.name);
      setReelItems(rollResult.preGeneratedReel);
    }
  }, [rollResult, actualWinner, reelItems.length]);

  // Reset the ref when component unmounts (for next box opening)
  useEffect(() => {
    return () => {
      reelGeneratedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpening && scrollContainerRef.current && reelItems.length > 0) {
      // Calculate final position
      const containerWidth = window.innerWidth;

      // The reel starts at x=0 (no initial offset)
      // Each card is TOTAL_CARD_WIDTH (200px + 16px margin = 216px)
      // Winner is at index 60
      // We want the CENTER of the winner card to align with the CENTER of the screen
      //
      // Winner card left edge = WINNER_INDEX * TOTAL_CARD_WIDTH
      // Winner card center = Winner card left edge + (CARD_WIDTH / 2)
      // Screen center = containerWidth / 2
      // 
      // To center the winner card, we need to translate the reel by:
      // -(Winner card center - Screen center)
      // Which simplifies to: Screen center - Winner card center

      const winnerCardLeftEdge = WINNER_INDEX * TOTAL_CARD_WIDTH;
      const winnerCardCenter = winnerCardLeftEdge + (CARD_WIDTH / 2);
      const screenCenter = containerWidth / 2;
      const finalPosition = winnerCardCenter - screenCenter;

      console.log('🎰 Animation Config:');
      console.log('  - Winner Index:', WINNER_INDEX);
      console.log('  - Winner Item:', actualWinner?.name);
      console.log('  - Item at Index', WINNER_INDEX, ':', reelItems[WINNER_INDEX]?.name);
      console.log('  - Card Width:', CARD_WIDTH, 'px');
      console.log('  - Total Card Width (with margin):', TOTAL_CARD_WIDTH, 'px');
      console.log('  - Winner Card Left Edge:', winnerCardLeftEdge, 'px');
      console.log('  - Winner Card Center:', winnerCardCenter, 'px');
      console.log('  - Screen Center:', screenCenter, 'px');
      console.log('  - Final Position (translateX):', finalPosition, 'px');

      // Verify the winner is actually at WINNER_INDEX
      if (reelItems[WINNER_INDEX]?.name !== actualWinner?.name) {
        console.error('⚠️ MISMATCH! Winner not at expected index!');
        console.error('  Expected:', actualWinner?.name);
        console.error('  At index', WINNER_INDEX, ':', reelItems[WINNER_INDEX]?.name);
      }

      const el = scrollContainerRef.current;

      // 1. Reset
      el.style.transition = 'none';
      el.style.transform = 'translateX(0px)';

      // Force Reflow
      el.getBoundingClientRect();

      // 2. Animate - Faster 4s animation for better UX
      // cubic-bezier(0.15, 0.85, 0.35, 1.0) -> Starts fast, stays fast, then heavy braking at the end
      el.style.transition = 'transform 4s cubic-bezier(0.15, 0.85, 0.35, 1.00)';
      el.style.transform = `translateX(-${finalPosition}px)`;

      const timer = setTimeout(() => {
        onComplete();
      }, 4200); // Wait slightly longer than transition

      return () => clearTimeout(timer);
    }
  }, [isOpening, onComplete, reelItems.length, actualWinner]);

  return (
    <div className="fixed inset-0 z-40 bg-[#0b0f19] flex flex-col">
      {/* Top Controls */}
      <div className="h-20 flex items-center justify-between px-8 border-b border-white/5 bg-[#0b0f19]/50 backdrop-blur z-50">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span className="font-bold">EXIT</span>
        </button>
        <div className="font-display font-bold text-xl tracking-widest text-purple-500 uppercase">{box.name}</div>
        <div className="flex items-center gap-4">
          <button
            onClick={onComplete}
            className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-white transition-colors"
          >
            SKIP
          </button>
          <button className="text-slate-400 hover:text-white">
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">

        {/* Background Effects */}
        <div className={`absolute inset-0 bg-gradient-to-br ${box.color} opacity-5`}></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1),transparent_70%)]"></div>

        {/* Center Indicator (The Needle) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[260px] w-[2px] bg-yellow-400 z-30 shadow-[0_0_15px_rgba(250,204,21,1)] pointer-events-none">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-yellow-400 rotate-45 shadow-[0_0_10px_rgba(250,204,21,0.8)] border-4 border-[#0b0f19]"></div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-yellow-400 rotate-45 shadow-[0_0_10px_rgba(250,204,21,0.8)] border-4 border-[#0b0f19]"></div>
        </div>

        {/* The Reel */}
        <div className="w-full relative py-12">
          <div
            ref={scrollContainerRef}
            className="flex items-center"
            style={{ width: 'max-content', willChange: 'transform' }}
          >
            {reelItems.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className={`
                            relative flex-shrink-0 w-[200px] h-[200px] mx-2 rounded-2xl 
                            bg-[#131b2e] border-b-[6px] flex flex-col items-center justify-center p-4
                            transform transition-transform duration-300
                            ${RARITY_COLORS[item.rarity]}
                            ${item.rarity === Rarity.LEGENDARY ? 'shadow-[0_0_30px_rgba(234,179,8,0.15)] border-yellow-500/30' : 'shadow-lg'}
                        `}
              >
                {/* Card Glow Background */}
                <div className={`absolute inset-0 opacity-10 rounded-xl bg-gradient-to-br ${RARITY_GRADIENTS[item.rarity]}`}></div>

                <div className="relative w-32 h-32 mb-4 z-10">
                  <img src={item.image} alt={item.name} className="w-full h-full object-contain drop-shadow-2xl" />
                </div>

                <div className="relative z-10 text-center w-full">
                  <div className="text-sm font-bold truncate px-2 text-slate-200">{item.name}</div>
                  <div className="text-xs font-mono opacity-60 mt-1 text-slate-400">${item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Provably Fair Info */}
      <div className="h-24 border-t border-white/5 bg-[#0e121e] flex flex-col justify-center px-8 relative z-20">
        <div className="max-w-4xl mx-auto w-full grid grid-cols-3 gap-8 text-xs font-mono text-slate-500">
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-slate-300">
              <Box className="w-3 h-3 text-orange-500" /> BITCOIN BLOCK
            </div>
            <div className="truncate opacity-70">
              {rollResult?.block ? `#${rollResult.block.height}` : 'WAITING_FOR_MINER...'}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-slate-300">
              <Hash className="w-3 h-3 text-blue-500" /> BLOCK HASH
            </div>
            <div className="truncate opacity-70">
              {rollResult?.block ? rollResult.block.hash : 'MINING...'}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1 text-slate-300">
              <Percent className="w-3 h-3 text-purple-500" /> RANDOM ROLL (0-1)
            </div>
            <div className="truncate text-emerald-400 font-bold">
              {rollResult ? rollResult.randomValue.toFixed(16) : 'CALCULATING...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};