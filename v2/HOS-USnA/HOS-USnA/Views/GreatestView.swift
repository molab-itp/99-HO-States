import SwiftUI

/// The 100 Greatest African Americans by Molefi Kete Asante, from people.json, sorted by birth
/// year. Pushed from `LandingView`; tapping a row opens the person's Wikipedia article.
struct GreatestView: View {
    private let people = GreatestRepository.loadAll()

    var body: some View {
        List(people) { person in
            Link(destination: person.articleUrl) {
                GreatestRow(person: person)
            }
            .foregroundStyle(.primary)
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
        if let image = imageIfAvailable(person.id) {
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
