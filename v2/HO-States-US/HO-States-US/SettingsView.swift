import SwiftUI

/// Settings and app info, presented as a sheet from `PresidentDetailView`'s info button. Actions
/// that change what's displayed (picking from the list, Random Head, Start Slideshow) are handed
/// back to `PresidentDetailView` through the callbacks, and dismiss the sheet.
struct SettingsView: View {
    @Environment(AppModel.self) private var appModel
    @Environment(\.dismiss) private var dismiss

    /// Shows `president` in the detail view.
    let onSelect: (President) -> Void
    /// Starts (unpauses) the detail view's slideshow.
    let onStartSlideshow: () -> Void

    /// External links listed at the bottom of the sheet, from Links.json.
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
        appModel.presidents.count - appModel.viewedPresidentIDs.count
    }

  var body: some View {
    NavigationStack {
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
            NavigationLink {
              PresidenttListView(presidents: appModel.presidents) { president in
                select(president)
              }
            } label: {
              Label("List of Heads", systemImage: "list.bullet")
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)

            Button {
              if let president = appModel.nextRandomPresident() {
                select(president)
              }
            } label: {
              Label("Random Head", systemImage: "shuffle")
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

            Button {
              onStartSlideshow()
              dismiss()
            } label: {
              Label("Start Slideshow", systemImage: "play.circle")
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
          }
          .controlSize(.large)
          .padding(.horizontal, 32)

          VStack(spacing: 4) {
            Text("\(remainingCount) left to see")
              .font(.callout.weight(.medium))
            Button("Reset Visit Count", role: .destructive) {
              appModel.resetViewed()
            }
            .font(.footnote)
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
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") {
            dismiss()
          }
        }
      }
    }
  }

    private func select(_ president: President) {
        onSelect(president)
        dismiss()
    }
}

#Preview {
    SettingsView(onSelect: { _ in }, onStartSlideshow: {})
        .environment(AppModel())
}
