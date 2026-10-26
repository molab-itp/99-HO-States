// From v06/HOS-Lobby/HOS_Lobby/Preview/PreviewData.swift (`AuthModel.preview` only).
#if DEBUG
import Foundation
import Supabase

/// Nothing here touches the network: the client points at a host that's never reached.
extension AuthModel {
    static func preview(state: State = .signedOut, errorMessage: String? = nil) -> AuthModel {
        let client = SupabaseClient(supabaseURL: URL(string: "https://preview.invalid")!, supabaseKey: "preview")
        let model = AuthModel(client: client, state: state)
        model.errorMessage = errorMessage
        return model
    }
}
#endif
