import SwiftUI

/// The president's name, term, party, biography extract, and Wikipedia link — the text content
/// that `PresidentDetailView` fades in a few seconds after appearing.
struct PresidentSummaryView: View {
    let president: President

    var body: some View {
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
    }
}
