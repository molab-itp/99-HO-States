//
//  ContentView.swift
//  US-Headers
//
//  Created by jht2 on 9/17/26.
//

import SwiftUI

/// The scrollable list of all presidents. Presented inside a `NavigationStack` owned by
/// `HomeView`, which also declares the shared `navigationDestination(for: President.self)`.
struct PresidenttListView: View {
    let presidents: [President]

    var body: some View {
        List(presidents) { president in
            NavigationLink(value: president) {
                PresidentRow(president: president)
            }
        }
        .navigationTitle("US Presidents")
    }
}

private struct PresidentRow: View {
    let president: President

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
                .frame(width: 44, height: 44)
                .clipShape(Circle())
            VStack(alignment: .leading) {
                Text("#\(String(format: "%02d", president.order)) \(president.name)")
                    .font(.headline)
                Text(president.term)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var thumbnail: some View {
        if let name = president.thumbnailImageName, let image = imageIfAvailable(name) {
            image
                .resizable()
                .scaledToFill()
        } else {
            Image(systemName: "person.crop.circle")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    let presidents = PresidentsRepository.loadAll()
    NavigationStack {
        PresidenttListView(presidents: presidents)
            .navigationDestination(for: President.self) { president in
                PresidentDetailView(presidents: presidents, selected: president)
            }
    }
    .environment(AppModel(presidents: presidents))
}
