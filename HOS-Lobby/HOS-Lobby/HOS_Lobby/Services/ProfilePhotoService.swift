import Foundation
import Supabase

/// Uploads, crops and removes profile photos in the `avatars` bucket and points
/// `profiles.photo_path` / `photo_thumb_path` / `photo_original_path` at them (see
/// `supabase/schemas/30_profile_photos.sql`).
struct ProfilePhotoService {
    static let bucket = "avatars"

    let client: SupabaseClient

    private var storage: StorageFileApi { client.storage.from(Self.bucket) }

    /// The bucket is public, so the URL works in `AsyncImage` without auth headers.
    func publicURL(for path: String?) -> URL? {
        guard let path else { return nil }
        return try? storage.getPublicURL(path: path)
    }

    /// Replaces the profile's photo with a newly picked one. If `photo` is a crop, pass the
    /// uncropped JPEG as `original` so it's kept for re-cropping and restoring.
    func upload(_ photo: ProfilePhoto, original: Data? = nil, replacing profile: Profile) async throws {
        let base = newBasePath(for: profile)
        var files = [(path: "\(base)-full.jpg", data: photo.full), (path: "\(base)-thumb.jpg", data: photo.thumb)]
        if let original { files.append((path: "\(base)-original.jpg", data: original)) }
        let paths = PhotoPaths(full: files[0].path, thumb: files[1].path, original: original == nil ? nil : files[2].path)
        try await replacePhoto(of: profile, with: paths, uploading: files)
    }

    /// Shows `crop` (cut from `originalData(of:)`) in place of the current photo. The original
    /// stays in the bucket.
    func applyCrop(_ crop: ProfilePhoto, to profile: Profile) async throws {
        let base = newBasePath(for: profile)
        let files = [(path: "\(base)-full.jpg", data: crop.full), (path: "\(base)-thumb.jpg", data: crop.thumb)]
        let paths = PhotoPaths(full: files[0].path, thumb: files[1].path, original: profile.photoOriginalPath ?? profile.photoPath)
        try await replacePhoto(of: profile, with: paths, uploading: files)
    }

    /// Undoes a crop: the original becomes the photo again. `originalThumb` is its thumbnail.
    func restoreOriginal(of profile: Profile, originalThumb: Data) async throws {
        guard let originalPath = profile.photoOriginalPath else { return }
        let thumbPath = "\(newBasePath(for: profile))-thumb.jpg"
        let paths = PhotoPaths(full: originalPath, thumb: thumbPath, original: nil)
        try await replacePhoto(of: profile, with: paths, uploading: [(path: thumbPath, data: originalThumb)])
    }

    /// The uncropped photo's JPEG data, or `nil` if the profile has no photo.
    func originalData(of profile: Profile) async throws -> Data? {
        guard let path = profile.photoOriginalPath ?? profile.photoPath else { return nil }
        return try await storage.download(path: path)
    }

    func remove(from profile: Profile) async throws {
        try await replacePhoto(of: profile, with: PhotoPaths(full: nil, thumb: nil, original: nil), uploading: [])
    }

    /// A fresh, extension-less object path in the user's folder.
    private func newBasePath(for profile: Profile) -> String {
        // Storage policies compare the folder with `auth.uid()::text`, which is lowercase.
        "\(profile.id.uuidString.lowercased())/\(UUID().uuidString.lowercased())"
    }

    /// Uploads `files`, switches the profile to `paths`, then deletes the files it no longer
    /// points at. A failure before the profile update leaves the old photo in place.
    private func replacePhoto(of profile: Profile, with paths: PhotoPaths, uploading files: [(path: String, data: Data)]) async throws {
        // The file names never change content, so caches can keep them for a year.
        let options = FileOptions(cacheControl: "31536000", contentType: "image/jpeg")
        do {
            for file in files {
                try await storage.upload(file.path, data: file.data, options: options)
            }
            try await setPhotoPaths(paths, for: profile.id)
        } catch {
            _ = try? await storage.remove(paths: files.map(\.path))
            throw error
        }

        // Best effort: a leftover file only costs storage, so a failure here isn't shown.
        let kept = [paths.full, paths.thumb, paths.original]
        let stale = [profile.photoPath, profile.photoThumbPath, profile.photoOriginalPath]
            .compactMap { $0 }
            .filter { !kept.contains($0) }
        guard !stale.isEmpty else { return }
        _ = try? await storage.remove(paths: stale)
    }

    private func setPhotoPaths(_ paths: PhotoPaths, for id: UUID) async throws {
        try await client
            .from("profiles")
            .update(paths)
            .eq("id", value: id)
            .execute()
    }

    /// Encodes `nil` as `null` (rather than leaving the key out) so removing a photo clears it.
    private struct PhotoPaths: Encodable {
        let full: String?
        let thumb: String?
        let original: String?

        enum CodingKeys: String, CodingKey {
            case full = "photo_path"
            case thumb = "photo_thumb_path"
            case original = "photo_original_path"
        }

        func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(full, forKey: .full)
            try container.encode(thumb, forKey: .thumb)
            try container.encode(original, forKey: .original)
        }
    }
}
