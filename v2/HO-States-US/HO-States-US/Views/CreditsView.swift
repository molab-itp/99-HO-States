import SwiftUI

/// Sources and licences of everything the app shows that it didn't make itself: the Wikipedia
/// article each summary is extracted from, the portrait photos, and the pages linked from
/// `NewsView`. Pushed from `LandingView`; the caption under each title links to its source,
/// and each category can be hidden or shown from its header.
struct CreditsView: View {
    @Environment(AppModel.self) private var appModel

    private let photoCredits = PhotoCreditsRepository.loadAll()
    private let newsItems = NewsRepository.loadAll()

    private static let textLicenseURL = URL(string: "https://creativecommons.org/licenses/by-sa/4.0/")!

    var body: some View {
        List {
            CreditsSection("Articles", footer: Text("Summaries are extracted from Wikipedia and are available under the [Creative Commons Attribution-ShareAlike 4.0 License](\(Self.textLicenseURL.absoluteString)).")) {
                ForEach(appModel.hosList) { hos in
                    if let url = hos.wikipediaArticleURL {
                        CreditRow(title: "\(hos.order). \(hos.name)", detail: "Wikipedia: \(hos.wikipediaTitle)", url: url)
                    }
                }
            }

            CreditsSection("Photos", footer: Text("Portraits are from Wikimedia Commons. Each row links to the file's page there, with its full source and licence details.")) {
                ForEach(photoCredits) { credit in
                    CreditRow(
                        title: "\(credit.order). \(credit.name)",
                        detail: credit.author.isEmpty ? credit.license : "\(credit.author)\n\(credit.license)",
                        url: credit.sourceURL
                    )
                }
            }

            CreditsSection("News", footer: Text("News links and their thumbnails belong to their respective publishers.")) {
                ForEach(newsItems) { item in
                    CreditRow(title: item.label, detail: item.url.host() ?? item.url.absoluteString, url: item.url)
                }
            }
        }
        .navigationTitle("Credits")
    }
}

/// One category of credits, with a header that hides or shows its rows and footer.
private struct CreditsSection<Content: View>: View {
    let title: String
    let footer: Text
    @ViewBuilder let content: Content

    @State private var isExpanded = false

    init(_ title: String, footer: Text, @ViewBuilder content: () -> Content) {
        self.title = title
        self.footer = footer
        self.content = content()
    }

    var body: some View {
        Section {
            if isExpanded {
                content
            }
        } header: {
            Button {
                withAnimation {
                    isExpanded.toggle()
                }
            } label: {
                HStack {
                    Text(title)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            .accessibilityValue(isExpanded ? "Shown" : "Hidden")
        } footer: {
            if isExpanded {
                footer
            }
        }
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
