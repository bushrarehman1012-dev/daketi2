import Card from './Card.jsx';

export default function PlayerArea({ player, isMe, isCurrent, selectedHandCard, onStealStack }) {
  const canSteal = topCard =>
    !isMe && selectedHandCard && topCard && topCard.rank === selectedHandCard.rank;

  return (
    <div className={`player-area ${isCurrent ? 'player-area--active' : ''} ${isMe ? 'player-area--me' : ''}`}>

      {/* Name + status */}
      <div className="player-header">
        <div className="player-avatar">{player.name[0]?.toUpperCase()}</div>
        <div className="player-info">
          <span className="player-name">{player.name}</span>
          <span className="player-meta">🃏 {player.handCount} &nbsp;🔒 {player.lockedSetCount}</span>
        </div>
        {isCurrent && <span className="active-dot" title="Current turn" />}
      </div>

      {/* Stacks */}
      <div className="player-stacks">
        {player.stacks.length === 0
          ? <span className="no-stacks">No stacks</span>
          : player.stacks.map((stack, i) => {
              const stealable = canSteal(stack.topCard);
              return (
                <div
                  key={i}
                  className={`stack ${stealable ? 'stack--stealable' : ''} ${isMe ? 'stack--mine' : ''}`}
                  onClick={() => stealable && onStealStack(player.id, i)}
                  title={stealable ? 'Click to steal!' : ''}
                >
                  {/* For own stacks: show all cards fanned. Others: just top card. */}
                  {isMe && stack.cards
                    ? <div className="stack-fan">
                        {stack.cards.map((c, ci) => (
                          <div key={c.id} className="stack-fan-card" style={{ left: ci * 18 }}>
                            <Card card={c} small />
                          </div>
                        ))}
                      </div>
                    : <Card card={stack.topCard} small />
                  }
                  <span className="stack-badge">×{stack.size}</span>
                  {stealable && <span className="steal-label">STEAL</span>}
                </div>
              );
            })
        }
      </div>

      {/* Locked sets */}
      {player.lockedSetCount > 0 && (
        <div className="locked-sets">
          {(isMe ? player.lockedSets : Array(player.lockedSetCount).fill(null)).map((set, i) => (
            <div key={i} className="locked-set" title="Locked set — cannot be stolen">
              {isMe && set
                ? <><Card card={set[0]} small /><span className="locked-label">×4 🔒</span></>
                : <span className="locked-placeholder">🔒 Locked set</span>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
