import SwiftUI

let delaySecs:UInt64 = 2;

struct PresidentDetailView: View {
    let presidents: [President]
    let slideshowCountdownTenths: Int?
    @State private var index: Int
    @State private var detailsVisible = false

    init(presidents: [President], selected: President, slideshowCountdownTenths: Int? = nil) {
        self.presidents = presidents
        self.slideshowCountdownTenths = slideshowCountdownTenths
        _index = State(initialValue: presidents.firstIndex(of: selected) ?? 0)
    }

    private var president: President { presidents[index] }

    private var navigationTitleText: String {
        guard let tenths = slideshowCountdownTenths else { return "#\(president.order)" }
        return String(format: "#%d · %.1fs", president.order, Double(tenths) / 10)
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
        .navigationTitle(navigationTitleText)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
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
        index -= 1
    }

    private func goToNext() {
        guard index < presidents.count - 1 else { return }
        index += 1
    }

    private func goToRandom() {
        guard presidents.count > 1 else { return }
        var newIndex = Int.random(in: 0..<presidents.count)
        while newIndex == index {
            newIndex = Int.random(in: 0..<presidents.count)
        }
        index = newIndex
    }
}

#Preview {
    let presidents = PresidentsRepository.loadAll()
    NavigationStack {
        PresidentDetailView(presidents: presidents, selected: presidents[0])
    }
}
