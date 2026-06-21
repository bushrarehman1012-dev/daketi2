const { createDeck } = require('./deck');

const HIGH_CARDS = new Set(['K', 'Q', 'J', '10']);
function cardValue(card) {
  if (card.rank === 'A')         return 20;
  if (HIGH_CARDS.has(card.rank)) return 10;
  return 5;
}

class GameRoom {
  constructor(id) {
    this.id      = id;
    this.hostId  = null;
    this.players = [];
    this.deck    = [];
    this.floor   = [];
    this.phase   = 'lobby';
    this.currentPlayerIndex = 0;
    this.createdAt = Date.now();
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────

  addPlayer(socketId, name) {
    if (this.phase !== 'lobby') throw new Error('Game already in progress');
    if (this.players.length >= 6) throw new Error('Room is full (max 6)');
    if (this.players.find(p => p.id === socketId)) throw new Error('Already in room');
    const player = { id: socketId, name, hand: [], slots: [], score: 0 };
    this.players.push(player);
    if (this.players.length === 1) this.hostId = socketId;
    return player;
  }

  removePlayer(socketId) {
    this.players = this.players.filter(p => p.id !== socketId);
    if (this.players.length > 0 && this.hostId === socketId) this.hostId = this.players[0].id;
    if (this.currentPlayerIndex >= this.players.length) this.currentPlayerIndex = 0;
  }

  startGame(requesterId) {
    if (requesterId !== this.hostId) throw new Error('Only the host can start');
    if (this.players.length < 2)    throw new Error('Need at least 2 players');

    this.deck  = createDeck();
    this.floor = [];
    this.phase = 'playing';
    this.currentPlayerIndex = 0;

    for (const p of this.players) {
      p.hand  = this.deck.splice(0, 4);
      p.slots = [];
      p.score = 0;
    }
    this.floor = this.deck.splice(0, 4);
    this._startTurn(this.players[0]);
  }

  // ── Turn start ─────────────────────────────────────────────────────────────

  _startTurn(player) {
    if (!player || this.phase !== 'playing') return;
    if (!this._drawCard(player)) { this.phase = 'endgame'; return; }
    // Run implicit locks right after the draw so state is consistent on broadcast
    this._checkImplicitLocks();
  }

  // ── Action dispatch ────────────────────────────────────────────────────────

  handleAction(playerId, action) {
    if (this.phase === 'finished') throw new Error('Game is over');
    if (this.phase === 'lobby')    throw new Error('Game has not started');

    const current = this.getCurrentPlayer();
    if (!current || current.id !== playerId) throw new Error('Not your turn');

    const player = this.getPlayer(playerId);

    switch (action.type) {
      case 'PAIR':     this._pair(player, action.handCardId, action.floorCardId); break;
      case 'PAIR_OWN': this._pairOwn(player, action.handCardId); break;
      case 'STEAL':    this._steal(player, action.handCardId, action.targetPlayerId); break;
      case 'DROP':     this._drop(player, action.handCardId); break;
      default: throw new Error('Unknown action');
    }

    this._checkLocks(player);

    // ── Endgame branch: 1 action per turn, no draw ─────────────────────────
    if (this.phase === 'endgame') {
      this._endgameAfterAction();
      return;
    }

    // ── Normal branch ──────────────────────────────────────────────────────
    if (action.type === 'DROP') {
      this._advanceTurn();
      this._startTurn(this.getCurrentPlayer());
      if (this.phase === 'endgame') this._skipEmptyHands();
      return;
    }

    // PAIR / PAIR_OWN / STEAL: replenish to 5; if deck empty → endgame
    if (!this._drawCard(player)) {
      this.phase = 'endgame';
      this._endgameAfterAction(); // this action was the last chained move
    }
  }

  _endgameAfterAction() {
    if (!this.players.some(p => p.hand.length > 0)) {
      this.phase = 'finished';
      this._calculateScores();
      return;
    }
    this._advanceToNextPlayerWithCards();
  }

  _advanceToNextPlayerWithCards() {
    let skipped = 0;
    do { this._advanceTurn(); skipped++; }
    while (this.getCurrentPlayer().hand.length === 0 && skipped < this.players.length);
    if (this.getCurrentPlayer().hand.length === 0) {
      this.phase = 'finished';
      this._calculateScores();
    }
  }

  _skipEmptyHands() {
    if (!this.players.some(p => p.hand.length > 0)) {
      this.phase = 'finished'; this._calculateScores(); return;
    }
    if (this.getCurrentPlayer().hand.length === 0) this._advanceToNextPlayerWithCards();
  }

  // ── Individual actions ─────────────────────────────────────────────────────

  _pair(player, handCardId, floorCardId) {
    const handCard = this._take(player.hand, handCardId);
    if (!handCard) throw new Error('That card is not in your hand');

    const floorCard = this._take(this.floor, floorCardId);
    if (!floorCard) { player.hand.push(handCard); throw new Error('That card is not on the floor'); }

    if (handCard.rank !== floorCard.rank) {
      player.hand.push(handCard); this.floor.push(floorCard);
      throw new Error('Cards must share the same rank to pair');
    }
    player.slots.push({ locked: false, cards: [floorCard, handCard] });
  }

  // Steal always targets the LAST collected slot of the opponent (not last unlocked).
  // If that slot is locked, nothing can be stolen.
  _steal(player, handCardId, targetPlayerId) {
    if (targetPlayerId === player.id) throw new Error('Cannot steal from yourself');
    const handCard = this._take(player.hand, handCardId);
    if (!handCard) throw new Error('That card is not in your hand');

    const target = this.getPlayer(targetPlayerId);
    if (!target) { player.hand.push(handCard); throw new Error('Target not found'); }

    if (target.slots.length === 0) { player.hand.push(handCard); throw new Error('Nothing to steal'); }

    const lastSlot = target.slots[target.slots.length - 1];
    if (lastSlot.locked) {
      player.hand.push(handCard);
      throw new Error('That stack is locked and cannot be stolen');
    }

    const topCard = lastSlot.cards[lastSlot.cards.length - 1];
    if (topCard.rank !== handCard.rank) {
      player.hand.push(handCard);
      throw new Error('Your card must match the top card of the stack');
    }

    const stolen = target.slots.splice(target.slots.length - 1, 1)[0];
    stolen.cards.push(handCard);
    player.slots.push(stolen);
  }

  // PAIR_OWN: add to the LAST collected slot (not last unlocked).
  // If that slot is locked, PAIR_OWN is not possible.
  _pairOwn(player, handCardId) {
    const handCard = this._take(player.hand, handCardId);
    if (!handCard) throw new Error('That card is not in your hand');

    if (player.slots.length === 0) { player.hand.push(handCard); throw new Error('No stacks to pair with'); }

    const lastSlot = player.slots[player.slots.length - 1];
    if (lastSlot.locked) {
      player.hand.push(handCard);
      throw new Error('Your most recent stack is locked — start a new pair instead');
    }

    const topCard = lastSlot.cards[lastSlot.cards.length - 1];
    if (topCard.rank !== handCard.rank) {
      player.hand.push(handCard);
      throw new Error('Your card must match the top card of your most recent stack');
    }
    lastSlot.cards.push(handCard);
  }

  _drop(player, handCardId) {
    const card = this._take(player.hand, handCardId);
    if (!card) throw new Error('That card is not in your hand');
    this.floor.push(card);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _drawCard(player) {
    if (this.deck.length === 0) return false;
    player.hand.push(this.deck.shift());
    return true;
  }

  // Phase 1: 4-of-a-kind formal lock.
  // The locked set replaces the LAST slot that contributed cards, preserving
  // the chronological order of every other slot.
  _checkFormalLocks(player) {
    const byRank = {};
    for (const slot of player.slots) {
      if (slot.locked) continue;
      for (const card of slot.cards) {
        byRank[card.rank] = byRank[card.rank] || [];
        byRank[card.rank].push(card);
      }
    }
    for (const [, cards] of Object.entries(byRank)) {
      if (cards.length < 4) continue;
      const toLock  = cards.slice(0, 4);
      const lockSet = new Set(toLock.map(c => c.id));

      let lastContrib = -1;
      for (let i = 0; i < player.slots.length; i++) {
        if (!player.slots[i].locked && player.slots[i].cards.some(c => lockSet.has(c.id))) {
          lastContrib = i;
        }
      }

      for (const slot of player.slots) {
        if (!slot.locked) slot.cards = slot.cards.filter(c => !lockSet.has(c.id));
      }
      player.slots[lastContrib] = { locked: true, cards: toLock };
      player.slots = player.slots.filter(s => s.locked || s.cards.length > 0);
    }
  }

  // Phase 2: implicit lock — runs across ALL players after any action.
  // If none of a rank remain in the deck AND no opponent holds that rank in
  // hand, no opponent can ever obtain a card of that rank to steal with.
  // The slot is locked in-place; the sequence and card count are unchanged.
  _checkImplicitLocks() {
    for (const player of this.players) {
      for (const slot of player.slots) {
        if (slot.locked || !slot.cards.length) continue;
        const rank = slot.cards.at(-1).rank;

        const inDeck    = this.deck.filter(c => c.rank === rank).length;
        const inOppHand = this.players
          .filter(p => p.id !== player.id)
          .reduce((sum, p) => sum + p.hand.filter(c => c.rank === rank).length, 0);
        // If the player holds the card themselves they can still PAIR_OWN — don't lock yet
        const inOwnHand = player.hand.filter(c => c.rank === rank).length;

        if (inDeck === 0 && inOppHand === 0 && inOwnHand === 0) slot.locked = true;
      }
    }
  }

  _checkLocks(player) {
    this._checkFormalLocks(player);
    this._checkImplicitLocks();
  }

  // isSafe is now handled entirely by implicit locks; always return false.
  _getSafeSlots(player) {
    return player.slots.map(() => false);
  }

  _currentScore(player) {
    let s = 0;
    for (const slot of player.slots) for (const c of slot.cards) s += cardValue(c);
    return s;
  }

  _advanceTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  }

  _take(arr, cardId) {
    const i = arr.findIndex(c => c.id === cardId);
    return i === -1 ? null : arr.splice(i, 1)[0];
  }

  _calculateScores() {
    for (const p of this.players) {
      let s = 0;
      for (const slot of p.slots) for (const c of slot.cards) s += cardValue(c);
      p.score = s;
    }
  }

  getCurrentPlayer() { return this.players[this.currentPlayerIndex] ?? null; }
  getPlayer(id)      { return this.players.find(p => p.id === id) ?? null; }

  getStateFor(playerId) {
    const handsLeft = this.players.reduce((s, p) => s + p.hand.length, 0);
    return {
      roomId: this.id,
      hostId: this.hostId,
      phase:  this.phase,
      currentPlayerId: this.getCurrentPlayer()?.id ?? null,
      deckCount: this.deck.length,
      handsLeft,
      floor: this.floor,
      players: this.players.map(p => {
        const lockedSetCount = p.slots.filter(s => s.locked).length;
        const currentScore   = this._currentScore(p);

        if (p.id === playerId) {
          const safe = this._getSafeSlots(p);
          return {
            id: p.id, name: p.name,
            handCount: p.hand.length, hand: p.hand,
            lockedSetCount, currentScore, score: p.score,
            // Full slot list in chronological order — the player sees everything
            slots: p.slots.map((s, i) => ({
              locked:  s.locked,
              cards:   s.cards,
              topCard: s.cards.at(-1) ?? null,
              size:    s.cards.length,
              isSafe:  safe[i] ?? false,
            })),
          };
        }

        // Opponent: always reveal top card of last collected slot so it stays visible.
        // locked flag tells client whether stealing is allowed.
        const lastSlot = p.slots.length > 0 ? p.slots[p.slots.length - 1] : null;
        const lastSlotTop = lastSlot
          ? { topCard: lastSlot.cards.at(-1), size: lastSlot.cards.length, locked: lastSlot.locked }
          : null;

        return {
          id: p.id, name: p.name,
          handCount: p.hand.length, hand: null,
          lockedSetCount, currentScore, score: p.score,
          lastSlotTop,
        };
      }),
    };
  }
}

module.exports = GameRoom;
