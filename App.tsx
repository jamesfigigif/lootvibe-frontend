import React, { useState, useEffect } from 'react';
import { ClerkProvider, SignedIn, SignedOut, UserButton, useUser, SignInButton, SignUpButton, useClerk } from '@clerk/clerk-react';
import { Navbar } from './components/Navbar';
import { OpeningStage } from './components/OpeningStage';
import { StatsHeader } from './components/StatsHeader';

import { LiveSidebar } from './components/LiveSidebar';
import { BattleLobby } from './components/BattleLobby';
import { BattleArena } from './components/BattleArena';
import { RacePage } from './components/RacePage';
import { AffiliatesPage } from './components/AffiliatesPage';
import { ProvablyFairModal } from './components/ProvablyFairModal';
import { ShippingModal } from './components/ShippingModal';
import { AdminPanel } from './components/AdminPanel';
import { LoadingSpinner } from './components/LoadingSpinner';
import { LazyImage } from './components/LazyImage';
import { ImageUploader } from './components/ImageUploader';
import { CryptoDepositModal } from './components/CryptoDepositModal';
import { WithdrawModal } from './components/WithdrawModal';
import { LootBox, User, ViewState, Rarity, LootItem, BoxCategory, Battle, ShippingAddress } from './types';
import { INITIAL_BOXES, RARITY_COLORS, RARITY_BG, RARITY_GRADIENTS, MOCK_BATTLES } from './constants';
import { generateOutcome } from './services/provablyFairService';
import { generateCustomBox, generateBoxImage } from './services/geminiService';
import { getUser, addTransaction, updateUserState, markFreeBoxClaimed } from './services/walletService';
import { createOrder } from './services/orderService';
import { createShipment } from './services/shippingService';
import { X, Loader2, Sparkles, RefreshCw, DollarSign, Package, Filter, Search, Bitcoin, CreditCard, ChevronRight, Paintbrush, ArrowRight, Check, Shield, Info, Gift, Users, Skull, Swords, Truck, Pencil, Trophy } from 'lucide-react';

export default function App() {
    const { user: clerkUser, isSignedIn, isLoaded } = useUser();
    const [view, setView] = useState<ViewState>({ page: 'HOME' });
    const [user, setUser] = useState<User | null>(null);
    const [selectedBox, setSelectedBox] = useState<LootBox | null>(null);

    // Battle State
    const [battles, setBattles] = useState<Battle[]>(MOCK_BATTLES);
    const [activeBattle, setActiveBattle] = useState<Battle | null>(null);
    const [battlePlayerCount, setBattlePlayerCount] = useState<2 | 4 | 6>(2); // 1v1 (2), 2v2 (4), 3v3 (6)

    // Opening State
    const [isOpening, setIsOpening] = useState(false);
    const [rollResult, setRollResult] = useState<{ item: LootItem; serverSeed: string; serverSeedHash: string; nonce: number; randomValue: number } | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);

    // Modals
    const [showDeposit, setShowDeposit] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [showCreateBattle, setShowCreateBattle] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [showProvablyFair, setShowProvablyFair] = useState(false);
    const [showShipping, setShowShipping] = useState(false);
    const [selectedItemsToShip, setSelectedItemsToShip] = useState<LootItem[]>([]);

    // Auth & Welcome Logic
    const [isWelcomeSpinPending, setIsWelcomeSpinPending] = useState(false);

    // Filters & Search
    const [activeCategory, setActiveCategory] = useState<BoxCategory>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // AI Box
    const [isReskinning, setIsReskinning] = useState(false);
    const [boxes, setBoxes] = useState<LootBox[]>(INITIAL_BOXES);

    // Deposit State
    const [selectedCrypto, setSelectedCrypto] = useState<'BTC' | 'ETH'>('BTC');
    const [showCryptoDeposit, setShowCryptoDeposit] = useState(false);

    // Profile Edit State
    const [isEditingName, setIsEditingName] = useState(false);
    const [newUsername, setNewUsername] = useState('');

    // Balance Animation State
    const [balanceIncrease, setBalanceIncrease] = useState<number | null>(null);

    // Demo Mode State
    const [isDemoMode, setIsDemoMode] = useState(false);

    // Scroll to top on view change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [view.page, selectedBox]);

    // Sync user balance
    useEffect(() => {
        if (user) {
            const syncUser = async () => {
                const latestUser = await getUser(user.id);
                setUser(latestUser);
            };
            const interval = setInterval(syncUser, 2000);
            return () => clearInterval(interval);
        }
    }, [user?.id]);

    // Check for referral code and routes in URL
    useEffect(() => {
        const handleUrlParams = async () => {
            const path = window.location.pathname;

            // Handle Admin Route
            if (path === '/admin') {
                setView({ page: 'ADMIN' });
                return;
            }

            // Check for /r/USERNAME format
            const match = path.match(/\/r\/([a-zA-Z0-9]+)/);
            let referralCode = null;

            if (match && match[1]) {
                referralCode = match[1];
            } else {
                // Check for ?ref=CODE format
                const params = new URLSearchParams(window.location.search);
                referralCode = params.get('ref');
            }

            if (referralCode) {
                console.log('Found referral code:', referralCode);
                localStorage.setItem('referralCode', referralCode);
            }
        };

        handleUrlParams();
    }, []);

    // Initialize user from Clerk
    useEffect(() => {
        const initUser = async () => {
            if (isLoaded && isSignedIn && clerkUser && !user) {
                await confirmLogin();
            } else if (isLoaded && !isSignedIn) {
                setUser(null);
            }
        };
        initUser();
    }, [isLoaded, isSignedIn, clerkUser?.id]);

    // --- Handlers ---

    const clerk = useClerk();

    const handleLogin = (fromWelcomeSpin = false) => {
        setIsWelcomeSpinPending(fromWelcomeSpin);
        clerk.openSignIn();
    };

    const confirmLogin = async () => {
        if (!clerkUser) return;
        const loggedInUser = await getUser(clerkUser.id);

        // Check for pending referral
        const pendingReferral = localStorage.getItem('referralCode');
        if (pendingReferral) {
            try {
                // Import dynamically to avoid circular dependencies if any
                const { trackReferral } = await import('./services/affiliateService');
                await trackReferral(pendingReferral, loggedInUser.id);
                localStorage.removeItem('referralCode');
                console.log('Referral tracked successfully');
            } catch (e) {
                console.error('Failed to track referral on login:', e);
            }
        }

        setUser(loggedInUser);
        setShowAuth(false);

        // Check if this login originated from "Claim Free Box" to trigger the spin
        if (isWelcomeSpinPending) {
            setTimeout(() => {
                // Trigger welcome spin box
                const btcBox = INITIAL_BOXES.find(b => b.id === 'btc_gift');
                if (btcBox) {
                    setSelectedBox(btcBox);
                    // Rigged spin for welcome bonus
                    handleWelcomeSpin(btcBox);
                    setIsWelcomeSpinPending(false); // Reset pending state
                }
            }, 500);
        }
    };

    const handleWelcomeSpin = async (box: LootBox) => {
        if (!user) return;

        // Guaranteed $10 win (Satoshi Stack)
        const winningItem = box.items.find(i => i.value === 10) || box.items[0];

        setRollResult({
            item: winningItem,
            serverSeed: 'welcome-bonus-seed',
            serverSeedHash: 'hashed-welcome-seed',
            nonce: 0,
            randomValue: 0.5,
            block: { height: 840000, hash: '0000000000000000000mockhash' }
        });
        setView({ page: 'OPENING' });
        setIsOpening(true);

        // Automatically add $10 to balance (no item choice)
        setTimeout(async () => {
            if (!user) return;

            // Add $10 to balance
            const updatedUser = {
                ...user,
                balance: user.balance + 10,
                freeBoxClaimed: true
            };
            setUser(updatedUser);
            await updateUserState(user.id, { balance: updatedUser.balance });

            // Mark free box as claimed
            await markFreeBoxClaimed(user.id);

            setIsOpening(false);
            setView({ page: 'HOME' });
            setSelectedBox(null);
        }, 3000);
    };

    const handleOpenBox = async () => {
        if (!selectedBox || !user) {
            if (!user) handleLogin(false);
            return;
        }

        // Ensure we are NOT in demo mode for a real opening
        setIsDemoMode(false);

        const cost = selectedBox.salePrice || selectedBox.price;
        if (user.balance < cost) {
            setShowDeposit(true);
            return;
        }

        try {
            // Show "Generating seed" suspense
            setIsOpening(true);
            setView({ page: 'OPENING' });

            // Add 1.5 second delay for suspense
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 1. Generate Outcome (Provably Fair)
            const result = await generateOutcome(selectedBox.items, user.clientSeed, user.nonce);
            console.log('🎲 Generated outcome:', result.item.name, '| Value:', result.item.value, '| Random:', result.randomValue);

            // 2. Generate the reel ONCE here (before component mounts)
            const WINNER_INDEX = 60;
            const totalItems = WINNER_INDEX + 10;
            const reelItems: LootItem[] = [];
            const highTierItems = selectedBox.items.filter(i => i.rarity === 'LEGENDARY' || i.rarity === 'EPIC');

            for (let i = 0; i < totalItems; i++) {
                if (i === WINNER_INDEX) {
                    // Place the actual winner at index 60
                    reelItems.push({ ...result.item, id: `winner - ${result.item.id} ` });
                    console.log('🎯 PRE-GENERATED: Winner at index', WINNER_INDEX, ':', result.item.name);
                } else if (i === WINNER_INDEX + 1 || i === WINNER_INDEX - 1) {
                    // Teaser items next to winner
                    if (Math.random() > 0.5 && highTierItems.length > 0) {
                        const randomTease = highTierItems[Math.floor(Math.random() * highTierItems.length)];
                        reelItems.push(randomTease.id !== result.item.id ? randomTease : selectedBox.items[0]);
                    } else {
                        const randomItem = selectedBox.items[Math.floor(Math.random() * selectedBox.items.length)];
                        reelItems.push({ ...randomItem, id: `${randomItem.id} -${i} ` });
                    }
                } else {
                    // Random filler
                    const randomItem = selectedBox.items[Math.floor(Math.random() * selectedBox.items.length)];
                    reelItems.push({ ...randomItem, id: `${randomItem.id} -${i} ` });
                }
            }

            // 3. Create Order & Deduct Funds
            await createOrder(user.id, selectedBox, [result.item], user.username, user.avatar);

            // 4. Update Local User State
            await updateUserState(user.id, { nonce: user.nonce + 1 });
            const updatedUser = await getUser(user.id);
            setUser(updatedUser);

            // 5. Set result with pre-generated reel
            setRollResult({ ...result, preGeneratedReel: reelItems });

        } catch (error) {
            console.error("Open Box Error:", error);
            alert("Failed to open box. Please try again.");
            setIsOpening(false);
            setView({ page: 'BOX_DETAIL' });
        }
    };

    const handleDemoOpen = async () => {
        if (!selectedBox) return;

        try {
            // Set demo mode
            setIsDemoMode(true);

            // Show "Generating seed" suspense
            setIsOpening(true);
            setView({ page: 'OPENING' });

            // Add 1.5 second delay for suspense
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Generate outcome (no balance deduction)
            const demoSeed = 'demo-seed-' + Date.now();
            const result = await generateOutcome(selectedBox.items, demoSeed, 0);
            console.log('\ud83c\udfae DEMO: Generated outcome:', result.item.name, '| Value:', result.item.value);

            // Generate the reel
            const WINNER_INDEX = 60;
            const totalItems = WINNER_INDEX + 10;
            const reelItems: LootItem[] = [];
            const highTierItems = selectedBox.items.filter(i => i.rarity === 'LEGENDARY' || i.rarity === 'EPIC');

            for (let i = 0; i < totalItems; i++) {
                if (i === WINNER_INDEX) {
                    reelItems.push({ ...result.item, id: `winner - ${result.item.id} ` });
                } else if (i === WINNER_INDEX + 1 || i === WINNER_INDEX - 1) {
                    if (Math.random() > 0.5 && highTierItems.length > 0) {
                        const randomTease = highTierItems[Math.floor(Math.random() * highTierItems.length)];
                        reelItems.push(randomTease.id !== result.item.id ? randomTease : selectedBox.items[0]);
                    } else {
                        const randomItem = selectedBox.items[Math.floor(Math.random() * selectedBox.items.length)];
                        reelItems.push({ ...randomItem, id: `${randomItem.id} -${i} ` });
                    }
                } else {
                    const randomItem = selectedBox.items[Math.floor(Math.random() * selectedBox.items.length)];
                    reelItems.push({ ...randomItem, id: `${randomItem.id} -${i} ` });
                }
            }

            // Set result with pre-generated reel (no balance/nonce update)
            setRollResult({ ...result, preGeneratedReel: reelItems });

        } catch (error) {
            console.error("Demo Open Error:", error);
            alert("Failed to run demo. Please try again.");
            setIsOpening(false);
            setView({ page: 'BOX_DETAIL' });
            setIsDemoMode(false);
        }
    };

    const handleAnimationComplete = React.useCallback(() => {
        setIsOpening(false);
        setTimeout(() => {
            setShowResultModal(true);
        }, 500);
    }, []);

    const resetOpenState = React.useCallback(() => {
        setShowResultModal(false);
        setRollResult(null);
        setView({ page: 'BOX_DETAIL' });
    }, []);

    const handleSellItem = React.useCallback(async () => {
        if (!user || !rollResult) return;
        try {
            console.log('💰 Selling item:', rollResult.item.name, 'for $', rollResult.item.value);

            // Trigger balance animation
            setBalanceIncrease(rollResult.item.value);

            // Close modal immediately
            resetOpenState();

            // Add transaction and update balance
            await addTransaction(user.id, 'WIN', rollResult.item.value, `Sold item: ${rollResult.item.name} `);
            const updatedUser = await getUser(user.id);
            console.log('✅ Balance updated:', updatedUser.balance);
            setUser(updatedUser);
        } catch (error) {
            console.error('❌ Error selling item:', error);
            alert('Failed to sell item. Please try again.');
        }
    }, [user, rollResult, resetOpenState]);

    const handleKeepItem = React.useCallback(async () => {
        if (!user || !rollResult) return;
        try {
            console.log('🎒 Adding item to inventory:', rollResult.item.name);
            const updatedInventory = [...user.inventory, rollResult.item];
            console.log('📦 Updated inventory:', updatedInventory.length, 'items');
            await updateUserState(user.id, { inventory: updatedInventory });
            const updatedUser = await getUser(user.id);
            console.log('✅ User inventory after update:', updatedUser.inventory.length, 'items');
            setUser(updatedUser);
            resetOpenState();
        } catch (error) {
            console.error('❌ Error adding item to inventory:', error);
            alert('Failed to add item to inventory. Please try again.');
        }
    }, [user, rollResult, resetOpenState]);

    const handleShipItems = (items: LootItem[]) => {
        setSelectedItemsToShip(items);
        setShowShipping(true);
    };

    const handleShipmentSubmit = async (address: ShippingAddress) => {
        if (!user) return;
        await createShipment(user.id, selectedItemsToShip, address);
        const updatedUser = await getUser(user.id);
        setUser(updatedUser);
        setShowShipping(false);
        setSelectedItemsToShip([]);
    };

    // --- Battle Handlers ---
    const initiateCreateBattle = () => {
        if (!user) { handleLogin(false); return; }
        setShowCreateBattle(true);
    };

    const finalizeCreateBattle = (box: LootBox) => {
        if (!user) return;

        const cost = box.salePrice || box.price;

        if (user.balance < cost) {
            setShowCreateBattle(false);
            setShowDeposit(true);
            return;
        }

        setUser({ ...user, balance: user.balance - cost });

        const playersArray = new Array(battlePlayerCount).fill(null);
        playersArray[0] = user; // Creator is always slot 0

        const newBattle: Battle = {
            id: `battle_${Date.now()} `,
            boxId: box.id,
            price: cost,
            playerCount: battlePlayerCount,
            players: playersArray,
            status: 'WAITING',
            roundCount: 1,
        };

        setBattles([newBattle, ...battles]);
        setShowCreateBattle(false);
        setActiveBattle(newBattle);
        setView({ page: 'BATTLE_ARENA' });
    };

    // Simulate opponent joining
    useEffect(() => {
        if (view.page === 'BATTLE_ARENA' && activeBattle && activeBattle.status === 'WAITING' && activeBattle.players[0]?.id === user?.id) {
            const timer = setTimeout(() => {
                // Bot logic: fill one empty slot
                const botUser: User = {
                    id: `bot_${Date.now()} `,
                    username: `Bot_${Math.floor(Math.random() * 100)} `,
                    balance: 10000,
                    inventory: [],
                    shipments: [],
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Bot_${Math.random()}`,
                    clientSeed: 'bot-seed',
                    nonce: 0,
                };

                const newPlayers = [...activeBattle.players];
                const emptyIndex = newPlayers.findIndex(p => p === null);

                if (emptyIndex !== -1) {
                    newPlayers[emptyIndex] = botUser;

                    const isNowFull = newPlayers.every(p => p !== null);
                    const updatedBattle: Battle = {
                        ...activeBattle,
                        players: newPlayers,
                        status: isNowFull ? 'ACTIVE' : 'WAITING'
                    };

                    setActiveBattle(updatedBattle);
                    setBattles(prev => prev.map(b => b.id === updatedBattle.id ? updatedBattle : b));
                }

            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [view.page, activeBattle, user]);

    const handleJoinBattle = (battleId: string) => {
        if (!user) { handleLogin(false); return; }

        const target = battles.find(b => b.id === battleId);
        if (!target) return;

        if (target.players.some(p => p?.id === user.id)) {
            setActiveBattle(target);
            setView({ page: 'BATTLE_ARENA' });
            return;
        }

        const emptyIndex = target.players.findIndex(p => p === null);
        if (emptyIndex === -1) return;

        const cost = target.price * target.roundCount;
        if (user.balance < cost) {
            setShowDeposit(true);
            return;
        }

        setUser({ ...user, balance: user.balance - cost });

        const updatedBattles = battles.map(b => {
            if (b.id === battleId) {
                const newPlayers = [...b.players];
                newPlayers[emptyIndex] = user;
                const isNowFull = newPlayers.every(p => p !== null);
                return {
                    ...b,
                    players: newPlayers,
                    status: isNowFull ? 'ACTIVE' : 'WAITING'
                } as Battle;
            }
            return b;
        });

        setBattles(updatedBattles);
        const updatedBattle = updatedBattles.find(b => b.id === battleId);
        if (updatedBattle) {
            setActiveBattle(updatedBattle);
            setView({ page: 'BATTLE_ARENA' });
        }
    };

    const handleWatchBattle = (battle: Battle) => {
        setActiveBattle(battle);
        setView({ page: 'BATTLE_ARENA' });
    };

    const handleBattleClaim = (amount: number) => {
        if (user) {
            setUser({ ...user, balance: user.balance + amount });
        }
        setView({ page: 'BATTLES' });
        setActiveBattle(null);
    };

    const handleReskinBox = async () => {
        if (!selectedBox) return;
        setIsReskinning(true);
        const newImage = await generateBoxImage(selectedBox.name, selectedBox.description, selectedBox.color.split(' ')[1].replace('to-', ''));
        if (newImage) {
            const updatedBox = { ...selectedBox, image: newImage };
            setSelectedBox(updatedBox);
            setBoxes(prev => prev.map(b => b.id === selectedBox.id ? updatedBox : b));
        }
        setIsReskinning(false);
    };

    const handleUpdateUsername = async () => {
        if (!user || !newUsername.trim()) return;

        await updateUserState(user.id, { username: newUsername.trim() });
        const updatedUser = await getUser(user.id);
        setUser(updatedUser);
        setIsEditingName(false);
    };

    const filteredBoxes = boxes.filter(box => {
        const matchesCategory = activeCategory === 'ALL' || box.category === activeCategory;
        const matchesSearch = box.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleBoxClick = (box: LootBox) => {
        setSelectedBox(box);
        setView({ page: 'BOX_DETAIL' });
    };

    const CATEGORIES: { id: BoxCategory; label: string }[] = [
        { id: 'ALL', label: 'All Boxes' },
        { id: 'STREETWEAR', label: 'Streetwear' },
        { id: 'TECH', label: 'Tech & Gaming' },
        { id: 'POKEMON', label: 'Pokemon' },
        { id: 'GIFT_CARDS', label: 'Gift Cards' },
        { id: 'CRYPTO', label: 'Crypto' },
        { id: 'SPORTS', label: 'Sports' },
    ];

    return (
        <div className="min-h-screen bg-[#0b0f19] text-white font-sans selection:bg-purple-500/30">

            {view.page !== 'OPENING' && view.page !== 'BATTLE_ARENA' && <StatsHeader />}

            {/* Centered Balance Animation Overlay */}
            {balanceIncrease && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="animate-[float-up-center_2s_ease-out_forwards] flex flex-col items-center">
                        <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300 drop-shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                            +${balanceIncrease.toFixed(2)}
                        </div>
                        <div className="text-emerald-200 font-bold text-xl mt-2 animate-pulse">
                            BALANCE UPDATED
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes float-up-center {
                    0% { opacity: 0; transform: scale(0.5) translateY(50px); }
                    20% { opacity: 1; transform: scale(1.2) translateY(0); }
                    40% { transform: scale(1); }
                    80% { opacity: 1; transform: translateY(-50px); }
                    100% { opacity: 0; transform: translateY(-100px); }
                }
            `}</style>

            <Navbar
                user={user}
                onLogin={() => setShowAuth(true)}
                onLogout={() => setUser(null)}
                onDeposit={() => setShowDeposit(true)}
                onWithdraw={() => setShowWithdraw(true)}
                onHome={() => setView({ page: 'HOME' })}
                onProfile={() => setView({ page: 'PROFILE' })}
                onBattles={() => setView({ page: 'BATTLES' })}
                onRaces={() => setView({ page: 'RACES' })}
                onAffiliates={() => setView({ page: 'AFFILIATES' })}
                onAdmin={() => setView({ page: 'ADMIN' })}
                balanceIncrease={balanceIncrease}
                onBalanceAnimationComplete={() => setBalanceIncrease(null)}
            />



            <div className="pt-20 flex min-h-screen">

                {/* Main Content Area - Push right on XL screens to make room for sidebar */}
                <div className="flex-1 w-full xl:mr-[300px] transition-all duration-300">
                    {view.page === 'AFFILIATES' ? (
                        <AffiliatesPage user={user} onBack={() => setView({ page: 'HOME' })} />
                    ) : view.page === 'ADMIN' ? (
                        <AdminPanel />
                    ) : view.page === 'UPLOAD' ? (
                        <ImageUploader />
                    ) : view.page === 'RACES' ? (
                        <RacePage />
                    ) : view.page === 'BATTLE_ARENA' && activeBattle ? (
                        <BattleArena
                            battle={activeBattle}
                            user={user}
                            onBack={() => {
                                setActiveBattle(null);
                                setView({ page: 'BATTLES' });
                            }}
                            onClaim={handleBattleClaim}
                        />
                    ) : view.page === 'BATTLES' ? (
                        <BattleLobby
                            battles={battles}
                            user={user}
                            onJoin={handleJoinBattle}
                            onCreate={initiateCreateBattle}
                            onWatch={handleWatchBattle}
                        />
                    ) : view.page === 'HOME' ? (
                        <main className="pb-12">


                            <div className="max-w-[1400px] mx-auto px-4 md:px-8 mt-8">

                                <section className="relative rounded-3xl overflow-hidden bg-[#131b2e] min-h-[400px] flex items-center border border-white/5 mb-12 group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 z-0"></div>
                                    <div className="absolute right-0 top-0 w-full md:w-2/3 h-full bg-[url('https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=1200&auto=format&fit=crop&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay group-hover:scale-105 transition-transform duration-[20s]"></div>

                                    <div className="relative z-10 p-12 max-w-2xl">
                                        <span className="inline-block py-1 px-3 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-bold tracking-widest mb-6">
                                            PROVABLY FAIR GAMING
                                        </span>
                                        <h1 className="font-display text-6xl md:text-7xl font-bold leading-tight mb-6 text-white drop-shadow-2xl">
                                            UNBOX THE <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">VIBE</span>
                                        </h1>
                                        <p className="text-slate-300 text-lg mb-8 leading-relaxed max-w-md drop-shadow-md">
                                            Open mystery boxes containing real-world items, crypto, and exclusive collectibles. Authenticated on the Bitcoin blockchain.
                                        </p>

                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <button onClick={() => setView({ page: 'BATTLES' })} className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg shadow-red-900/50 clip-path-slant flex items-center justify-center gap-2">
                                                ENTER PVP ARENA
                                            </button>

                                            {!user && (
                                                <button
                                                    onClick={() => handleLogin(true)} // Trigger Welcome Spin
                                                    className="bg-white hover:bg-slate-200 text-black px-8 py-4 rounded-xl font-bold transition-all shadow-lg shadow-white/20 flex items-center justify-center gap-2"
                                                >
                                                    <Gift className="w-5 h-5 text-purple-600" />
                                                    CLAIM FREE BOX
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 sticky top-20 z-30 bg-[#0b0f19]/95 backdrop-blur-xl py-4 border-b border-white/5 -mx-4 px-4 md:mx-0 md:px-0">
                                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setActiveCategory(cat.id)}
                                                className={`
                                    px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all
                                    ${activeCategory === cat.id
                                                        ? 'bg-white text-black shadow-lg shadow-white/10 scale-105'
                                                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}
                                `}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative w-full md:w-auto">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input
                                            type="text"
                                            placeholder="Search boxes..."
                                            className="bg-[#131b2e] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500 w-full md:w-64 transition-all focus:bg-[#1a2336]"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                    {filteredBoxes.map(box => (
                                        <div
                                            key={box.id}
                                            onClick={() => handleBoxClick(box)}
                                            className="group bg-[#131b2e] rounded-xl border border-white/5 overflow-hidden cursor-pointer hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] hover:border-white/10 transition-all duration-300 relative"
                                        >
                                            <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                                                {box.tags?.map(tag => (
                                                    <span key={tag} className={`
                                        text-[10px] font-bold px-2 py-0.5 rounded shadow-lg backdrop-blur-md
                                        ${tag === 'HOT' ? 'bg-orange-500/90 text-white' : ''}
                                        ${tag === 'NEW' ? 'bg-emerald-500/90 text-white' : ''}
                                        ${tag === 'SALE' ? 'bg-red-500/90 text-white' : ''}
                                        ${tag === 'FEATURED' ? 'bg-purple-500/90 text-white' : ''}
                                    `}>{tag}</span>
                                                ))}
                                            </div>

                                            <div className="aspect-square relative p-6 flex items-center justify-center bg-gradient-to-b from-[#1a2336] to-[#131b2e] overflow-hidden">
                                                <div className={`absolute inset-0 bg-gradient-to-br ${box.color} opacity-0 group-hover:opacity-30 transition-opacity duration-500`}></div>
                                                <img
                                                    src={box.image}
                                                    alt={box.name}
                                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out drop-shadow-2xl"
                                                />
                                            </div>

                                            <div className="p-4 border-t border-white/5 bg-[#131b2e] relative z-20">
                                                <h3 className="font-bold text-slate-200 truncate group-hover:text-purple-400 transition-colors">{box.name}</h3>
                                                <div className="flex items-center justify-between mt-2">
                                                    <div className="flex flex-col">
                                                        {box.salePrice ? (
                                                            <>
                                                                <span className="text-[10px] text-slate-500 line-through">${box.price?.toFixed(2) || '0.00'}</span>
                                                                <span className="text-emerald-400 font-mono font-bold">${box.salePrice?.toFixed(2) || '0.00'}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-emerald-400 font-mono font-bold">${box.price?.toFixed(2) || '0.00'}</span>
                                                        )}
                                                    </div>
                                                    <button className="bg-white/5 hover:bg-white/20 p-2 rounded-lg text-slate-400 hover:text-white transition-colors">
                                                        <Package className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </main>
                    ) : view.page === 'BOX_DETAIL' && selectedBox ? (
                        <div className="max-w-6xl mx-auto px-4 animate-in fade-in zoom-in-95 duration-300 pt-8 pb-16">
                            <button onClick={() => setView({ page: 'HOME' })} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 group">
                                <div className="bg-white/5 p-2 rounded-lg group-hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></div>
                                <span className="font-medium text-sm">Back to Market</span>
                            </button>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-4 flex flex-col gap-6">
                                    <div className="bg-[#131b2e] rounded-3xl p-8 border border-white/5 relative overflow-hidden text-center group shadow-2xl">
                                        <div className={`absolute inset-0 bg-gradient-to-br ${selectedBox.color} opacity-10`}></div>
                                        <div className={`absolute inset-0 blur-3xl opacity-20 bg-gradient-to-br ${selectedBox.color}`}></div>

                                        <div className="relative w-64 h-64 mx-auto mb-6 z-10">
                                            <img src={selectedBox.image} className="w-full h-full object-cover rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-[float_4s_ease-in-out_infinite]" />
                                        </div>

                                        <h1 className="relative z-10 font-display text-4xl font-bold mb-2 uppercase tracking-wide text-white drop-shadow-lg">{selectedBox.name}</h1>
                                        <p className="relative z-10 text-slate-400 text-sm mb-6 max-w-xs mx-auto">{selectedBox.description}</p>

                                        <div className="relative z-10 bg-[#0b0f19]/80 backdrop-blur rounded-2xl p-4 border border-white/10 mb-6 shadow-inner">
                                            <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Price per box</div>
                                            <div className="text-4xl font-mono font-bold text-emerald-400 drop-shadow">
                                                ${(selectedBox.salePrice || selectedBox.price).toFixed(2)}
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleOpenBox}
                                            className="relative z-20 w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-[0_0_30px_rgba(147,51,234,0.3)] transition-all transform active:scale-95 border-t border-white/10"
                                        >
                                            {user ? 'OPEN NOW' : 'SIGN IN TO OPEN'}
                                        </button>

                                        <button
                                            onClick={handleDemoOpen}
                                            className="relative z-20 w-full mt-3 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold py-3 rounded-xl border border-white/10 transition-all transform active:scale-95"
                                        >
                                            \ud83c\udfae TRY FOR FREE
                                        </button>
                                    </div>

                                    <div className="bg-[#131b2e] rounded-3xl p-6 border border-white/5 relative overflow-hidden">
                                        <div className="flex items-center gap-2 text-white font-bold mb-4">
                                            <Shield className="w-5 h-5 text-emerald-400" /> PROVABLY FAIR
                                        </div>
                                        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                                            We use the latest <span className="text-white">Bitcoin Block Hash</span> to generate a truly random number (0.00-1.00) that determines your prize. This cannot be manipulated.
                                        </p>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] text-slate-500 font-mono uppercase">
                                                <span>0.00</span>
                                                <span>Probability Distribution</span>
                                                <span>1.00</span>
                                            </div>
                                            <div className="h-4 w-full rounded-full flex overflow-hidden">
                                                <div className="h-full bg-slate-500" style={{ width: '60%' }} title="Common (60%)"></div>
                                                <div className="h-full bg-blue-500" style={{ width: '25%' }} title="Uncommon (25%)"></div>
                                                <div className="h-full bg-purple-500" style={{ width: '10%' }} title="Rare (10%)"></div>
                                                <div className="h-full bg-yellow-500" style={{ width: '5%' }} title="Legendary (5%)"></div>
                                            </div>
                                            <div className="text-[10px] text-center text-slate-500 pt-2">
                                                Hash → Hex → Decimal → Your Prize
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-8">
                                    <div className="bg-[#131b2e]/50 backdrop-blur rounded-3xl p-6 border border-white/5 h-full">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="font-display text-xl font-bold flex items-center gap-2">
                                                <Package className="text-purple-500" />
                                                BOX CONTENTS
                                                <span className="text-slate-500 text-sm font-sans font-normal ml-2">({selectedBox.items.length} items)</span>
                                            </h2>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                            {selectedBox.items.sort((a, b) => b.value - a.value).map(item => (
                                                <div key={item.id} className={`
                                            group relative rounded-xl border bg-[#0b0f19] flex flex-col items-center text-center transition-all hover:bg-[#131b2e] hover:-translate-y-1 shadow-lg overflow-hidden
                                            ${RARITY_COLORS[item.rarity]}
                                        `}>
                                                    <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${RARITY_GRADIENTS[item.rarity]} z-10`}></div>
                                                    <div className="absolute top-2 right-2 text-[10px] font-bold text-white bg-black/80 border border-white/10 px-2 py-1 rounded shadow-lg z-20">{item.odds}%</div>

                                                    <div className="w-full h-48 p-4 flex items-center justify-center bg-gradient-to-b from-transparent to-black/20">
                                                        <LazyImage
                                                            src={item.image}
                                                            alt={item.name}
                                                            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-2xl"
                                                        />
                                                    </div>

                                                    <div className="w-full relative z-10 p-3 bg-[#0b0f19] border-t border-white/5">
                                                        <div className="text-sm font-bold leading-tight mb-1 line-clamp-2 text-slate-200 group-hover:text-white h-10 flex items-center justify-center">{item.name}</div>
                                                        <div className="text-xs font-mono text-emerald-500">${item.value.toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : view.page === 'OPENING' && selectedBox ? (
                        <OpeningStage
                            key={rollResult?.randomValue || Date.now()} // Force new instance per opening
                            box={selectedBox}
                            winner={rollResult?.item || null}
                            onBack={() => {
                                setView({ page: 'BOX_DETAIL' });
                                setIsDemoMode(false);
                            }}
                            onComplete={handleAnimationComplete}
                            isOpening={isOpening}
                            rollResult={rollResult}
                        />
                    ) : view.page === 'PROFILE' && user ? (
                        <div className="max-w-6xl mx-auto px-4 pt-8">
                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="w-full md:w-1/3 bg-[#131b2e] rounded-2xl p-6 border border-white/5 sticky top-24">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="relative mb-4">
                                            <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 rounded-full"></div>
                                            <img src={user.avatar} className="relative w-24 h-24 rounded-full border-4 border-[#0b0f19] shadow-xl" />
                                        </div>

                                        {isEditingName ? (
                                            <div className="flex items-center gap-2 mb-2">
                                                <input
                                                    type="text"
                                                    value={newUsername}
                                                    onChange={(e) => setNewUsername(e.target.value)}
                                                    className="bg-[#0b0f19] border border-white/20 rounded px-2 py-1 text-white font-bold text-center w-40 focus:outline-none focus:border-purple-500"
                                                    autoFocus
                                                />
                                                <button onClick={handleUpdateUsername} className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 p-1 rounded transition-colors">
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setIsEditingName(false)} className="bg-red-500/20 hover:bg-red-500/40 text-red-400 p-1 rounded transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mb-2 group">
                                                <h2 className="text-2xl font-bold">{user.username}</h2>
                                                <button
                                                    onClick={() => {
                                                        setNewUsername(user.username);
                                                        setIsEditingName(true);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-all"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-slate-500 text-sm mb-6">Member since 2024</p>

                                        <div className="grid grid-cols-2 gap-4 w-full mb-6">
                                            <div className="bg-[#0b0f19] p-3 rounded-xl border border-white/5">
                                                <div className="text-xs text-slate-500 uppercase">Total Wagered</div>
                                                <div className="font-mono font-bold text-white">$12,450</div>
                                            </div>
                                            <div className="bg-[#0b0f19] p-3 rounded-xl border border-white/5">
                                                <div className="text-xs text-slate-500 uppercase">Total Profit</div>
                                                <div className="font-mono font-bold text-emerald-400">+$2,100</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full md:w-2/3">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-bold flex items-center gap-2"><Package /> Inventory</h3>
                                        {user.inventory.length > 0 && (
                                            <button
                                                onClick={() => handleShipItems(user.inventory)}
                                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all"
                                            >
                                                <Truck className="w-4 h-4" />
                                                Ship All Items
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {user.inventory.map((item, i) => (
                                            <div key={i} className={`p-4 rounded-xl border bg-[#131b2e] ${RARITY_COLORS[item.rarity]} group hover:-translate-y-1 transition-transform relative`}>
                                                <button
                                                    onClick={() => handleShipItems([item])}
                                                    className="absolute top-2 right-2 bg-purple-600 hover:bg-purple-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                    title="Ship this item"
                                                >
                                                    <Truck className="w-3 h-3" />
                                                </button>
                                                <img src={item.image} className="w-full aspect-square object-contain mb-2 group-hover:scale-105 transition-transform" />
                                                <div className="text-sm font-bold truncate">{item.name}</div>
                                                <div className="text-xs font-mono opacity-70">${item.value}</div>
                                            </div>
                                        ))}
                                        {user.inventory.length === 0 && (
                                            <div className="col-span-full py-16 text-center text-slate-500 border border-dashed border-white/10 rounded-xl bg-[#131b2e]/50">
                                                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p>Your inventory is empty.</p>
                                                <button onClick={() => setView({ page: 'HOME' })} className="text-purple-400 hover:text-white mt-2 text-sm">Open some boxes!</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Live Sidebar - Hidden on small screens, fixed on right for large screens */}
                <LiveSidebar />

            </div>

            {/* Create Battle Modal */}
            {showCreateBattle && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#131b2e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#131b2e] z-10 sticky top-0">
                            <h2 className="text-xl font-bold font-display">Create Battle</h2>
                            <button onClick={() => setShowCreateBattle(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        {/* SETTINGS SELECTOR */}
                        <div className="px-6 pt-6 pb-2">
                            {/* Team Size */}
                            <div>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-3">Team Size</div>
                                <div className="flex gap-2">
                                    {[2, 4, 6].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setBattlePlayerCount(mode as any)}
                                            className={`
                                        flex-1 py-3 rounded-xl border font-bold text-sm transition-all
                                        ${battlePlayerCount === mode
                                                    ? 'bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]'
                                                    : 'bg-[#0b0f19] border-white/10 text-slate-400 hover:border-white/20'
                                                }
                                    `}
                                        >
                                            {mode === 2 ? '1 v 1' : mode === 4 ? '2 v 2' : '3 v 3'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {boxes.map(box => (
                                <button
                                    key={box.id}
                                    onClick={() => finalizeCreateBattle(box)}
                                    className="bg-[#0b0f19] border border-white/5 rounded-xl p-4 hover:border-purple-500 hover:bg-purple-500/5 transition-all flex flex-col items-center gap-3 group"
                                >
                                    <img src={box.image} className="w-20 h-20 object-cover rounded-lg group-hover:scale-105 transition-transform" />
                                    <div className="text-center">
                                        <div className="font-bold text-sm truncate w-full">{box.name}</div>
                                        <div className="text-emerald-400 font-mono text-xs font-bold">${(box.salePrice || box.price).toFixed(2)}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Result Modal */}
            {showResultModal && rollResult && selectedBox && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className={`relative bg-[#0b0f19] rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-300 border border-white/10`}>

                        <div className={`absolute -top-32 -left-32 w-64 h-64 rounded-full blur-[100px] opacity-20 ${RARITY_BG[rollResult.item.rarity]}`}></div>
                        <div className={`absolute -bottom-32 -right-32 w-64 h-64 rounded-full blur-[100px] opacity-20 ${RARITY_BG[rollResult.item.rarity]}`}></div>

                        <div className="relative z-10 p-2">
                            <div className="bg-[#131b2e]/80 backdrop-blur-xl rounded-[28px] p-6 border border-white/5 overflow-hidden">
                                <div className="flex justify-center mb-8">
                                    <div className={`
                                px-4 py-1.5 rounded-full text-xs font-extrabold tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/10
                                ${RARITY_BG[rollResult.item.rarity]} text-white
                           `}>
                                        {rollResult.item.rarity} DROP
                                    </div>
                                </div>

                                <div className="relative w-64 h-64 mx-auto mb-6">
                                    <div className={`absolute inset-0 bg-gradient-to-tr ${RARITY_GRADIENTS[rollResult.item.rarity]} rounded-full blur-[60px] opacity-30 animate-pulse`}></div>
                                    <img src={rollResult.item.image} className="relative w-full h-full object-contain animate-[float_4s_ease-in-out_infinite] drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]" />
                                </div>

                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-display font-bold text-white mb-2 leading-tight drop-shadow-lg">{rollResult.item.name}</h2>
                                    <div className="text-4xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 drop-shadow-sm">
                                        ${rollResult.item.value.toFixed(2)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    {!isDemoMode ? (
                                        <>
                                            <button
                                                onClick={handleSellItem}
                                                className="group relative overflow-hidden bg-[#0b0f19] hover:bg-red-500/10 border border-white/10 hover:border-red-500/50 rounded-2xl py-4 transition-all duration-300"
                                            >
                                                <div className="flex flex-col items-center gap-1 relative z-10">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide group-hover:text-red-400 transition-colors">Exchange For</span>
                                                    <span className="flex items-center gap-1 font-mono font-bold text-lg group-hover:text-white transition-colors">
                                                        <DollarSign className="w-4 h-4 text-emerald-500" /> {rollResult.item.value}
                                                    </span>
                                                </div>
                                            </button>

                                            <button
                                                onClick={handleKeepItem}
                                                className="group relative overflow-hidden bg-white hover:bg-slate-200 text-black rounded-2xl py-4 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                                            >
                                                <div className="flex flex-col items-center gap-1 relative z-10">
                                                    <span className="text-[10px] font-bold opacity-60 uppercase tracking-wide">Add To Inventory</span>
                                                    <span className="flex items-center gap-2 font-bold text-lg">
                                                        Collect <Check className="w-4 h-4" />
                                                    </span>
                                                </div>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => {
                                                    resetOpenState();
                                                    setIsDemoMode(false);
                                                    handleOpenBox();
                                                }}
                                                className="col-span-2 group relative overflow-hidden bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl py-4 transition-all duration-300 shadow-[0_0_30px_rgba(147,51,234,0.3)]"
                                            >
                                                <div className="flex flex-col items-center gap-1 relative z-10">
                                                    <span className="text-[10px] font-bold opacity-80 uppercase tracking-wide">That was a demo!</span>
                                                    <span className="flex items-center gap-2 font-bold text-lg">
                                                        PLAY FOR REAL <Trophy className="w-4 h-4" />
                                                    </span>
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    resetOpenState();
                                                    setIsDemoMode(false);
                                                    setView({ page: 'HOME' });
                                                }}
                                                className="col-span-2 mt-2 text-xs text-slate-500 hover:text-white transition-colors uppercase font-bold tracking-widest py-2"
                                            >
                                                Exit Demo
                                            </button>
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={() => { handleSellItem(); handleOpenBox(); }}
                                    className="w-full bg-[#2a213e] hover:bg-[#3b2d5a] border border-purple-500/30 rounded-xl py-3 flex items-center justify-between px-4 transition-all group"
                                >
                                    <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                                        <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                                        <span>SPIN AGAIN</span>
                                    </div>
                                    <div className="font-mono font-bold text-white bg-black/30 px-2 py-1 rounded">
                                        ${(selectedBox.salePrice || selectedBox.price).toFixed(2)}
                                    </div>
                                </button>

                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            {
                showAuth && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
                        <div className="bg-[#131b2e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-600/20">
                                    <Package className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold mb-2">Welcome to LootVibe</h2>
                                <p className="text-slate-400 mb-8">Sign in to start unboxing rare items.</p>

                                <button onClick={confirmLogin} className="w-full bg-[#24292e] hover:bg-[#2f363d] text-white font-bold py-3 rounded-xl mb-3 flex items-center justify-center gap-3 transition-colors border border-white/5">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-1.334 5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                    Continue with GitHub (Clerk)
                                </button>
                                <button onClick={confirmLogin} className="w-full bg-white hover:bg-slate-200 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-3 transition-colors">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                    Continue with Google (Clerk)
                                </button>
                                <button onClick={() => setShowAuth(false)} className="mt-6 text-sm text-slate-500 hover:text-white">Cancel</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showDeposit && (
                    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div className="bg-[#131b2e] border border-white/10 rounded-2xl w-full max-w-lg p-0 overflow-hidden shadow-2xl relative">
                                <div className="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#131b2e] z-10">
                                    <h2 className="text-xl font-bold font-display">Deposit Funds</h2>
                                    <button onClick={() => setShowDeposit(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                                </div>

                                <div className="p-6 grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => {
                                            setSelectedCrypto('BTC');
                                            setShowDeposit(false);
                                            setShowCryptoDeposit(true);
                                        }}
                                        className="flex flex-col items-center justify-center p-6 rounded-xl border bg-[#0b0f19] border-white/10 text-slate-400 hover:bg-orange-500/10 hover:border-orange-500 hover:text-white transition-all gap-3"
                                    >
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-800 text-slate-400"><Bitcoin className="w-6 h-6" /></div>
                                        <div className="font-bold">Bitcoin</div>
                                        <div className="text-xs text-slate-500">BTC</div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedCrypto('ETH');
                                            setShowDeposit(false);
                                            setShowCryptoDeposit(true);
                                        }}
                                        className="flex flex-col items-center justify-center p-6 rounded-xl border bg-[#0b0f19] border-white/10 text-slate-400 hover:bg-blue-500/10 hover:border-blue-500 hover:text-white transition-all gap-3"
                                    >
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-800 text-slate-400"><div className="font-bold text-lg">Ξ</div></div>
                                        <div className="font-bold">Ethereum</div>
                                        <div className="text-xs text-slate-500">ETH</div>
                                    </button>
                                </div>

                                <div className="p-6 bg-[#0b0f19] border-t border-white/5">
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
                                        <div className="text-xs font-bold text-blue-400 mb-2">💡 Real Crypto Deposits</div>
                                        <div className="text-xs text-slate-400">
                                            Select a cryptocurrency above to get your unique deposit address. Funds are automatically credited after confirmations.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Provably Fair Modal */}
            {
                user && (
                    <ProvablyFairModal
                        isOpen={showProvablyFair}
                        onClose={() => setShowProvablyFair(false)}
                        user={user}
                    />
                )
            }

            {/* Shipping Modal */}
            {
                showShipping && (
                    <ShippingModal
                        items={selectedItemsToShip}
                        onClose={() => {
                            setShowShipping(false);
                            setSelectedItemsToShip([]);
                        }}
                        onSubmit={handleShipmentSubmit}
                    />
                )
            }

            {/* Crypto Deposit Modal */}
            {
                user && (
                    <CryptoDepositModal
                        isOpen={showCryptoDeposit}
                        onClose={() => setShowCryptoDeposit(false)}
                        userId={user.id}
                        currency={selectedCrypto}
                    />
                )
            }

            {/* Withdraw Modal */}
            {
                user && (
                    <WithdrawModal
                        isOpen={showWithdraw}
                        onClose={() => setShowWithdraw(false)}
                        user={user}
                    />
                )
            }

            {/* Provably Fair Button */}

            {/* Floating Provably Fair Button (Bottom Left) */}
            {
                user && (
                    <button
                        onClick={() => setShowProvablyFair(true)}
                        className="fixed bottom-4 left-4 z-40 bg-[#131b2e]/80 backdrop-blur border border-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-105"
                    >
                        <Shield className="w-4 h-4 text-emerald-500" /> PROVABLY FAIR
                    </button>
                )
            }

        </div >
    );
}
