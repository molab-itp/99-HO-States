//
//  ContentView.swift
//  US-Headers
//
//  Created by jht2 on 9/17/26.
//

import SwiftUI

/// The scrollable list of all heads of state. Pushed from `LandingView`; tapping a row hands the
/// HOS to `onSelect` (which shows it in `HOSDetailView`).
struct HOSListView: View {
    let hosList: [HOS]
    let onSelect: (HOS) -> Void

    var body: some View {
        List(hosList) { hos in
            Button {
                onSelect(hos)
            } label: {
                HOSRow(hos: hos)
            }
            .foregroundStyle(.primary)
        }
        .navigationTitle("USnA Heads")
    }
}

private struct HOSRow: View {
    @Environment(AppModel.self) private var appModel
    let hos: HOS

    private var reactionsText: String {
        appModel.reactions(for: hos).map(\.emoji).joined()
    }

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
                .frame(width: 44, height: 44)
                .clipShape(Circle())
            VStack(alignment: .leading) {
                Text("#\(String(format: "%02d", hos.order)) \(hos.name)")
                    .font(.headline)
                HStack {
                    Text(hos.term)
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
        if let name = hos.thumbnailImageName, let image = imageIfAvailable(name) {
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
    let hosList = HOSRepository.loadAll()
    NavigationStack {
        HOSListView(hosList: hosList) { _ in }
    }
    .environment(AppModel(hosList: hosList))
}
