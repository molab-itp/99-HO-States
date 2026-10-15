import SwiftUI

/// A Greatest figure's full photo, name, dates, description, summary and Wikipedia link. The body
/// of `GreatestDetailView`, and repeated for each figure at the bottom of `HOSSummaryView`.
struct GreatestFigureView: View {
    let person: GreatestPerson

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let image = imageIfAvailable(person.largeImageName) {
                image
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            Text(person.name)
                .font(.title2.bold())
            Text(person.description)
                .font(.headline)
                .foregroundStyle(.secondary)
            Text(person.summary)
                .font(.body)
            Link(destination: person.articleUrl) {
                Label("Read on Wikipedia", systemImage: "book")
            }
            .font(.callout)
        }
    }
}

/// One Greatest figure on its own screen. Pushed from `GreatestView`.
struct GreatestDetailView: View {
    let person: GreatestPerson

    var body: some View {
        ScrollView {
            GreatestFigureView(person: person)
                .padding()
        }
        .navigationTitle("#\(String(format: "%03d", person.order))")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        GreatestDetailView(person: GreatestRepository.all[0])
    }
}
