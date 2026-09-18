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
            return Text("#\(orderText)").font(.system(.body, design: .monospaced))
        }
        let secondsText = String(format: "%04.1f", Double(tenths) / 10)
        return Text("#\(orderText) · \(secondsText)s").font(.system(.body, design: .monospaced))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerImage
                VStack(alignment: .leading, spacing: 16) {
                    Text(president.name)
                        .font(.largeTitle.bold())
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

            ToolbarItemGroup(placement: .bottomBar) {
                Button {
                    goToPrevious()
                } label: {
                    Label("Previous", systemImage: "chevron.left")
                }
                .disabled(index == 0)

                Spacer()

                Button {
                    goToRandom()
                } label: {
                    Label("Random", systemImage: "shuffle")
                }

                Spacer()

                Button {
                    goToNext()
                } label: {
                    Label("Next", systemImage: "chevron.right")
                }
                .disabled(index == presidents.count - 1)
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

    private func goToPrevious() {
        guard index > 0 else { return }
        onManualNavigation?()
        index -= 1
    }

    private func goToNext() {
        guard index < presidents.count - 1 else { return }
        onManualNavigation?()
        index += 1
    }

    private func goToRandom() {
        guard let next = appModel.nextRandomPresident(),
              let newIndex = presidents.firstIndex(of: next) else { return }
        onManualNavigation?()
        index = newIndex
    }
}

#Preview {
    let presidents = PresidentsRepository.loadAll()
    NavigationStack {
        PresidentDetailView(presidents: presidents, selected: presidents[0])
    }
    .environment(AppModel(presidents: presidents))
}
