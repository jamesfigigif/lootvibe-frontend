import React, { useEffect, useState } from 'react';
import { RARITY_COLORS, INITIAL_BOXES } from '../constants';
import { Rarity } from '../types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { supabase } from '../services/supabaseClient';

interface Drop {
    id: string;
    user_name: string;
    item_name: string;
    item_image: string;
    box_name: string;
    value: number;
    created_at: string;
}

const MOCK_USERNAMES = ['CryptoKing', 'LootMaster', 'SatoshiNakamoto', 'WhaleAlert', 'DiamondHands', 'MoonBoy', 'HODLer', 'BagHolder', 'VitalikFan', 'ElonMusk', 'DogeFather', 'ShibaInu', 'PepeFrog', 'WAGMI', 'NGMI', 'AlphaSeeker', 'BetaTester', 'GammaRay', 'DeltaForce', 'OmegaLul'];
const MOCK_BOXES = ['Tech Box', 'Streetwear Box', 'Luxury Box', 'Crypto Box', 'Budget Box', 'Gamer Box', 'Sneaker Box'];

// Collect all items from all boxes and filter to under $1500
const ALL_PRIZE_ITEMS = INITIAL_BOXES.flatMap(box => box.items).filter(item => item.value <= 1500);

export const LiveSidebar = () => {
    const [drops, setDrops] = useState<Drop[]>([]);

    useEffect(() => {
        // 1. Fetch initial drops
        const fetchInitialDrops = async () => {
            const { data, error } = await supabase
                .from('live_drops')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                setDrops(data);
            }
        };

        fetchInitialDrops();

        // 2. Subscribe to new drops
        const subscription = supabase
            .channel('live_drops_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_drops' }, (payload) => {
                const newDrop = payload.new as Drop;
                setDrops(prev => [newDrop, ...prev].slice(0, 50));
            })
            .subscribe();

        // 3. Mock Drops Generator
        const mockInterval = setInterval(() => {
            if (Math.random() > 0.3) return; // Only trigger 30% of the time per interval

            // Use real prize items under $1500
            const randomItem = ALL_PRIZE_ITEMS[Math.floor(Math.random() * ALL_PRIZE_ITEMS.length)];
            const randomUser = MOCK_USERNAMES[Math.floor(Math.random() * MOCK_USERNAMES.length)] + Math.floor(Math.random() * 100);
            const randomBox = MOCK_BOXES[Math.floor(Math.random() * MOCK_BOXES.length)];

            const mockDrop: Drop = {
                id: `mock-${Date.now()}-${Math.random()}`,
                user_name: randomUser,
                item_name: randomItem.name,
                item_image: randomItem.image,
                box_name: randomBox,
                value: randomItem.value,
                created_at: new Date().toISOString()
            };

            setDrops(prev => [mockDrop, ...prev].slice(0, 50));

        }, 3000); // Check every 3 seconds

        return () => {
            subscription.unsubscribe();
            clearInterval(mockInterval);
        };
    }, []);

    // Helper to format time with timezone correction
    const formatTimeAgo = (dateString: string) => {
        const date = parseISO(dateString);
        return formatDistanceToNow(date, { addSuffix: true });
    };

    // Helper to determine rarity from value
    const getRarity = (val: number): Rarity => {
        if (val > 2000) return Rarity.LEGENDARY;
        if (val > 500) return Rarity.EPIC;
        if (val > 100) return Rarity.RARE;
        if (val > 50) return Rarity.UNCOMMON;
        return Rarity.COMMON;
    };

    return (
        <div className="hidden xl:flex flex-col w-[300px] bg-[#0b0f19] border-l border-white/5 fixed right-0 top-20 bottom-0 z-30 overflow-hidden">

            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-[#0d121f] flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                    <span className="text-xs font-bold text-white tracking-widest uppercase">Live Drops</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                    {drops.length} NEW
                </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 scrollbar-hide mask-gradient-bottom">
                {drops.map((drop) => {
                    const rarity = getRarity(drop.value);
                    return (
                        <div
                            key={drop.id}
                            className={`
                        relative group flex items-center gap-3 p-3 rounded-xl bg-[#131b2e] border-l-[3px]
                        hover:bg-white/5 transition-all cursor-pointer animate-in slide-in-from-right-10 duration-500
                        ${RARITY_COLORS[rarity]} border-white/5
                    `}
                            style={{ borderLeftColor: rarity === Rarity.LEGENDARY ? '#eab308' : rarity === Rarity.EPIC ? '#f43f5e' : rarity === Rarity.RARE ? '#a855f7' : rarity === Rarity.UNCOMMON ? '#3b82f6' : '#64748b' }}
                        >
                            {/* Item Image */}
                            <div className="w-12 h-12 rounded-lg bg-[#0b0f19] border border-white/5 p-1 relative overflow-hidden flex-shrink-0">
                                <div className={`absolute inset-0 opacity-10 ${rarity === Rarity.LEGENDARY ? 'bg-yellow-500' : 'bg-slate-500'}`}></div>
                                <img src={drop.item_image} alt={drop.item_name} className="w-full h-full object-contain" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className={`text-xs font-bold truncate ${rarity === Rarity.LEGENDARY ? 'text-yellow-400 drop-shadow-sm' : 'text-slate-200'}`}>
                                    {drop.item_name}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate mb-1">{drop.box_name}</div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${drop.user_name}`} className="w-4 h-4 rounded-full bg-slate-700" />
                                        <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{drop.user_name}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-600">
                                        {formatTimeAgo(drop.created_at)}
                                    </div>
                                </div>
                            </div>

                            {/* Value Badge */}
                            <div className="absolute top-2 right-2">
                                <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    ${drop.value.toFixed(0)}
                                </span>
                            </div>
                        </div>
                    );
                })}

                <div className="h-8"></div> {/* Spacer for bottom fade */}
            </div>
        </div>
    );
};
