export default function sortMembers(list, mode) {
  const sorted = [...list];
  switch (mode) {
    case "sprint":
      sorted.sort((a, b) => {
        if (a.sprint == null && b.sprint == null) return 0;
        if (a.sprint == null) return 1;
        if (b.sprint == null) return -1;
        return a.sprint - b.sprint;
      });
      break;
    case "blitz":
      sorted.sort((a, b) => {
        if (a.blitz == null && b.blitz == null) return 0;
        if (a.blitz == null) return 1;
        if (b.blitz == null) return -1;
        return b.blitz - a.blitz;
      });
      break;
    case "zenith":
      sorted.sort((a, b) => {
        if (a.zenith == null && b.zenith == null) return 0;
        if (a.zenith == null) return 1;
        if (b.zenith == null) return -1;
        return b.zenith - a.zenith;
      });
      break;
    case "zenithEx":
      sorted.sort((a, b) => {
        if (a.zenithEx == null && b.zenithEx == null) return 0;
        if (a.zenithEx == null) return 1;
        if (b.zenithEx == null) return -1;
        return b.zenithEx - a.zenithEx;
      });
      break;
    case "zenithBest":
      sorted.sort((a, b) => {
        if (a.zenithBest == null && b.zenithBest == null) return 0;
        if (a.zenithBest == null) return 1;
        if (b.zenithBest == null) return -1;
        return b.zenithBest - a.zenithBest;
      });
      break;
    default:
      sorted.sort((a, b) => b.tr - a.tr);
  }
  sorted.forEach((m, i) => { m.sortedRank = i + 1; });
  return sorted;
}
