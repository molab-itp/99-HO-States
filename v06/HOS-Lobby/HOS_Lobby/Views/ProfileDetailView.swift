import PhotosUI
import SwiftUI

/// One user, with their full-resolution photo. On your own profile you can choose, crop or remove
/// it; a cropped photo keeps its original, which you can crop again or restore. You can also edit
/// your caption.
struct ProfileDetailView: View {
    let isCurrentUser: Bool
    /// Called after the photo or caption changes, so the list can pick them up.
    let onProfileChanged: () async -> Void

    @Environment(AuthModel.self) private var auth
    @State private var profile: Profile
    @State private var pickedItem: PhotosPickerItem?
    @State private var cropSource: CropSource?
    @State private var isWorking = false
    @State private var errorMessage: String?
    /// The caption being typed; saved on Return or Save.
    @State private var captionDraft: String
    @FocusState private var isEditingCaption: Bool

    init(profile: Profile, isCurrentUser: Bool, onProfileChanged: @escaping () async -> Void) {
        _profile = State(initialValue: profile)
        _captionDraft = State(initialValue: profile.caption ?? "")
        self.isCurrentUser = isCurrentUser
        self.onProfileChanged = onProfileChanged
    }

    /// The draft as it would be stored: trimmed, with blank meaning no caption.
    private var normalizedCaption: String? {
        let trimmed = captionDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private var photos: ProfilePhotoService { ProfilePhotoService(client: auth.client) }

    /// An uncropped photo waiting in the cropper.
    private struct CropSource: Identifiable {
        let id = UUID()
        /// Upright JPEG, as `ProfilePhoto` encodes it.
        let data: Data
        let image: UIImage
        /// Just picked, so not in the bucket yet.
        let isNew: Bool
    }

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

                    if profile.photoPath != nil {
                        HStack {
                            Button("Crop", systemImage: "crop", action: cropCurrentPhoto)
                            if profile.photoOriginalPath != nil {
                                Button("Restore Original", systemImage: "arrow.uturn.backward", action: restoreOriginal)
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isWorking)
                    }
                }

                if isCurrentUser {
                    captionEditor
                } else if let caption = profile.caption {
                    Text(caption)
                        .multilineTextAlignment(.center)
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
            crop(picked: item)
        }
        .fullScreenCover(item: $cropSource) { source in
            PhotoCropView(image: source.image) {
                cropSource = nil
            } onDone: { rect in
                cropSource = nil
                finishCrop(of: source, to: rect)
            }
        }
    }

    private var captionEditor: some View {
        HStack {
            TextField("Add a caption", text: $captionDraft)
                .textFieldStyle(.roundedBorder)
                .focused($isEditingCaption)
                .submitLabel(.done)
                .onSubmit(saveCaption)
                .onChange(of: captionDraft) {
                    if captionDraft.count > Profile.captionLimit {
                        captionDraft = String(captionDraft.prefix(Profile.captionLimit))
                    }
                }
            if normalizedCaption != profile.caption {
                Button("Save", action: saveCaption)
                    .buttonStyle(.borderedProminent)
            }
        }
        .disabled(isWorking)
    }

    private func saveCaption() {
        isEditingCaption = false
        let caption = normalizedCaption
        guard caption != profile.caption else { return }
        run {
            profile = try await ProfilesService(client: auth.client).updateCaption(caption, id: profile.id)
            captionDraft = profile.caption ?? ""
            await onProfileChanged()
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

    /// Opens the cropper on a newly picked photo. Nothing is uploaded until the cropper is done.
    private func crop(picked item: PhotosPickerItem) {
        run {
            // The original bytes (often HEIC); `ProfilePhoto` re-encodes them as JPEG.
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw ProfilePhoto.ProcessingError.unreadableImage
            }
            let original = try await Task.detached(priority: .userInitiated) {
                try ProfilePhoto(imageData: data)
            }.value
            try showCropper(for: original.full, isNew: true)
        }
    }

    /// Opens the cropper on the stored photo. It always starts from the original, so an earlier
    /// crop can be widened again.
    private func cropCurrentPhoto() {
        run {
            guard let data = try await photos.originalData(of: profile) else { return }
            try showCropper(for: data, isNew: false)
        }
    }

    private func showCropper(for data: Data, isNew: Bool) throws {
        guard let image = UIImage(data: data) else { throw ProfilePhoto.ProcessingError.unreadableImage }
        cropSource = CropSource(data: data, image: image, isNew: isNew)
    }

    /// `rect` is the crop in unit coordinates, or `nil` for the whole photo.
    private func finishCrop(of source: CropSource, to rect: CGRect?) {
        // The whole of a stored photo is its original.
        if rect == nil, !source.isNew {
            if profile.photoOriginalPath != nil { restoreOriginal(from: source.data) }
            return
        }
        change {
            let photo = try await Task.detached(priority: .userInitiated) {
                try ProfilePhoto(imageData: source.data, crop: rect)
            }.value
            if source.isNew {
                try await photos.upload(photo, original: rect == nil ? nil : source.data, replacing: profile)
            } else {
                try await photos.applyCrop(photo, to: profile)
            }
        }
    }

    private func restoreOriginal() {
        restoreOriginal(from: nil)
    }

    /// `data` is the original, if it's already downloaded.
    private func restoreOriginal(from data: Data?) {
        change {
            var data = data
            if data == nil { data = try await photos.originalData(of: profile) }
            guard let data else { return }
            let original = try await Task.detached(priority: .userInitiated) {
                try ProfilePhoto(imageData: data)
            }.value
            try await photos.restoreOriginal(of: profile, originalThumb: original.thumb)
        }
    }

    private func removePhoto() {
        change { try await photos.remove(from: profile) }
    }

    /// Runs a photo change, then refetches the profile (for the new paths) and the list.
    private func change(_ operation: @escaping () async throws -> Void) {
        run {
            try await operation()
            profile = try await ProfilesService(client: auth.client).fetch(id: profile.id)
            await onProfileChanged()
        }
    }

    /// Runs `operation` with the spinner up, showing its error if it fails.
    private func run(_ operation: @escaping () async throws -> Void) {
        isWorking = true
        errorMessage = nil
        Task {
            do {
                try await operation()
            } catch {
                errorMessage = error.localizedDescription
            }
            isWorking = false
        }
    }
}

#Preview("Your profile") {
    NavigationStack {
        ProfileDetailView(profile: .sampleMe, isCurrentUser: true) {}
    }
    .environment(AuthModel.preview())
}

#Preview("Someone else") {
    NavigationStack {
        ProfileDetailView(profile: Profile.samples[1], isCurrentUser: false) {}
    }
    .environment(AuthModel.preview())
}
