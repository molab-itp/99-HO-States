import SwiftUI

/// The HOS's name, term, party, biography extract, and Wikipedia link —
/// the text content that `HOSDetailView` fades in a few seconds after appearing.
struct HOSSummaryView: View {
    let hos: HOS

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("#\(hos.order) \(hos.name)").font(.system(.body, design: .monospaced))
            Text("\(hos.term) · \(hos.party)")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text(hos.extract)
                .font(.body)
            if let articleURL = hos.wikipediaArticleURL {
                Link(destination: articleURL) {
                    Label("Read on Wikipedia", systemImage: "book")
                }
                .font(.callout)
            }
        }
    }
}
