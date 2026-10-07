import SwiftUI

/// Sources and licences of everything the app shows that it didn't make itself: the Wikipedia
/// article each summary is extracted from, the portrait photos, and the pages linked from
/// `NewsView`. Pushed from `LandingView`; the caption under each title links to its source.
struct CreditsView: View {
    @Environment(AppModel.self) private var appModel

    private let photoCredits = PhotoCreditsRepository.loadAll()
    private let newsItems = NewsRepository.loadAll()

    private static let textLicenseURL = URL(string: "https://creativecommons.org/licenses/by-sa/4.0/")!

    var body: some View {
        List {
            Section {
                ForEach(appModel.hosList) { hos in
                    if let url = hos.wikipediaArticleURL {
                        CreditRow(title: "\(hos.order). \(hos.name)", detail: "Wikipedia: \(hos.wikipediaTitle)", url: url)
                    }
                }
            } header: {
                Text("Articles")
            } footer: {
                Text("Summaries are extracted from Wikipedia and are available under the [Creative Commons Attribution-ShareAlike 4.0 License](\(Self.textLicenseURL.absoluteString)).")
            }

            Section {
                ForEach(photoCredits) { credit in
                    CreditRow(
                        title: "\(credit.order). \(credit.name)",
                        detail: credit.author.isEmpty ? credit.license : "\(credit.author)\n\(credit.license)",
                        url: credit.sourceURL
                    )
                }
            } header: {
                Text("Photos")
            } footer: {
                Text("Portraits are from Wikimedia Commons. Each row links to the file's page there, with its full source and licence details.")
            }

            Section {
                ForEach(newsItems) { item in
                    CreditRow(title: item.label, detail: item.url.host() ?? item.url.absoluteString, url: item.url)
                }
            } header: {
                Text("News")
            } footer: {
                Text("News links and their thumbnails belong to their respective publishers.")
            }
        }
        .navigationTitle("Credits")
    }
}

private struct CreditRow: View {
    let title: String
    let detail: String
    /// Where the caption links to.
    let url: URL

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.headline)
            Link(destination: url) {
                Text(detail)
                    .font(.subheadline)
            }
        }
        .multilineTextAlignment(.leading)
    }
}

#Preview {
    NavigationStack {
        CreditsView()
    }
    .environment(AppModel())
}
