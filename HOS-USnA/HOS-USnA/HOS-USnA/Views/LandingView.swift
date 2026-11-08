import SwiftUI

/// The app's root screen: settings, app info, and the ways into `HOSDetailView` (Resume, Random
/// Head, Start Slideshow), `HOSListView`, `NewsView`, `GreatestView`, `CreditsView`, `SpeechSetupView` and `AccountView`. Navigation itself is handed back to
/// `AppLandingView` through the callbacks.
struct LandingView: View {
  @Environment(AppModel.self) private var appModel
  /// `nil` when `Supabase.plist` isn't set up (and in previews), which hides the Account button.
  @Environment(AuthModel.self) private var auth: AuthModel?
  
  /// Shows the list of heads of state.
  let onShowList: () -> Void
  /// Shows the detail view at `appModel.slideIndex`, with its slideshow playing if asked.
  let onShowDetail: (_ startSlideshow: Bool) -> Void
  /// Shows the news screen.
  let onShowNews: () -> Void
  /// Shows the 100 Greatest African Americans listing.
  let onShowGreatest: () -> Void
  /// Shows the credits screen.
  let onShowCredits: () -> Void
  /// Shows the text-to-speech setup screen.
  let onShowSpeechSetup: () -> Void
  /// Shows the account screen.
  let onShowAccount: () -> Void
  
  @AppStorage(SlideshowSettings.randomModeKey)
  private var isRandomMode = SlideshowSettings.defaultRandomMode
  @AppStorage(SlideshowSettings.animatedKey)
  private var isAnimated = SlideshowSettings.defaultAnimated
  @AppStorage(SlideshowSettings.autoScrollKey)
  private var isAutoScroll = SlideshowSettings.defaultAutoScroll
  @AppStorage(SlideshowSettings.autoScrollGreatestKey)
  private var autoScrollGreatest = SlideshowSettings.defaultAutoScrollGreatest
  @AppStorage(SlideshowSettings.intervalSecsKey)
  private var slideshowIntervalSecs = SlideshowSettings.defaultIntervalSecs
  @AppStorage(SlideshowSettings.delayFractionKey)
  private var delayFraction = SlideshowSettings.defaultDelayFraction
  @AppStorage(SlideshowSettings.fadePeriodKey)
  private var fadePeriod = SlideshowSettings.defaultFadePeriod
  @State private var isConfirmingReset = false
  private var remainingCount: Int {
    appModel.hosList.count - appModel.viewedHOSIDs.count
  }
  
  var body: some View {
    ScrollView {
      VStack(spacing: 24) {
        Image(systemName: "building.columns.fill")
          .font(.system(size: 72))
          .foregroundStyle(.tint)
        
        Text("USnA Heads and 100 Greatest")
          .font(.largeTitle.bold())
        
        Text("Who defines a nation?\nBrowse portraits and biographies of every Head of State\n of the United States of north America\n supplemented with 100 of the greatest African Americans")
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
            onShowGreatest()
          } label: {
            Label("100 Greatest", systemImage: "person.3")
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
            onShowSpeechSetup()
          } label: {
            Label("Speak", systemImage: "speaker.wave.2")
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
          
          HStack(spacing: 4) {
            Text("\(remainingCount) left to see")
              .font(.callout.weight(.medium))
            Spacer()
            Button("Reset Visit Count", role: .destructive) {
              appModel.resetVisitCount()
            }
            .buttonStyle(.bordered)
          }

          Toggle(isOn: $isRandomMode) {
            Label("Random Mode", systemImage: "shuffle")
          }
          
          Toggle(isOn: $isAnimated) {
            Label("Animated", systemImage: "plus.magnifyingglass")
          }
          
          Toggle(isOn: $isAutoScroll) {
            Label("Auto Scroll", systemImage: "arrow.down.to.line")
          }
          
          LabeledContent("Scroll Past Greatest") {
            Picker("Scroll Past Greatest", selection: $autoScrollGreatest) {
              ForEach(SlideshowSettings.autoScrollGreatestOptions, id: \.self) { count in
                Text(count == 0 ? "All" : "\(count)").tag(count)
              }
            }
            .pickerStyle(.segmented)
          }
          .disabled(!isAutoScroll)
          
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
        
        
        Button {
          onShowCredits()
        } label: {
          Label("Credits", systemImage: "info.circle")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)

        if let auth {
          Button {
            onShowAccount()
          } label: {
            Label(accountTitle(auth), systemImage: "person.crop.circle")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
        }

        Button(role: .destructive) {
          isConfirmingReset = true
        } label: {
          Label("Reset App", systemImage: "arrow.counterclockwise")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .confirmationDialog("Reset App?", isPresented: $isConfirmingReset, titleVisibility: .visible) {
          Button("Reset App", role: .destructive) {
            appModel.resetApp()
          }
        } message: {
          Text("Clears all reactions, drawings, zoom, visit progress and settings. This can't be undone.")
        }

        Text(appModel.buildInfo)
          .font(.footnote.monospaced())
          .foregroundStyle(.secondary)
      }
      .padding()
    }
    .navigationBarTitleDisplayMode(.inline)
  }

  private func accountTitle(_ auth: AuthModel) -> String {
    if case .signedIn(let user) = auth.state {
      return AccountView.displayName(of: user)
    }
    return "Sign In"
  }
}

#Preview {
  NavigationStack {
    LandingView(onShowList: {}, onShowDetail: { _ in }, onShowNews: {}, onShowGreatest: {}, onShowCredits: {}, onShowSpeechSetup: {}, onShowAccount: {})
  }
  .environment(AppModel())
}
