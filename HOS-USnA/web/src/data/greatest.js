import raw from './people.json';

// Port of GreatestPerson.swift / GreatestRepository.swift: the 100 Greatest African Americans by
// Molefi Kete Asante, from people.json (a copy of v2's Resources/people.json), in its order (by
// birth year). v2 names each photo after the person's slug in its asset catalog's Greatest
// folder; here those are files under public/images/greatest/.
const greatestList = raw.people.map((person) => ({
  ...person,
  thumbnail: `images/greatest/${person.id}-thumb.jpg`,
  large: `images/greatest/${person.id}-large.jpg`,
}));

export default greatestList;

// The Wikipedia article the list comes from, linked as "Source" next to each figure and above
// an HOS's Greatest (v2's `GreatestFigureView`/`HOSSummaryView`).
export const greatestSourceURL = raw.sourceUrl;

const currentYear = () => new Date().getFullYear();

// Port of HOS.swift's `termYears`: the years `hos.term` spans as [start, end], e.g. [1789, 1797]
// for "1789–1797", [1841, 1841] for "1841", and through the current year for "2025–present".
// Null if the term has no year in it.
export function termYears(hos) {
  const years = (hos.term.match(/\d+/g) ?? []).map(Number);
  if (years.length === 0) return null;
  const start = years[0];
  const end = hos.term.endsWith('present') ? currentYear() : years[years.length - 1];
  return [start, Math.max(start, end)];
}

// Port of `GreatestPerson.livedDuring`: whether `person` was alive at some point during `years`.
// The living count as alive through the current year.
function livedDuring(person, [start, end]) {
  const died = person.died ?? currentYear();
  return person.born <= end && died >= start;
}

// Port of `GreatestRepository.people(for:)`: the people alive during `hos`'s term. The first HOS
// also gets everyone who died before its term began (Crispus Attucks), so no one is left without
// a HOS.
export function greatestFor(hos) {
  const years = termYears(hos);
  if (!years) return [];
  return greatestList.filter(
    (person) =>
      livedDuring(person, years) || (hos.order === 1 && (person.died ?? Infinity) < years[0]),
  );
}
