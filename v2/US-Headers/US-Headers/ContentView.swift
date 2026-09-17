//
//  ContentView.swift
//  US-Headers
//
//  Created by jht2 on 9/17/26.
//

import SwiftUI

struct ContentView: View {
    private let presidents = PresidentsRepository.loadAll()

    var body: some View {
        NavigationStack {
            List(presidents) { president in
                NavigationLink(value: president) {
                    PresidentRow(president: president)
                }
            }
            .navigationTitle("US Presidents")
            .navigationDestination(for: President.self) { president in
                PresidentDetailView(presidents: presidents, selected: president)
            }
        }
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
                Text(president.name)
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
    ContentView()
}
