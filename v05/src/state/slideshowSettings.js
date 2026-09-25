// Port of Swift's `SlideshowSettings`: persisted slideshow timing, chosen on Home and used by the
// detail screen. Seconds are the basic unit; the details delay is stored as a fraction of the
// slideshow interval.
export const SlideshowSettings = {
  intervalSecsKey: 'ho-states-us.slideshowIntervalSecs',
  delayFractionKey: 'ho-states-us.slideshowDelayFraction',
  intervalSecsOptions: [5, 10, 15],
  delayFractionOptions: [0.1, 0.2, 0.4],
  defaultIntervalSecs: 5,
  defaultDelayFraction: 0.4,
};
