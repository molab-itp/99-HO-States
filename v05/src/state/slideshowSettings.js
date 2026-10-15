// Port of Swift's `SlideshowSettings`: persisted slideshow settings, chosen on Landing and used
// by the detail screen. Seconds are the basic unit; the details delay is stored as a fraction of
// the slideshow interval. The fade period is how long the header image cross-fades between
// heads of state during a slideshow. Animated has the header image zoom and pan into its saved
// position as each head of state appears during a slideshow. Auto Scroll has the details scroll
// slowly down during a slideshow, past the first `autoScrollGreatest` of the period's 100 Greatest
// (0 is all of them), and holds the slide until they have.
export const SlideshowSettings = {
  randomModeKey: 'ho-states-us.slideshowRandomMode',
  defaultRandomMode: false,
  animatedKey: 'ho-states-us.slideshowAnimated',
  defaultAnimated: false,
  autoScrollKey: 'ho-states-us.slideshowAutoScroll',
  defaultAutoScroll: false,
  // Auto Scroll's speed, in pixels per second.
  autoScrollSpeed: 60,
  autoScrollGreatestKey: 'ho-states-us.slideshowAutoScrollGreatest',
  autoScrollGreatestOptions: [1, 2, 0],
  defaultAutoScrollGreatest: 1,
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
