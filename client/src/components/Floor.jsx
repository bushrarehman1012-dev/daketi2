import Card from './Card.jsx';

export default function Floor({ cards, deckCount, selectedHandCard, onSelect }) {
  const canPair = c => selectedHandCard && c.rank === selectedHandCard.rank;

  return (
    <div className="table-center">
      <div className="floor-section">
        <div className="section-label">Floor</div>
        <div className="floor-cards">
          {cards.length === 0
            ? <span className="table-hint">Empty floor</span>
            : cards.map(c => (
                <Card
                  key={c.id}
                  card={c}
                  selectable={canPair(c)}
                  onClick={() => canPair(c) && onSelect(c)}
                />
              ))
          }
        </div>
      </div>

      <div className="deck-section">
        <div className="section-label">Deck</div>
        <div className="deck-pile">
          {deckCount > 0
            ? <><Card faceDown /><span className="deck-count">{deckCount}</span></>
            : <span className="table-hint">Empty</span>
          }
        </div>
      </div>
    </div>
  );
}
