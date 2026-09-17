import Foundation

enum WikipediaServiceError: Error {
    case invalidTitle
    case invalidResponse
}

/// Fetches biography summaries and portrait images from Wikipedia's public REST API.
/// whitehousehistory.org redirects all requests (including "/the-presidents-timeline") to a
/// donation checkout page and cannot be scraped, so Wikipedia is used as the data source instead.
final class WikipediaService {
    static let shared = WikipediaService()

    private let session: URLSession
    private let decoder: JSONDecoder

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
    }

    func fetchSummary(for title: String) async throws -> WikipediaSummary {
        guard let encodedTitle = title.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
              let url = URL(string: "https://en.wikipedia.org/api/rest_v1/page/summary/\(encodedTitle)") else {
            throw WikipediaServiceError.invalidTitle
        }

        var request = URLRequest(url: url)
        request.setValue("PresidentialArchive/1.0", forHTTPHeaderField: "User-Agent")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw WikipediaServiceError.invalidResponse
        }

        return try decoder.decode(WikipediaSummary.self, from: data)
    }

    func downloadImageData(from urlString: String) async throws -> Data {
        guard let url = URL(string: urlString) else {
            throw WikipediaServiceError.invalidTitle
        }
        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw WikipediaServiceError.invalidResponse
        }
        return data
    }
}
