import SwiftUI

/// The 100 Greatest African Americans by Molefi Kete Asante, from people.json, sorted by birth
/// year. Pushed from `LandingView`; tapping a row shows the person in `GreatestDetailView`.
struct GreatestView: View {
    private let people = GreatestRepository.all

    var body: some View {
        List(people) { person in
            NavigationLink {
                GreatestDetailView(people: people, selected: person)
            } label: {
                GreatestRow(person: person)
            }
        }
        .navigationTitle("100 Greatest")
    }
}

private struct GreatestRow: View {
    let person: GreatestPerson

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
                .frame(width: 44, height: 44)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text("#\(String(format: "%03d", person.order)) \(person.name)")
                    .font(.headline)
                    .multilineTextAlignment(.leading)
                Text(person.description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)
            }
        }
    }

    @ViewBuilder
    private var thumbnail: some View {
        if let image = imageIfAvailable(person.thumbnailImageName) {
            image
                .resizable()
                .scaledToFill()
        } else {
            Image(systemName: "person.crop.circle")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    NavigationStack {
        GreatestView()
    }
}
