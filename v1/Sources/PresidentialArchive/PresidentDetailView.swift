import SwiftUI
import UniformTypeIdentifiers

struct PresidentDetailView: View {
    let president: President

    @State private var viewModel = PresidentDetailViewModel()
    @State private var isDownloading = false
    @State private var downloadError: String?
    @State private var exportDocument: ImageDocument?
    @State private var isExporterPresented = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                switch viewModel.state {
                case .idle, .loading:
                    ProgressView("Loading biography…")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                case .failed(let message):
                    Label(message, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                case .loaded(let summary):
                    content(for: summary)
                }

                if let downloadError {
                    Text(downloadError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
            .padding()
        }
        .navigationTitle(president.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task(id: president.id) {
            await viewModel.load(for: president)
        }
        .fileExporter(
            isPresented: $isExporterPresented,
            document: exportDocument,
            contentType: .jpeg,
            defaultFilename: fileName
        ) { result in
            if case .failure(let error) = result {
                downloadError = error.localizedDescription
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("President #\(president.order)")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(president.term)
                .font(.subheadline)
            Text(president.party)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func content(for summary: WikipediaSummary) -> some View {
        if let imageURLString = summary.originalimage?.source ?? summary.thumbnail?.source,
           let imageURL = URL(string: imageURLString) {
            AsyncImage(url: imageURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: 320)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                case .failure:
                    Image(systemName: "person.crop.rectangle")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxWidth: 200)
                        .foregroundStyle(.secondary)
                default:
                    ProgressView()
                        .frame(maxWidth: 320, minHeight: 200)
                }
            }
            .frame(maxWidth: .infinity)

            Button {
                Task { await downloadImage(from: imageURLString) }
            } label: {
                if isDownloading {
                    ProgressView()
                } else {
                    Label("Download Image", systemImage: "square.and.arrow.down")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isDownloading)
        }

        Text(summary.extract)
            .font(.body)
    }

    private var fileName: String {
        president.name.replacingOccurrences(of: " ", with: "_")
    }

    private func downloadImage(from urlString: String) async {
        downloadError = nil
        isDownloading = true
        defer { isDownloading = false }
        do {
            let data = try await WikipediaService.shared.downloadImageData(from: urlString)
            exportDocument = ImageDocument(data: data)
            isExporterPresented = true
        } catch {
            downloadError = "Couldn't download image: \(error.localizedDescription)"
        }
    }
}

#Preview {
    NavigationStack {
        PresidentDetailView(president: PresidentsRepository.loadAll().first!)
    }
}
