import raw from './photoCredits.json';

// Mirrors PhotoCreditsRepository.loadAll(): the source, author and licence of each portrait, in
// photoCredits.json order. `order` matches the HOS it credits; `licenseURL` is absent for
// public-domain works.
const photoCredits = raw;

export default photoCredits;
