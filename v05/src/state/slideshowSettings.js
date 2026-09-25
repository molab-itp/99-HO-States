// Port of Swift's `SlideshowSettings`: persisted slideshow timing, chosen on Home and used by the
// detail screen. Seconds are the basic unit; the details delay is stored as a fraction of the
// slideshow interval. The fade period is how long the header image cross-fades between
// presidents during a slideshow.
export const SlideshowSettings = {
  intervalSecsKey: 'ho-states-us.slideshowIntervalSecs',
  delayFractionKey: 'ho-states-us.slideshowDelayFraction',
  intervalSecsOptions: [5, 10, 15, 20],
  delayFractionOptions: [0.1, 0.2, 0.4, 0.5],
  defaultIntervalSecs: 5,
  defaultDelayFraction: 0.4,
  fadePeriodKey: 'ho-states-us.slideshowFadePeriod',
  fadePeriodOptions: [0.1, 1, 2],
  defaultFadePeriod: 1,
};
