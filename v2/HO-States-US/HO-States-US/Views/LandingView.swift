import SwiftUI

/// The app's root screen: settings, app info, and the ways into `HOSDetailView` (Resume, Random
/// Head, Start Slideshow), `HOSListView`, `NewsView`, `CreditsView` and `SpeechSetupView`. Navigation itself is handed back to
/// `AppLandingView` through the callbacks.
struct LandingView: View {
  @Environment(AppModel.self) private var appModel
  
  /// Shows the list of heads of state.
  let onShowList: () -> Void
  /// Shows the detail view at `appModel.slideIndex`, with its slideshow playing if asked.
  let onShowDetail: (_ startSlideshow: Bool) -> Void
  /// Shows the news screen.
  let onShowNews: () -> Void
  /// Shows the credits screen.
  let onShowCredits: () -> Void
  /// Shows the text-to-speech setup screen.
  let onShowSpeechSetup: () -> Void
  
  /// External links listed at the bottom of the screen, from Links.json.
  private let links = LinksRepository.loadAll()
  
  @AppStorage(SlideshowSettings.randomModeKey)
  private var isRandomMode = SlideshowSettings.defaultRandomMode
  @AppStorage(SlideshowSettings.intervalSecsKey)
  private var slideshowIntervalSecs = SlideshowSettings.defaultIntervalSecs
  @AppStorage(SlideshowSettings.delayFractionKey)
  private var delayFraction = SlideshowSettings.defaultDelayFraction
  @AppStorage(SlideshowSettings.fadePeriodKey)
  private var fadePeriod = SlideshowSettings.defaultFadePeriod
  private var remainingCount: Int {
    appModel.hosList.count - appModel.viewedHOSIDs.count
  }
  
  var body: some View {
    ScrollView {
      VStack(spacing: 24) {
        Image(systemName: "building.columns.fill")
          .font(.system(size: 72))
          .foregroundStyle(.tint)
        
        Text("USnA Heads")
          .font(.largeTitle.bold())
        
        Text("Browse portraits and biographies of every Head of State\n of the United States of north America")
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
          .fixedSize(horizontal: false, vertical: true)
          .padding(.horizontal, 32)
        
        VStack(spacing: 16) {
          Button {
            onShowDetail(false)
          } label: {
            Label("Resume", systemImage: "arrow.uturn.forward")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.borderedProminent)
          
          Button {
            onShowNews()
          } label: {
            Label("News", systemImage: "newspaper")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          
          Button {
            onShowList()
          } label: {
            Label("List of Heads", systemImage: "list.bullet")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          
          Button {
            if let hos = appModel.nextRandomHOS() {
              appModel.select(hos)
              onShowDetail(false)
            }
          } label: {
            Label("Random Head", systemImage: "shuffle")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          
          Button {
            onShowDetail(true)
          } label: {
            Label("Start Slideshow", systemImage: "play.circle")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          
          Toggle(isOn: $isRandomMode) {
            Label("Random Mode", systemImage: "shuffle")
          }
          
          LabeledContent("Slide Interval") {
            Picker("Slide Interval", selection: $slideshowIntervalSecs) {
              ForEach(SlideshowSettings.intervalSecsOptions, id: \.self) { secs in
                Text("\(Int(secs))s").tag(secs)
              }
            }
            .pickerStyle(.segmented)
          }
          
          LabeledContent("Fadein Delay") {
            Picker("Fadein Delay", selection: $delayFraction) {
              ForEach(SlideshowSettings.delayFractionOptions, id: \.self) { fraction in
                Text(String(format: "%.1fs", slideshowIntervalSecs * fraction)).tag(fraction)
              }
            }
            .pickerStyle(.segmented)
          }
          
          LabeledContent("Fade Period") {
            Picker("Fade Period", selection: $fadePeriod) {
              ForEach(SlideshowSettings.fadePeriodOptions, id: \.self) { secs in
                Text("\(secs.formatted())s").tag(secs)
              }
            }
            .pickerStyle(.segmented)
          }
        }
        .controlSize(.large)
        .padding(.horizontal, 32)
        
        VStack(spacing: 4) {
          Text("\(remainingCount) left to see")
            .font(.callout.weight(.medium))
          Button("Reset Visit Count", role: .destructive) {
            appModel.resetViewed()
          }
          .buttonStyle(.bordered)
          //          .font(.footnote)
          Button {
            onShowSpeechSetup()
          } label: {
            Label("Speak", systemImage: "speaker.wave.2")
              .frame(maxWidth: .infinity)
            //            .font(.footnote)
          }
          .buttonStyle(.bordered)
          Button {
            onShowCredits()
          } label: {
            Label("Credits", systemImage: "info.circle")
              .frame(maxWidth: .infinity)
            //            .font(.footnote)
          }
          .buttonStyle(.bordered)
        }
        
        VStack(spacing: 4) {
          ForEach(links) { link in
            Link(destination: link.url) {
              Label(link.title, systemImage: "link")
                .font(.footnote)
            }
          }
        }
        Text(appModel.buildInfo)
          .font(.footnote.monospaced())
          .foregroundStyle(.secondary)
      }
      .padding()
    }
    .navigationBarTitleDisplayMode(.inline)
  }
}

#Preview {
  NavigationStack {
    LandingView(onShowList: {}, onShowDetail: { _ in }, onShowNews: {}, onShowCredits: {}, onShowSpeechSetup: {})
  }
  .environment(AppModel())
}
