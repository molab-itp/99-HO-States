import PhotosUI
import SwiftUI

/// One user, with their full-resolution photo. On your own profile you can choose or remove it.
struct ProfileDetailView: View {
    let isCurrentUser: Bool
    /// Called after the photo changes, so the list can pick up the new thumbnail.
    let onPhotoChanged: () async -> Void

    @Environment(AuthModel.self) private var auth
    @State private var profile: Profile
    @State private var pickedItem: PhotosPickerItem?
    @State private var isWorking = false
    @State private var errorMessage: String?

    init(profile: Profile, isCurrentUser: Bool, onPhotoChanged: @escaping () async -> Void) {
        _profile = State(initialValue: profile)
        self.isCurrentUser = isCurrentUser
        self.onPhotoChanged = onPhotoChanged
    }

    private var photos: ProfilePhotoService { ProfilePhotoService(client: auth.client) }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                photo
                    .overlay {
                        if isWorking { ProgressView().controlSize(.large) }
                    }

                if isCurrentUser {
                    HStack {
                        PhotosPicker(selection: $pickedItem, matching: .images) {
                            Label(profile.photoPath == nil ? "Choose Photo" : "Change Photo",
                                  systemImage: "photo.on.rectangle")
                        }
                        .buttonStyle(.borderedProminent)

                        if profile.photoPath != nil {
                            Button("Remove", systemImage: "trash", role: .destructive, action: removePhoto)
                                .buttonStyle(.bordered)
                        }
                    }
                    .disabled(isWorking)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }

                if profile.displayName != nil, let email = profile.email {
                    Text(email).foregroundStyle(.secondary)
                }
                if let lastSeen = profile.lastSeenAt {
                    Text("Active \(lastSeen.formatted(.relative(presentation: .named)))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle(profile.name)
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: pickedItem) {
            guard let item = pickedItem else { return }
            pickedItem = nil
            upload(item)
        }
    }

    /// The full-resolution photo, with the thumbnail standing in while it downloads.
    private var photo: some View {
        AsyncImage(url: photos.publicURL(for: profile.photoPath)) { image in
            image.resizable().scaledToFit()
        } placeholder: {
            AsyncImage(url: photos.publicURL(for: profile.photoThumbPath) ?? profile.avatarURL) { image in
                image.resizable().scaledToFit()
            } placeholder: {
                Image(systemName: "person.crop.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: 160)
            }
        }
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func upload(_ item: PhotosPickerItem) {
        change {
            // The original bytes (often HEIC); `ProfilePhoto` re-encodes them as JPEG.
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw ProfilePhoto.ProcessingError.unreadableImage
            }
            let photo = try await Task.detached(priority: .userInitiated) {
                try ProfilePhoto(imageData: data)
            }.value
            try await photos.upload(photo, replacing: profile)
        }
    }

    private func removePhoto() {
        change { try await photos.remove(from: profile) }
    }

    /// Runs a photo change, then refetches the profile (for the new paths) and the list.
    private func change(_ operation: @escaping () async throws -> Void) {
        isWorking = true
        errorMessage = nil
        Task {
            do {
                try await operation()
                profile = try await ProfilesService(client: auth.client).fetch(id: profile.id)
                await onPhotoChanged()
            } catch {
                errorMessage = error.localizedDescription
            }
            isWorking = false
        }
    }
}
