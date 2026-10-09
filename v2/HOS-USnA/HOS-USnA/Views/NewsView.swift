import SwiftUI

/// The list of news links from news.json. Pushed from `LandingView`; tapping a row opens its
/// URL in the browser.
struct NewsView: View {
    private let items = NewsRepository.loadAll()

    var body: some View {
        List(items) { item in
            Link(destination: item.url) {
                NewsRow(item: item)
            }
            .foregroundStyle(.primary)
        }
        .navigationTitle("News")
    }
}

private struct NewsRow: View {
    let item: NewsItem

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 4) {
                Text(item.label)
                    .font(.headline)
                    .multilineTextAlignment(.leading)
                if let host = item.url.host() {
                    Text(host)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private var thumbnail: some View {
        if let name = item.thumbnail, !name.isEmpty, let image = imageIfAvailable(name) {
            image
                .resizable()
                .scaledToFill()
        } else {
            Image(systemName: "newspaper")
                .font(.title)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.quaternary)
        }
    }
}

#Preview {
    NavigationStack {
        NewsView()
    }
}
