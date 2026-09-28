//
//  ContentView.swift
//  US-Headers
//
//  Created by jht2 on 9/17/26.
//

import SwiftUI

/// The scrollable list of all presidents. Pushed from `SettingsView`; tapping a row hands the
/// president to `onSelect` (which shows it in `PresidentDetailView` and dismisses Settings).
struct PresidenttListView: View {
    let presidents: [President]
    let onSelect: (President) -> Void

    var body: some View {
        List(presidents) { president in
            Button {
                onSelect(president)
            } label: {
                PresidentRow(president: president)
            }
            .foregroundStyle(.primary)
        }
        .navigationTitle("USnA Heads")
    }
}

private struct PresidentRow: View {
    @Environment(AppModel.self) private var appModel
    let president: President

    private var reactionsText: String {
        appModel.reactions(for: president).map(\.emoji).joined()
    }

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
                .frame(width: 44, height: 44)
                .clipShape(Circle())
            VStack(alignment: .leading) {
                Text("#\(String(format: "%02d", president.order)) \(president.name)")
                    .font(.headline)
                HStack {
                    Text(president.term)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(reactionsText)
                        .font(.subheadline)
                        .lineLimit(1)
                }
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
        PresidenttListView(presidents: presidents) { _ in }
    }
    .environment(AppModel(presidents: presidents))
}
