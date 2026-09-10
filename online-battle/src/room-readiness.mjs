export function hasBothPlayersConnected(room, connectedSeats) {
  return Boolean(room?.host && room?.guest
    && connectedSeats?.has('host')
    && connectedSeats?.has('guest'));
}

export function getClientRoomPhase(room, connectedSeats) {
  if (!room) return 'waiting';
  if (room.phase === 'connecting' || room.phase === 'choosing') {
    return hasBothPlayersConnected(room, connectedSeats) ? 'choosing' : 'connecting';
  }
  return room.phase;
}
