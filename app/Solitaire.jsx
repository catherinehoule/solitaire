'use client';
import { useState, useCallback, useEffect } from "react";

// --- Constants ---
const SUITS = ["♠", "♥", "♦", "♣"];
const SUIT_COLORS = { "♠": "black", "♣": "black", "♥": "red", "♦": "red" };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_VALUES = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));

// --- Deck helpers ---
function createDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank, id: `${rank}${suit}`, faceUp: false });
  return deck;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function dealGame() {
  const deck = shuffle(createDeck());
  const tableau = Array.from({ length: 7 }, () => []);
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[idx++], faceUp: row === col };
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(idx).map(c => ({ ...c, faceUp: false }));
  return { tableau, stock, waste: [], foundations: [[], [], [], []] };
}

// --- Game logic ---
function canPlaceOnFoundation(card, foundation) {
  if (foundation.length === 0) return card.rank === "A";
  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && RANK_VALUES[card.rank] === RANK_VALUES[top.rank] + 1;
}

function canPlaceOnTableau(card, column) {
  if (column.length === 0) return card.rank === "K";
  const top = column[column.length - 1];
  if (!top.faceUp) return false;
  return SUIT_COLORS[card.suit] !== SUIT_COLORS[top.suit] &&
    RANK_VALUES[card.rank] === RANK_VALUES[top.rank] - 1;
}

function foundationIndexForCard(card, foundations) {
  for (let i = 0; i < 4; i++) {
    if (canPlaceOnFoundation(card, foundations[i])) return i;
  }
  return -1;
}

function autoMoveCard(state, cardId, fromZone, fromIndex) {
  const { tableau, waste, foundations } = state;

  let card, newState;

  if (fromZone === "waste") {
    card = waste[waste.length - 1];
    if (!card || card.id !== cardId) return null;
  } else if (fromZone === "tableau") {
    const col = tableau[fromIndex];
    const cardIdx = col.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return null;
    // Only allow moving a single face-up card or a stack
    if (!col[cardIdx].faceUp) return null;
    card = col[cardIdx];
    const stack = col.slice(cardIdx);
    // Multi-card moves can only go to tableau
    if (stack.length > 1) {
      for (let t = 0; t < 7; t++) {
        if (t === fromIndex) continue;
        if (canPlaceOnTableau(stack[0], tableau[t])) {
          const newTableau = tableau.map(c => [...c]);
          newTableau[fromIndex] = col.slice(0, cardIdx);
          if (newTableau[fromIndex].length > 0) {
            const last = newTableau[fromIndex][newTableau[fromIndex].length - 1];
            if (!last.faceUp) newTableau[fromIndex][newTableau[fromIndex].length - 1] = { ...last, faceUp: true };
          }
          newTableau[t] = [...newTableau[t], ...stack];
          return { ...state, tableau: newTableau };
        }
      }
      return null;
    }
  } else {
    return null;
  }

  // Try foundation first (single card)
  const fi = foundationIndexForCard(card, foundations);
  if (fi !== -1) {
    const newFoundations = foundations.map(f => [...f]);
    newFoundations[fi] = [...newFoundations[fi], { ...card, faceUp: true }];
    if (fromZone === "waste") {
      return { ...state, waste: waste.slice(0, -1), foundations: newFoundations };
    } else {
      const col = tableau[fromIndex];
      const cardIdx = col.findIndex(c => c.id === cardId);
      const newTableau = tableau.map(c => [...c]);
      newTableau[fromIndex] = col.slice(0, cardIdx);
      if (newTableau[fromIndex].length > 0) {
        const last = newTableau[fromIndex][newTableau[fromIndex].length - 1];
        if (!last.faceUp) newTableau[fromIndex][newTableau[fromIndex].length - 1] = { ...last, faceUp: true };
      }
      return { ...state, tableau: newTableau, foundations: newFoundations };
    }
  }

  // Try tableau
  for (let t = 0; t < 7; t++) {
    if (fromZone === "tableau" && t === fromIndex) continue;
    if (canPlaceOnTableau(card, tableau[t])) {
      const newTableau = tableau.map(c => [...c]);
      if (fromZone === "waste") {
        newTableau[t] = [...newTableau[t], { ...card, faceUp: true }];
        return { ...state, waste: waste.slice(0, -1), tableau: newTableau };
      } else {
        const col = tableau[fromIndex];
        const cardIdx = col.findIndex(c => c.id === cardId);
        newTableau[fromIndex] = col.slice(0, cardIdx);
        if (newTableau[fromIndex].length > 0) {
          const last = newTableau[fromIndex][newTableau[fromIndex].length - 1];
          if (!last.faceUp) newTableau[fromIndex][newTableau[fromIndex].length - 1] = { ...last, faceUp: true };
        }
        newTableau[t] = [...newTableau[t], { ...card, faceUp: true }];
        return { ...state, tableau: newTableau };
      }
    }
  }

  return null;
}

function findHint(state) {
  const { tableau, waste, foundations } = state;
  // Check waste top
  if (waste.length > 0) {
    const card = waste[waste.length - 1];
    if (foundationIndexForCard(card, foundations) !== -1) return `Jouer ${card.rank}${card.suit} sur la fondation`;
    for (let t = 0; t < 7; t++) {
      if (canPlaceOnTableau(card, tableau[t])) return `Jouer ${card.rank}${card.suit} sur la colonne ${t + 1}`;
    }
  }
  // Check tableau
  for (let col = 0; col < 7; col++) {
    const column = tableau[col];
    for (let row = 0; row < column.length; row++) {
      const card = column[row];
      if (!card.faceUp) continue;
      const stack = column.slice(row);
      if (stack.length === 1) {
        if (foundationIndexForCard(card, foundations) !== -1) return `Jouer ${card.rank}${card.suit} sur la fondation`;
      }
      for (let t = 0; t < 7; t++) {
        if (t === col) continue;
        if (canPlaceOnTableau(stack[0], tableau[t])) {
          return `Déplacer ${stack[0].rank}${stack[0].suit} vers la colonne ${t + 1}`;
        }
      }
    }
  }
  return null;
}

function isWon(foundations) {
  return foundations.every(f => f.length === 13);
}

// --- Quebec City card back SVG ---
function QuebecBack({ w, h }) {
  return (
    <svg width={w} height={h} viewBox="0 0 48 68" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 5, display: "block" }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2a4a" />
          <stop offset="100%" stopColor="#2d5a8a" />
        </linearGradient>
        <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a3a5c" />
          <stop offset="100%" stopColor="#0f2a40" />
        </linearGradient>
      </defs>
      <rect width="48" height="68" fill="url(#sky)" rx="5" />
      <circle cx="8" cy="5" r="0.6" fill="white" opacity="0.8" />
      <circle cx="18" cy="3" r="0.5" fill="white" opacity="0.6" />
      <circle cx="30" cy="6" r="0.6" fill="white" opacity="0.7" />
      <circle cx="40" cy="4" r="0.5" fill="white" opacity="0.5" />
      <circle cx="5" cy="12" r="0.4" fill="white" opacity="0.5" />
      <circle cx="35" cy="10" r="0.5" fill="white" opacity="0.7" />
      <circle cx="43" cy="8" r="0.4" fill="white" opacity="0.6" />
      <circle cx="24" cy="7" r="0.4" fill="white" opacity="0.5" />
      <circle cx="42" cy="9" r="2.5" fill="#f0e68c" opacity="0.9" />
      <circle cx="44" cy="8" r="1.8" fill="#2d5a8a" opacity="0.95" />
      <path d="M0 42 Q8 28 16 30 Q20 26 24 24 Q28 22 32 26 Q38 24 48 32 L48 68 L0 68 Z" fill="#2c1f0f" />
      <rect x="15" y="26" width="18" height="16" fill="#8b4513" />
      <rect x="17" y="24" width="4" height="18" fill="#7a3a10" />
      <rect x="27" y="24" width="4" height="18" fill="#7a3a10" />
      <path d="M15 26 L17 19 L21 17 L21 26 Z" fill="#4a7c59" />
      <path d="M27 26 L28 19 L32 17 L33 26 Z" fill="#4a7c59" />
      <path d="M14 26 L24 21 L34 26 Z" fill="#5a8c69" />
      <rect x="13" y="28" width="3" height="8" fill="#9b5523" />
      <rect x="32" y="28" width="3" height="8" fill="#9b5523" />
      <path d="M13 28 L14.5 23 L16 28 Z" fill="#4a7c59" />
      <path d="M32 28 L33.5 23 L35 28 Z" fill="#4a7c59" />
      <rect x="19" y="28" width="2" height="3" fill="#f0d080" opacity="0.9" />
      <rect x="23" y="28" width="2" height="3" fill="#f0d080" opacity="0.9" />
      <rect x="27" y="28" width="2" height="3" fill="#c0a060" opacity="0.7" />
      <rect x="19" y="33" width="2" height="3" fill="#f0d080" opacity="0.8" />
      <rect x="23" y="33" width="2" height="3" fill="#c0a060" opacity="0.7" />
      <line x1="24" y1="21" x2="24" y2="15" stroke="#ccc" strokeWidth="0.5" />
      <rect x="24" y="15" width="5" height="3" fill="#003087" />
      <rect x="24" y="15" width="5" height="1" fill="white" />
      <rect x="0" y="52" width="48" height="16" fill="url(#river)" />
      <path d="M0 53 Q12 51 24 53 Q36 55 48 53" stroke="#4a8ab0" strokeWidth="0.8" fill="none" opacity="0.6" />
      <path d="M0 57 Q12 55 24 57 Q36 59 48 57" stroke="#4a8ab0" strokeWidth="0.6" fill="none" opacity="0.4" />
      <rect x="0" y="44" width="12" height="10" fill="#3d2b1a" />
      <rect x="36" y="45" width="12" height="9" fill="#3d2b1a" />
      <rect x="2" y="42" width="4" height="4" fill="#4a3525" />
      <rect x="7" y="43" width="3" height="3" fill="#4a3525" />
      <rect x="38" y="43" width="3" height="4" fill="#4a3525" />
      <rect x="43" y="44" width="3" height="3" fill="#4a3525" />
      <rect x="3" y="43" width="1.5" height="1.5" fill="#f0d080" opacity="0.8" />
      <rect x="8" y="44" width="1.5" height="1.5" fill="#f0d080" opacity="0.7" />
      <rect x="39" y="44" width="1.5" height="1.5" fill="#f0d080" opacity="0.8" />
      <rect x="44" y="45" width="1.5" height="1.5" fill="#f0d080" opacity="0.6" />
      <rect x="0" y="0" width="48" height="68" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" rx="5" />
    </svg>
  );
}

// --- Card Component ---
function Card({ card, onClick, small, stacked, dimmed }) {
  const isRed = SUIT_COLORS[card.suit] === "red";
  const w = small ? 44 : 56;
  const h = small ? 62 : 80;

  if (!card.faceUp) {
    return (
      <div
        onClick={onClick}
        style={{
          width: w, height: h,
          borderRadius: 5,
          cursor: onClick ? "pointer" : "default",
          flexShrink: 0,
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        <QuebecBack w={w} h={h} />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: w, height: h,
        borderRadius: 5,
        background: dimmed ? "#e8e0d4" : "#faf7f2",
        border: `1.5px solid ${dimmed ? "#c8bfb0" : "#d4c9b8"}`,
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: onClick ? "0 2px 6px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.2)",
        transition: "transform 0.1s, box-shadow 0.1s",
        userSelect: "none",
        position: "relative",
        gap: 1,
      }}
    >
      <div style={{ fontWeight: 800, lineHeight: 1, color: isRed ? "#c0392b" : "#1a1a2e", fontFamily: "'Georgia', serif", textAlign: "center", fontSize: small ? 22 : 30 }}>
        {card.rank}
      </div>
      <div style={{ lineHeight: 1, color: isRed ? "#c0392b" : "#1a1a2e", textAlign: "center", fontSize: small ? 20 : 26 }}>
        {card.suit}
      </div>
    </div>
  );
}

function EmptySlot({ label, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 56, height: 80,
        borderRadius: 5,
        border: "1.5px dashed rgba(255,255,255,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,255,255,0.3)",
        fontSize: 18,
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  );
}

// --- Main App ---
export default function Solitaire() {
  const [state, setState] = useState(() => dealGame());
  const [hint, setHint] = useState(null);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState(null);

  const showMessage = (msg, duration = 2000) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), duration);
  };

  const newGame = () => {
    setState(dealGame());
    setHint(null);
    setWon(false);
    setMessage(null);
  };

  const handleStock = () => {
    setState(prev => {
      if (prev.stock.length === 0) {
        if (prev.waste.length === 0) return prev;
        const newStock = [...prev.waste].reverse().map(c => ({ ...c, faceUp: false }));
        return { ...prev, stock: newStock, waste: [] };
      }
      const card = { ...prev.stock[prev.stock.length - 1], faceUp: true };
      return {
        ...prev,
        stock: prev.stock.slice(0, -1),
        waste: [...prev.waste, card],
      };
    });
    setHint(null);
  };

  const handleCardClick = useCallback((cardId, zone, index) => {
    setState(prev => {
      const result = autoMoveCard(prev, cardId, zone, index);
      if (result) {
        if (isWon(result.foundations)) {
          setWon(true);
        }
        setHint(null);
        return result;
      }
      showMessage("Déplacement impossible");
      return prev;
    });
  }, []);

  const handleHint = () => {
    const h = findHint(state);
    if (h) {
      setHint(h);
      setTimeout(() => setHint(null), 3000);
    } else {
      setHint(null);
      if (state.stock.length === 0 && state.waste.length === 0) {
        showMessage("Aucun mouvement possible — nouvelle partie ?", 3500);
      } else {
        showMessage("Essayez de retourner le talon !", 2500);
      }
    }
  };

  const suitSymbols = ["♠", "♥", "♦", "♣"];

  return (
    <div style={{
      width: "100vw", minHeight: "100vh",
      background: "linear-gradient(160deg, #1a6b42 0%, #145235 40%, #0e3d28 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "'Georgia', serif",
      paddingBottom: 24,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        width: "100%", maxWidth: 390,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, letterSpacing: 2, textTransform: "uppercase" }}>Solitaire</span>
        <button onClick={newGame} style={btnStyle}>
          Nouvelle
        </button>
      </div>

      {won && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }}>
          <div style={{ color: "#f5e6c0", fontSize: 38, marginBottom: 8 }}>🏆</div>
          <div style={{ color: "#f5e6c0", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Félicitations !</div>
          <div style={{ color: "rgba(245,230,192,0.7)", fontSize: 14, marginBottom: 24 }}>Vous avez gagné !</div>
          <button onClick={newGame} style={{ ...btnStyle, fontSize: 15, padding: "10px 28px" }}>Nouvelle partie</button>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 390, padding: "10px 10px 0", flex: 1 }}>
        {/* Top row: stock, waste, foundations */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "flex-start" }}>
          {/* Stock */}
          <div onClick={handleStock} style={{ cursor: "pointer", flexShrink: 0 }}>
            {state.stock.length > 0
              ? <Card card={{ suit: "♠", rank: "A", faceUp: false }} />
              : <EmptySlot label="↺" onClick={handleStock} />}
          </div>
          {/* Waste */}
          <div style={{ flexShrink: 0 }}>
            {state.waste.length > 0
              ? <Card
                  card={state.waste[state.waste.length - 1]}
                  onClick={() => handleCardClick(state.waste[state.waste.length - 1].id, "waste", -1)}
                />
              : <EmptySlot label="" />}
          </div>
          <div style={{ flex: 1, minWidth: 24 }} />
          {/* Foundations */}
          {state.foundations.map((f, i) => (
            <div key={i} style={{ flexShrink: 0 }}>
              {f.length > 0
                ? <Card card={f[f.length - 1]} />
                : <EmptySlot label={suitSymbols[i]} />}
            </div>
          ))}
        </div>

        {/* Tableau */}
        <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
          {state.tableau.map((col, ci) => (
            <div key={ci} style={{ flex: 1, position: "relative", minHeight: 68 }}>
              {col.length === 0
                ? <EmptySlot label="" />
                : col.map((card, ri) => (
                    <div
                      key={card.id}
                      style={{
                        position: ri === 0 ? "relative" : "absolute",
                        top: ri === 0 ? 0 : ri * (card.faceUp ? 22 : 14),
                        zIndex: ri,
                        left: 0,
                      }}
                    >
                      <Card
                        card={card}
                        small
                        onClick={card.faceUp ? () => handleCardClick(card.id, "tableau", ci) : undefined}
                      />
                    </div>
                  ))
              }
              {/* Invisible spacer to push container height */}
              {col.length > 0 && (
                <div style={{
                  height: (() => {
                    let h = 0;
                    col.forEach((c, i) => { h += i === 0 ? 0 : (c.faceUp ? 22 : 14); });
                    return h + 54;
                  })(),
                  visibility: "hidden",
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div style={{
        width: "100%", maxWidth: 390,
        padding: "10px 16px 20px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        marginTop: "auto",
      }}>
        {(message || hint) && (
          <div style={{
            background: hint ? "rgba(212,163,60,0.92)" : "rgba(20,20,30,0.85)",
            color: "#fff",
            fontSize: 13,
            padding: "7px 16px",
            borderRadius: 20,
            letterSpacing: 0.3,
            maxWidth: 300,
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}>
            {hint || message}
          </div>
        )}
        <button onClick={handleHint} style={{ ...btnStyle, width: "100%", maxWidth: 200, padding: "10px 0", fontSize: 14, textAlign: "center" }}>
          💡 Indice
        </button>
      </div>
    </div>
  );
}

const btnStyle = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "rgba(255,255,255,0.85)",
  borderRadius: 8,
  padding: "5px 12px",
  fontSize: 12,
  cursor: "pointer",
  letterSpacing: 0.5,
  fontFamily: "'Georgia', serif",
};
