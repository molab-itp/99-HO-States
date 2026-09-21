import SwiftUI

let delaySecs:UInt64 = 2;

struct PresidentDetailView: View {
    @Environment(AppModel.self) private var appModel
    let presidents: [President]
    let slideshowCountdownTenths: Int?
    var onManualNavigation: (() -> Void)? = nil
    @State private var index: Int
    @State private var detailsVisible = false

    init(presidents: [President], selected: President, slideshowCountdownTenths: Int? = nil, onManualNavigation: (() -> Void)? = nil) {
        self.presidents = presidents
        self.slideshowCountdownTenths = slideshowCountdownTenths
        self.onManualNavigation = onManualNavigation
        _index = State(initialValue: presidents.firstIndex(of: selected) ?? 0)
    }

    private var president: President { presidents[index] }

    // Fixed-width (leading-zero, fully monospaced) title so the number/countdown don't jiggle
    // side-to-side as their digits change every tenth of a second.
    //
    // navigationTitle(_:) only accepts unstyled Text, so this styled title is rendered via a
    // principal toolbar item instead (see `.toolbar` below).
    private var navigationTitleView: some View {
        let orderText = String(format: "%02d", president.order)
        guard let tenths = slideshowCountdownTenths else {
            return HStack {
                Text("#\(orderText) \(appModel.buildInfo)").font(.system(.body, design: .monospaced))
            }
            .frame(maxWidth: .infinity)
        }
        let secondsText = String(format: "%04.1f", Double(tenths) / 10)
        return HStack {
            Text("#\(orderText) · \(secondsText)s \(appModel.buildInfo)").font(.system(.body, design: .monospaced))
        }
        .frame(maxWidth: .infinity)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
//                ViewedProgressBar(total: presidents.count, viewedCount: appModel.viewedPresidentIDs.count)
                ViewedProgressBar(total: presidents.count,
                                  viewedPresidentIDs: appModel.viewedPresidentIDs)
                headerImage
                VStack(alignment: .leading, spacing: 16) {
                    Text("#\(president.order) \(president.name)").font(.system(.body, design: .monospaced))
                    Text("\(president.term) · \(president.party)")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    Text(president.extract)
                        .font(.body)
                    if let articleURL = president.wikipediaArticleURL {
                        Link(destination: articleURL) {
                            Label("Read on Wikipedia", systemImage: "book")
                        }
                        .font(.callout)
                    }
                }
                .opacity(detailsVisible ? 1 : 0)
            }
            .padding()
        }
        .task(id: index) {
            appModel.markViewed(president, resetIfComplete: isSlideshowActive)
            detailsVisible = false
            try? await Task.sleep(nanoseconds: delaySecs * 1_000_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.5)) {
                detailsVisible = true
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                navigationTitleView
            }
//            ToolbarItem(placement: .topBarTrailing) {
////                ToolbarItem(placement: .topBarTrailing) {
//                Text("(\(appModel.cycleCount))").font(.system(.body, design: .monospaced))
//            }
            ToolbarItemGroup(placement: .bottomBar) {
                Button {
                    handleToolbarButton(goToPrevious)
                } label: {
                    Label("Previous", systemImage: "chevron.left")
                }
                .disabled(!isSlideshowActive && index == 0)

                Spacer()

                Button {
                    handleToolbarButton(goToRandom)
                } label: {
                    Label("Random", systemImage: "shuffle")
                }

                Spacer()

                Button {
                    handleToolbarButton(goToNext)
                } label: {
                    Label("Next", systemImage: "chevron.right")
                }
                .disabled(!isSlideshowActive && index == presidents.count - 1)
            }
        }
    }

    @ViewBuilder
    private var headerImage: some View {
        if let name = president.largeImageName ?? president.thumbnailImageName, let image = imageIfAvailable(name) {
            image
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        } else {
            RoundedRectangle(cornerRadius: 12)
                .fill(.secondary.opacity(0.2))
                .frame(height: 220)
                .overlay {
                    Image(systemName: "person.crop.circle")
                        .font(.system(size: 64))
                        .foregroundStyle(.secondary)
                }
        }
    }

    private var isSlideshowActive: Bool { slideshowCountdownTenths != nil }

    /// While the slideshow is running, any of the three toolbar buttons should just stop it in
    /// place (leaving the currently shown president as-is) instead of performing its usual
    /// navigation; once stopped, the buttons resume their normal Previous/Random/Next behavior.
    private func handleToolbarButton(_ action: () -> Void) {
        guard !isSlideshowActive else {
            onManualNavigation?()
            return
        }
        action()
    }

    private func goToPrevious() {
        guard index > 0 else { return }
        index -= 1
    }

    private func goToNext() {
        guard index < presidents.count - 1 else { return }
        index += 1
    }

    private func goToRandom() {
        guard let next = appModel.nextRandomPresident(),
              let newIndex = presidents.firstIndex(of: next) else { return }
        index = newIndex
    }
}

/// A segmented bar above the header image: one segment per president, filled left-to-right as
/// presidents are viewed. Filled segments cycle red/white/blue so progress reads as a strip of
/// bunting rather than a single flat color; white segments get a hairline outline since they'd
/// otherwise disappear against the background.
private struct ViewedProgressBar: View {
    let total: Int
    var viewedPresidentIDs: Set<President.ID>
    
    private static let colors: [Color] = [.red, .green, .yellow]
    private let segmentSpacing: CGFloat = 2

    var body: some View {
        HStack(spacing: segmentSpacing) {
            ForEach(0..<max(total, 1), id: \.self) { position in
                let color = Self.colors[position % Self.colors.count]
//                let isViewed = position < viewedCount
                let isViewed = viewedPresidentIDs.contains(position+1)
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(isViewed ? color : Color.secondary.opacity(0.15))
                    .overlay(
                        RoundedRectangle(cornerRadius: 1.5)
                            .strokeBorder(Color.secondary.opacity(isViewed && color == .white ? 0.6 : 0), lineWidth: 1)
                    )
            }
        }
        .frame(height: 6)
        .accessibilityElement()
        .accessibilityLabel("Heads viewed")
        .accessibilityValue("\(viewedPresidentIDs.count) of \(total)")
    }
}

#Preview {
    let presidents = PresidentsRepository.loadAll()
    NavigationStack {
        PresidentDetailView(presidents: presidents, selected: presidents[0])
    }
    .environment(AppModel(presidents: presidents))
}
