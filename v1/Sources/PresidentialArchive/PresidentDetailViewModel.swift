import Foundation
import Observation

/// Per-president enrichment state: biography extract + portrait URLs fetched from Wikipedia.
@MainActor
@Observable
final class PresidentDetailViewModel {
    enum State {
        case idle
        case loading
        case loaded(WikipediaSummary)
        case failed(String)
    }

    private(set) var state: State = .idle
    private let service: WikipediaService

    init(service: WikipediaService = .shared) {
        self.service = service
    }

    func load(for president: President) async {
        state = .loading
        do {
            let summary = try await service.fetchSummary(for: president.wikipediaTitle)
            state = .loaded(summary)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}
