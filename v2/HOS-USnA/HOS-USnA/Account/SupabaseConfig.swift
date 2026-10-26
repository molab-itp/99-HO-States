// Copied from v06/HOS-Lobby/HOS_Lobby/SupabaseConfig.swift; keep v06 as the source of truth.
import Foundation

/// The project URL + publishable key, read from the bundled (gitignored) `Supabase.plist`.
struct SupabaseConfig {
    let url: URL
    let publishableKey: String

    /// Where a magic-link email would send the user back to. Unlike v06, v2 doesn't register this
    /// scheme (two apps claiming `hostates` would make iOS pick one at random): sign-in uses the
    /// 6-digit code, and the email templates carry no link. To turn the link on, register
    /// `hostates-usna` in the target's URL Types, add this URL to the Supabase dashboard's
    /// Auth > URL Configuration > Redirect URLs, and call `AuthModel.handleAuthCallback` from
    /// `.onOpenURL`.
    static let authRedirectURL = URL(string: "hostates-usna://auth-callback")!

    enum LoadError: Error {
        case missingFile, missingURL, placeholderURL, missingKey, placeholderKey

        var message: String {
            switch self {
            case .missingFile: "Supabase.plist wasn't found in the app. Copy Supabase.example.plist to Supabase.plist, then rebuild."
            case .missingURL: "Supabase.plist has no valid SUPABASE_URL."
            case .placeholderURL: "SUPABASE_URL in Supabase.plist is still the example value. Use your project's URL."
            case .missingKey: "Supabase.plist has no SUPABASE_PUBLISHABLE_KEY."
            case .placeholderKey: "SUPABASE_PUBLISHABLE_KEY in Supabase.plist is still the example value. Paste the publishable key from Dashboard > Project Settings > API Keys."
            }
        }
    }

    /// Fails when the plist is missing or still holds `Supabase.example.plist`'s placeholders.
    static func load(bundle: Bundle = .main) -> Result<SupabaseConfig, LoadError> {
        guard let fileURL = bundle.url(forResource: "Supabase", withExtension: "plist"),
              let data = try? Data(contentsOf: fileURL),
              let values = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: String]
        else { return .failure(.missingFile) }
        guard let urlString = values["SUPABASE_URL"]?.trimmingCharacters(in: .whitespacesAndNewlines),
              let url = URL(string: urlString), url.host() != nil
        else { return .failure(.missingURL) }
        guard !urlString.contains("YOUR-PROJECT-REF") else { return .failure(.placeholderURL) }
        guard let key = values["SUPABASE_PUBLISHABLE_KEY"]?.trimmingCharacters(in: .whitespacesAndNewlines),
              !key.isEmpty
        else { return .failure(.missingKey) }
        guard !key.hasSuffix("...") else { return .failure(.placeholderKey) }
        return .success(SupabaseConfig(url: url, publishableKey: key))
    }
}
