import { getItemsByCategory } from '../data/gameData.js';
import { TEAM_IDS } from './teamBattleEngine.js';

export function stableTargetHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededShuffle(items, seed) {
  const shuffled = [...items];
  let state = stableTargetHash(seed) || 0x9e3779b9;
  const nextRandom = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function targetMapForTeams(category, teams, { roomSeed = 'default', roundNumber = 1 } = {}) {
  const items = getItemsByCategory(category) || [];
  if (items.length < 2) throw new Error('Selected category does not have enough team targets.');
  const round = Math.max(1, Number(roundNumber) || 1);
  const orderedItems = seededShuffle(items, `${roomSeed}:${category}`);
  const roundStart = ((round - 1) * 2) % orderedItems.length;
  const selectedItems = [0, 1].map((teamIndex) => orderedItems[(roundStart + teamIndex) % orderedItems.length]);
  const teamIds = [TEAM_IDS.A, TEAM_IDS.B];
  return Object.fromEntries(teamIds.flatMap((teamId, teamIndex) => {
    const teamTarget = selectedItems[teamIndex];
    return (teams?.[teamId]?.playerIds || []).map((playerId) => [playerId, { ...teamTarget, playerId, teamId, targetId: teamTarget.id }]);
  }));
}

export function targetIdsForRound(category, teams, options = {}) {
  const targetMap = targetMapForTeams(category, teams, options);
  return Object.fromEntries(Object.values(teams || {}).map((team) => [team.teamId, targetMap[team.playerIds[0]]?.targetId || null]));
}

export function targetSnapshotsForTeams(category, stateOrTeams, { roomSeed = 'default', roundNumber = 1 } = {}) {
  const teams = stateOrTeams?.teams || stateOrTeams || {};
  const targetMap = targetMapForTeams(category, teams, { roomSeed, roundNumber });
  return Object.fromEntries(Object.values(teams).map((team) => {
    const source = targetMap[team.playerIds?.[0]];
    return source ? [team.teamId, { id: source.id, targetId: source.targetId || source.id, name: source.name, image: source.image, teamId: team.teamId }] : null;
  }).filter(Boolean));
}
