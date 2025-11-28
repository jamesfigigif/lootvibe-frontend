import React, { useEffect, useState, useRef } from 'react';
import { Battle, LootBox, LootItem, BattlePlayerResult, User } from '../types';
import { INITIAL_BOXES, RARITY_COLORS, RARITY_GRADIENTS, RARITY_BG } from '../constants';
import { generateOutcome } from '../services/provablyFairService';
import { ShieldCheck, ArrowLeft, Crown, Trophy, Coins, Zap, Flame, Loader2, Skull, Smile } from 'lucide-react';

interface BattleArenaProps {
    battle: Battle;
    user: User | null;
    onBack: () => void;
    onClaim: (amount: number) => void;
}

interface FloatingEmote {
    id: number;
    emoji: string;
    x: number;
    y: number;
}

// --- SUB-COMPONENT: BATTLE REEL ---
const BattleReel = ({
    player,
    item,
    isSpinning,
    boxItems,
    isWinner,
    isCrazyMode
}: {
    player: any,
    item: LootItem | null,
    isSpinning: boolean,
    boxItems: LootItem[],
    isWinner: boolean,
    isCrazyMode: boolean
}) => {
    // Stable strip of items for the visual blur effect
    const [strip] = useState(() => Array.from({ length: 15 }).map(() => boxItems[Math.floor(Math.random() * boxItems.length)]));

    return (
        <div className={`
            relative flex flex-col bg-[#131b2e] rounded-2xl overflow-hidden transition-all duration-300 h-full
            ${isWinner ? (isCrazyMode ? 'border-2 border-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.2)]' : 'border-2 border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.2)]') : 'border border-white/5 opacity-90'}
            ${isWinner ? 'scale-[1.02] z-10' : ''}
        `}>
            {/* Player Header */}
            <div className={`p-3 border-b border-white/5 flex items-center gap-3 ${isWinner ? (isCrazyMode ? 'bg-purple-500/10' : 'bg-yellow-500/10') : 'bg-[#0d121f]'}`}>
                <div className="relative">
                    {player ? (
                        <img src={player.avatar} className={`w-10 h-10 rounded-full border-2 ${isWinner ? (isCrazyMode ? 'border-purple-500' : 'border-yellow-500') : 'border-white/10'}`} />
                    ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center">?</div>
                    )}

                    {isWinner && (
                        <div className={`absolute -top-3 -right-2 ${isCrazyMode ? 'text-purple-500 border-purple-500' : 'text-yellow-500 border-yellow-500'} bg-black rounded-full p-0.5 border z-20`}>
                            {isCrazyMode ? <Skull className="w-3 h-3 fill-current" /> : <Crown className="w-3 h-3 fill-current" />}
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold truncate ${isWinner ? (isCrazyMode ? 'text-purple-400' : 'text-yellow-400') : 'text-white'}`}>
                        {player ? player.username : 'Waiting...'}
                    </div>
                </div>
            </div>

            {/* THE SLOT MACHINE WINDOW */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black/40 min-h-[200px]">

                {/* 1. BLURRED STRIP (Visible when spinning) */}
                {isSpinning && (
                    <div className="absolute inset-0 flex flex-col items-center animate-scroll-vertical filter blur-[2px] opacity-80">
                        {/* Repeat the strip multiple times for seamless loop */}
                        {[...strip, ...strip].map((stripItem, i) => (
                            <div key={i} className="h-32 w-32 flex items-center justify-center p-4">
                                <img src={stripItem.image} className="h-full object-contain" />
                            </div>
                        ))}
                    </div>
                )}

                {/* 2. TARGET ITEM (Visible when stopped) */}
                {!isSpinning && item && (
                    <div className="flex flex-col items-center animate-in zoom-in-50 duration-300 ease-out">
                        {/* Flash Effect on land */}
                        <div className={`absolute inset-0 bg-white/20 animate-ping opacity-0`} style={{ animationDuration: '0.3s' }}></div>

                        <div className={`relative w-32 h-32 flex items-center justify-center mb-2`}>
                            <div className={`absolute inset-0 bg-gradient-to-tr ${RARITY_GRADIENTS[item.rarity]} rounded-full blur-[40px] opacity-40`}></div>
                            <img src={item.image} className="relative z-10 w-24 h-24 object-contain drop-shadow-2xl" />
                        </div>

                        <div className="text-center relative z-10 px-2">
                            <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border mb-1 uppercase inline-block ${RARITY_COLORS[item.rarity]}`}>
                                {item.rarity}
                            </div>
                            <div className="text-white text-sm font-bold mb-1 truncate max-w-full">{item.name}</div>
                            <div className="text-lg font-mono font-bold text-emerald-400">${item.value.toLocaleString()}</div>
                        </div>
                    </div>
                )}

                {/* 3. WAITING STATE */}
                {!isSpinning && !item && (
                    <div className="opacity-20 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white animate-spin-slow"></div>
                    </div>
                )}
            </div>

            {/* ROUND RESULT OVERLAY */}
            {!isSpinning && item && isWinner && (
                <div className={`absolute inset-x-0 bottom-0 h-1 ${isCrazyMode ? 'bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,1)]' : 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,1)]'}`}></div>
            )}
        </div>
    )
}


export const BattleArena: React.FC<BattleArenaProps> = ({ battle, user, onBack, onClaim }) => {
    const box = INITIAL_BOXES.find(b => b.id === battle.boxId);
    const isCrazyMode = battle.mode === 'CRAZY';

    // Game State
    const [currentRound, setCurrentRound] = useState(1);
    const [results, setResults] = useState<{ [playerId: string]: BattlePlayerResult }>({});
    const [roundItems, setRoundItems] = useState<{ [playerId: string]: LootItem | null }>({});

    // Animation State
    const [gameStatus, setGameStatus] = useState<'WAITING' | 'STARTING' | 'SPINNING' | 'REVEALED' | 'FINISHED'>(
        battle.status === 'WAITING' ? 'WAITING' : 'STARTING'
    );
    const [roundWinnerId, setRoundWinnerId] = useState<string | null>(null);

    // Emotes
    const [emotes, setEmotes] = useState<FloatingEmote[]>([]);
    const nextEmoteId = useRef(0);

    // Refs for logic control
    const mountedRef = useRef(true);
    const spinInProgress = useRef(false);

    // To avoid stale closures in timeouts/async logic, we use a ref for the latest results
    const resultsRef = useRef<{ [playerId: string]: BattlePlayerResult }>({});

    // Add an emote
    const triggerEmote = (emoji: string) => {
        if (!mountedRef.current) return;
        const id = nextEmoteId.current++;
        const x = 10 + Math.random() * 80; // Random horizontal position 10-90%
        const y = 80;

        setEmotes(prev => [...prev, { id, emoji, x, y }]);

        // Remove after 2s
        setTimeout(() => {
            if (mountedRef.current) {
                setEmotes(prev => prev.filter(e => e.id !== id));
            }
        }, 2000);
    }

    // BOT AI for Emotes (Less frequent now)
    useEffect(() => {
        if (battle.status !== 'ACTIVE') return;

        const interval = setInterval(() => {
            // 5% chance every 3s (was 30% every 2s) - much more natural
            if (Math.random() > 0.95) {
                const botEmojis = isCrazyMode ? ['🤡', '💀', '😱'] : ['🔥', '🤑', '😎', '👍'];
                const randomEmoji = botEmojis[Math.floor(Math.random() * botEmojis.length)];
                triggerEmote(randomEmoji);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [battle.status, isCrazyMode]);


    useEffect(() => {
        mountedRef.current = true;
        spinInProgress.current = false;
        return () => { mountedRef.current = false; };
    }, []);

    // Initialize Results
    useEffect(() => {
        const initialResults: any = {};
        battle.players.forEach(p => {
            if (p?.id) {
                initialResults[p.id] = { id: p.id, items: [], totalValue: 0 };
            }
        });
        setResults(initialResults);
        resultsRef.current = initialResults;

        if (battle.status === 'ACTIVE' && gameStatus === 'WAITING') {
            // Delay slightly before starting
            setTimeout(() => setGameStatus('STARTING'), 500);
        }
    }, [battle.status, battle.players]);

    // CORE GAME LOOP
    // This effect listens only to gameStatus to orchestrate steps.
    // It avoids depending on 'battle' object to prevent re-running mid-spin.
    useEffect(() => {
        if (!box) return;

        if (gameStatus === 'STARTING') {
            const t = setTimeout(() => {
                if (mountedRef.current) setGameStatus('SPINNING');
            }, 1000);
            return () => clearTimeout(t);
        }

        if (gameStatus === 'SPINNING') {
            if (spinInProgress.current) return; // Prevent double trigger
            spinInProgress.current = true;

            const runSpin = async () => {
                // 1. Generate Outcomes (Async)
                const roundOutcomes: { [pid: string]: LootItem } = {};
                for (const player of battle.players) {
                    if (!player?.id) continue;
                    // Use player ID and round number to ensure unique outcomes per player/round
                    // In a real app, each player would have their own client seed committed beforehand
                    const clientSeed = player.id;
                    const nonce = currentRound + Date.now(); // Add entropy
                    const outcome = await generateOutcome(box.items, clientSeed, nonce);
                    roundOutcomes[player.id] = outcome.item;
                }

                // 2. Wait for spin animation (min 2.5s)
                setTimeout(() => {
                    if (!mountedRef.current) return;

                    setRoundItems(roundOutcomes);

                    // Determine Round Winner
                    let bestValue = isCrazyMode ? Infinity : -1;
                    let rWinner = null;

                    Object.entries(roundOutcomes).forEach(([pid, item]) => {
                        if (isCrazyMode) {
                            if (item.value < bestValue) {
                                bestValue = item.value;
                                rWinner = pid;
                            }
                        } else {
                            if (item.value > bestValue) {
                                bestValue = item.value;
                                rWinner = pid;
                            }
                        }
                    });
                    setRoundWinnerId(rWinner);

                    // Update Total Results
                    const nextResults = { ...resultsRef.current };
                    Object.keys(roundOutcomes).forEach(pid => {
                        const item = roundOutcomes[pid];
                        if (!nextResults[pid]) nextResults[pid] = { id: pid, items: [], totalValue: 0 };

                        nextResults[pid] = {
                            ...nextResults[pid],
                            items: [...nextResults[pid].items, item],
                            totalValue: nextResults[pid].totalValue + item.value
                        };
                    });

                    setResults(nextResults);
                    resultsRef.current = nextResults;

                    // Reaction Emotes (Immediate reaction to reveal)
                    if (rWinner && rWinner.startsWith('bot_')) {
                        triggerEmote(isCrazyMode ? '🤡' : '🔥');
                    } else if (rWinner) {
                        // Bot reacts to human win
                        triggerEmote(isCrazyMode ? '💀' : '😭');
                    }

                    setGameStatus('REVEALED');
                    spinInProgress.current = false;
                }, 2500);
            };

            runSpin();
        }

        if (gameStatus === 'REVEALED') {
            const t = setTimeout(() => {
                if (!mountedRef.current) return;

                // Check End Condition or Sudden Death
                if (currentRound >= battle.roundCount) {
                    const currentScores = resultsRef.current;
                    const sortedPlayers = Object.values(currentScores).sort((a, b) =>
                        isCrazyMode ? a.totalValue - b.totalValue : b.totalValue - a.totalValue
                    );

                    // Sudden Death Check
                    if (sortedPlayers.length > 1 && sortedPlayers[0].totalValue === sortedPlayers[1].totalValue) {
                        triggerEmote('😱');
                        triggerEmote('😱');
                        setCurrentRound(c => c + 1);
                        setRoundItems({});
                        setRoundWinnerId(null);
                        setGameStatus('SPINNING');
                    } else {
                        setGameStatus('FINISHED');
                    }
                } else {
                    setCurrentRound(c => c + 1);
                    setRoundItems({});
                    setRoundWinnerId(null);
                    setGameStatus('SPINNING');
                }
            }, 2000); // 2s delay before next round or finish
            return () => clearTimeout(t);
        }

    }, [gameStatus, box]); // Only trigger when status updates


    if (!box) return null;

    // Calculate winner for display
    const finalSorted = Object.values(results).sort((a, b) => isCrazyMode ? a.totalValue - b.totalValue : b.totalValue - a.totalValue);
    const overallWinnerId = gameStatus === 'FINISHED' ? finalSorted[0]?.id : null;

    const totalPot = battle.price * battle.roundCount * battle.playerCount;
    const isUserWinner = user && overallWinnerId === user.id;

    return (
        <div className="min-h-screen bg-[#0b0f19] flex flex-col relative overflow-hidden">

            <style dangerouslySetInnerHTML={{
                __html: `
          @keyframes scroll-vertical {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
          .animate-scroll-vertical {
            animation: scroll-vertical 0.5s linear infinite;
          }
          @keyframes float-up {
              0% { transform: translateY(0) scale(0.5); opacity: 0; }
              10% { opacity: 1; }
              100% { transform: translateY(-300px) scale(1.5); opacity: 0; }
          }
        `}} />

            <div className={`absolute inset-0 bg-gradient-to-br ${box.color} opacity-10 pointer-events-none`}></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

            {/* EMOTE LAYER */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-[100]">
                {emotes.map(e => (
                    <div
                        key={e.id}
                        className="absolute text-4xl"
                        style={{
                            left: `${e.x}%`,
                            bottom: '100px',
                            animation: 'float-up 2s ease-out forwards'
                        }}
                    >
                        {e.emoji}
                    </div>
                ))}
            </div>

            <div className="relative z-20 h-24 border-b border-white/5 bg-[#0b0f19]/80 backdrop-blur flex items-center justify-between px-6 md:px-12">
                <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 font-bold text-sm bg-white/5 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> LEAVE
                </button>

                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-bold tracking-widest uppercase mb-1">
                        {isCrazyMode ? <Skull className="w-3 h-3 text-purple-500" /> : <Zap className="w-3 h-3 text-yellow-500 fill-current" />}
                        {currentRound > battle.roundCount ? <span className="text-red-500 animate-pulse">SUDDEN DEATH</span> : `Round ${currentRound} / ${battle.roundCount}`}
                    </div>
                    <div className="text-white font-display font-bold text-2xl tracking-wide drop-shadow-md flex items-center gap-2">
                        {box.name} {isCrazyMode && <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded ml-2">CRAZY MODE</span>}
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-900/40 to-emerald-950/40 border border-emerald-500/20 px-6 py-2 rounded-xl shadow-lg shadow-emerald-900/20">
                    <Coins className="w-5 h-5 text-emerald-400" />
                    <div className="flex flex-col items-end leading-none">
                        <span className="text-[10px] text-emerald-500/80 font-bold uppercase">Total Pot</span>
                        <span className="text-emerald-400 font-mono font-bold text-lg">${totalPot.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden relative">

                {gameStatus === 'WAITING' && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap className="w-8 h-8 text-purple-500 animate-pulse" fill="currentColor" />
                            </div>
                        </div>
                        <h2 className="mt-8 text-2xl font-bold font-display tracking-widest">LOOKING FOR OPPONENT...</h2>
                        <p className="text-slate-400 mt-2">Waiting for players to join your {battle.playerCount === 4 ? '2v2' : battle.playerCount === 6 ? '3v3' : '1v1'} battle</p>
                    </div>
                )}

                {/* Players Grid - RESPONSIVE GRID LAYOUT */}
                <div className="w-full max-w-7xl h-[65vh] p-4">
                    <div className={`
                    w-full h-full grid gap-4 items-center justify-items-center
                    ${battle.playerCount === 2 ? 'grid-cols-2' : ''}
                    ${battle.playerCount === 4 ? 'grid-cols-2 grid-rows-2' : ''}
                    ${battle.playerCount === 6 ? 'grid-cols-3 grid-rows-2' : ''}
                `}>
                        {battle.players.map((player, idx) => {
                            // Empty Slot
                            if (!player && gameStatus === 'WAITING') {
                                return (
                                    <div key={idx} className="w-full h-full max-w-sm flex flex-col gap-2 opacity-50 min-h-[250px]">
                                        <div className="flex items-center justify-between p-3 rounded-xl border bg-[#131b2e] border-white/5">
                                            <span className="text-xs text-slate-400 font-bold uppercase">Total</span>
                                            <span className="font-mono font-bold text-lg text-slate-600">$0</span>
                                        </div>
                                        <div className="flex-1 bg-[#131b2e] rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                                            </div>
                                            <div className="text-slate-500 font-bold">Waiting...</div>
                                        </div>
                                    </div>
                                );
                            }

                            if (!player) return <div key={idx}></div>;

                            const result = results[player.id || ''] || { totalValue: 0, items: [] };
                            const isRoundWinner = roundWinnerId === player.id && gameStatus === 'REVEALED';

                            return (
                                <div key={idx} className="w-full h-full max-w-sm flex flex-col gap-3 min-h-[250px]">
                                    <div className={`
                                    flex items-center justify-between p-3 rounded-xl border transition-all duration-300
                                    ${isRoundWinner ? (isCrazyMode ? 'bg-purple-500/20 border-purple-500/50' : 'bg-yellow-500/20 border-yellow-500/50') : 'bg-[#131b2e] border-white/5'}
                                `}>
                                        <span className="text-xs text-slate-400 font-bold uppercase">Total</span>
                                        <span className={`font-mono font-bold text-lg ${isRoundWinner ? (isCrazyMode ? 'text-purple-400' : 'text-yellow-400') : 'text-emerald-400'}`}>
                                            ${result.totalValue.toLocaleString()}
                                        </span>
                                    </div>

                                    <BattleReel
                                        player={player}
                                        item={roundItems[player.id || '']}
                                        isSpinning={gameStatus === 'SPINNING'}
                                        boxItems={box.items}
                                        isWinner={isRoundWinner}
                                        isCrazyMode={isCrazyMode}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* LIVE REACTIONS TOOLBAR */}
                <div className="absolute bottom-8 z-30 flex gap-2">
                    {['🔥', '🤑', '😎', '😭', '🤡'].map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => triggerEmote(emoji)}
                            className="bg-black/50 hover:bg-black/80 backdrop-blur rounded-full w-12 h-12 text-2xl border border-white/10 hover:border-white/30 hover:scale-110 active:scale-90 transition-all shadow-lg"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            {gameStatus === 'FINISHED' && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-700">
                    <div className={`bg-[#131b2e] border p-1.5 rounded-[32px] max-w-lg w-full mx-4 animate-in zoom-in-90 duration-500 ${isCrazyMode ? 'border-purple-500/30 shadow-[0_0_100px_rgba(168,85,247,0.3)]' : 'border-yellow-500/30 shadow-[0_0_100px_rgba(234,179,8,0.3)]'}`}>
                        <div className="bg-[#0b0f19] rounded-[26px] p-10 text-center relative overflow-hidden">
                            <div className={`absolute inset-0 ${isCrazyMode ? 'bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.2),transparent_70%)]' : 'bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.2),transparent_70%)]'}`}></div>

                            <div className="relative w-28 h-28 mx-auto mb-6">
                                <div className={`absolute inset-0 ${isCrazyMode ? 'bg-purple-500' : 'bg-yellow-500'} rounded-full blur-xl opacity-50 animate-pulse`}></div>
                                <img
                                    src={battle.players.find(p => p?.id === overallWinnerId)?.avatar}
                                    className={`relative z-10 w-full h-full rounded-full border-4 ${isCrazyMode ? 'border-purple-500' : 'border-yellow-500'} shadow-2xl`}
                                />
                                <div className={`absolute -bottom-2 -right-2 ${isCrazyMode ? 'bg-purple-500' : 'bg-yellow-500'} text-black p-2 rounded-full border-4 border-[#0b0f19] z-20`}>
                                    {isCrazyMode ? <Skull className="w-6 h-6 fill-current" /> : <Trophy className="w-6 h-6 fill-current" />}
                                </div>
                            </div>

                            <h2 className="text-4xl font-display font-bold text-white mb-2 drop-shadow-lg tracking-wide">VICTORY</h2>
                            <div className={`${isCrazyMode ? 'text-purple-500' : 'text-yellow-500'} font-bold text-lg mb-2 uppercase tracking-widest`}>{battle.players.find(p => p?.id === overallWinnerId)?.username} Wins!</div>

                            {isCrazyMode && <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-6">(LOWEST TOTAL VALUE)</div>}

                            {overallWinnerId && (
                                <div className="bg-gradient-to-r from-[#1a2336] to-[#131b2e] p-6 rounded-2xl border border-white/10 mb-8 flex flex-col items-center">
                                    <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Winnings</div>
                                    <div className="text-5xl font-mono font-bold text-emerald-400 flex items-center gap-2 drop-shadow-xl">
                                        ${totalPot.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => isUserWinner ? onClaim(totalPot) : onBack()}
                                className={`
                                w-full py-4 rounded-xl font-extrabold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all
                                ${isUserWinner
                                        ? `bg-gradient-to-r ${isCrazyMode ? 'from-purple-500 to-purple-600 shadow-[0_0_30px_rgba(168,85,247,0.4)]' : 'from-yellow-500 to-yellow-600 shadow-[0_0_30px_rgba(234,179,8,0.4)]'} text-black`
                                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                                    }
                             `}
                            >
                                {isUserWinner ? 'CLAIM PRIZE' : 'LEAVE ARENA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};