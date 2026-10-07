import Foundation

/// The app's top-level screens. `AppModel.screen` records whichever one is showing so it can be
/// restored on the next launch; `.landing` is the navigation root, the others are pushed onto it.
enum AppScreen: String, Hashable {
    case landing
    case hosList
    case hosDetail
    case news
    case credits
}
