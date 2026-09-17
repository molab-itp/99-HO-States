import SwiftUI

struct ContentView: View {
    @State private var presidents: [President] = PresidentsRepository.loadAll()
    @State private var searchText = ""

    private var filteredPresidents: [President] {
        guard !searchText.isEmpty else { return presidents }
        return presidents.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationSplitView {
            List(filteredPresidents) { president in
                NavigationLink(value: president) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(president.order). \(president.name)")
                            .font(.headline)
                        Text("\(president.term) · \(president.party)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }
            .navigationTitle("Presidents Timeline")
            .searchable(text: $searchText, prompt: "Search presidents")
            .navigationDestination(for: President.self) { president in
                PresidentDetailView(president: president)
            }
        } detail: {
            Text("Select a president")
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    ContentView()
}
