const SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RED = new Set(['hearts', 'diamonds']);

export default function Card({ card, selected, selectable, onClick, small, isNew, faceDown }) {
  if (faceDown) {
    return <div className={`card card--back${small ? ' card--small' : ''}`}><div className="card-back-pattern" /></div>;
  }
  if (!card) return null;

  const red = RED.has(card.suit);
  const cls = [
    'card',
    red        ? 'card--red'       : 'card--black',
    selected   ? 'card--selected'  : '',
    selectable ? 'card--selectable': '',
    small      ? 'card--small'     : '',
    isNew      ? 'card--new'       : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={onClick} title={`${card.rank} of ${card.suit}`}>
      <div className="card-corner card-corner--tl">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit-sm">{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div className="card-face-center">
        <span className="card-suit-lg">{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div className="card-corner card-corner--br">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit-sm">{SUIT_SYMBOL[card.suit]}</span>
      </div>
    </div>
  );
}
