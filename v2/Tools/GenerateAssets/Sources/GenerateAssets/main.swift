import Foundation

// MARK: - Models

struct President: Codable {
    let order: Int
    let name: String
    let term: String
    let party: String
    let wikipediaTitle: String
}

struct PresidentSummary: Codable {
    let order: Int
    let name: String
    let term: String
    let party: String
    let wikipediaTitle: String
    let extract: String
    let thumbnailImageName: String?
    let largeImageName: String?
}

struct WikipediaImage: Codable {
    let source: String
    let width: Int
    let height: Int
}

struct WikipediaSummary: Codable {
    let title: String
    let extract: String
    let thumbnail: WikipediaImage?
    let originalimage: WikipediaImage?
}

enum GeneratorError: Error {
    case invalidTitle
    case badResponse
}

// MARK: - Seed data (order is unique across the list, so it is used to disambiguate
// repeat names like the two Grover Cleveland / Donald Trump terms).

let presidents: [President] = [
    President(order: 1, name: "George Washington", term: "1789–1797", party: "Unaffiliated", wikipediaTitle: "George Washington"),
    President(order: 2, name: "John Adams", term: "1797–1801", party: "Federalist", wikipediaTitle: "John Adams"),
    President(order: 3, name: "Thomas Jefferson", term: "1801–1809", party: "Democratic-Republican", wikipediaTitle: "Thomas Jefferson"),
    President(order: 4, name: "James Madison", term: "1809–1817", party: "Democratic-Republican", wikipediaTitle: "James Madison"),
    President(order: 5, name: "James Monroe", term: "1817–1825", party: "Democratic-Republican", wikipediaTitle: "James Monroe"),
    President(order: 6, name: "John Quincy Adams", term: "1825–1829", party: "Democratic-Republican", wikipediaTitle: "John Quincy Adams"),
    President(order: 7, name: "Andrew Jackson", term: "1829–1837", party: "Democratic", wikipediaTitle: "Andrew Jackson"),
    President(order: 8, name: "Martin Van Buren", term: "1837–1841", party: "Democratic", wikipediaTitle: "Martin Van Buren"),
    President(order: 9, name: "William Henry Harrison", term: "1841", party: "Whig", wikipediaTitle: "William Henry Harrison"),
    President(order: 10, name: "John Tyler", term: "1841–1845", party: "Whig", wikipediaTitle: "John Tyler"),
    President(order: 11, name: "James K. Polk", term: "1845–1849", party: "Democratic", wikipediaTitle: "James K. Polk"),
    President(order: 12, name: "Zachary Taylor", term: "1849–1850", party: "Whig", wikipediaTitle: "Zachary Taylor"),
    President(order: 13, name: "Millard Fillmore", term: "1850–1853", party: "Whig", wikipediaTitle: "Millard Fillmore"),
    President(order: 14, name: "Franklin Pierce", term: "1853–1857", party: "Democratic", wikipediaTitle: "Franklin Pierce"),
    President(order: 15, name: "James Buchanan", term: "1857–1861", party: "Democratic", wikipediaTitle: "James Buchanan"),
    President(order: 16, name: "Abraham Lincoln", term: "1861–1865", party: "Republican", wikipediaTitle: "Abraham Lincoln"),
    President(order: 17, name: "Andrew Johnson", term: "1865–1869", party: "Democratic", wikipediaTitle: "Andrew Johnson"),
    President(order: 18, name: "Ulysses S. Grant", term: "1869–1877", party: "Republican", wikipediaTitle: "Ulysses S. Grant"),
    President(order: 19, name: "Rutherford B. Hayes", term: "1877–1881", party: "Republican", wikipediaTitle: "Rutherford B. Hayes"),
    President(order: 20, name: "James A. Garfield", term: "1881", party: "Republican", wikipediaTitle: "James A. Garfield"),
    President(order: 21, name: "Chester A. Arthur", term: "1881–1885", party: "Republican", wikipediaTitle: "Chester A. Arthur"),
    President(order: 22, name: "Grover Cleveland", term: "1885–1889", party: "Democratic", wikipediaTitle: "Grover Cleveland"),
    President(order: 23, name: "Benjamin Harrison", term: "1889–1893", party: "Republican", wikipediaTitle: "Benjamin Harrison"),
    President(order: 24, name: "Grover Cleveland", term: "1893–1897", party: "Democratic", wikipediaTitle: "Grover Cleveland"),
    President(order: 25, name: "William McKinley", term: "1897–1901", party: "Republican", wikipediaTitle: "William McKinley"),
    President(order: 26, name: "Theodore Roosevelt", term: "1901–1909", party: "Republican", wikipediaTitle: "Theodore Roosevelt"),
    President(order: 27, name: "William Howard Taft", term: "1909–1913", party: "Republican", wikipediaTitle: "William Howard Taft"),
    President(order: 28, name: "Woodrow Wilson", term: "1913–1921", party: "Democratic", wikipediaTitle: "Woodrow Wilson"),
    President(order: 29, name: "Warren G. Harding", term: "1921–1923", party: "Republican", wikipediaTitle: "Warren G. Harding"),
    President(order: 30, name: "Calvin Coolidge", term: "1923–1929", party: "Republican", wikipediaTitle: "Calvin Coolidge"),
    President(order: 31, name: "Herbert Hoover", term: "1929–1933", party: "Republican", wikipediaTitle: "Herbert Hoover"),
    President(order: 32, name: "Franklin D. Roosevelt", term: "1933–1945", party: "Democratic", wikipediaTitle: "Franklin D. Roosevelt"),
    President(order: 33, name: "Harry S. Truman", term: "1945–1953", party: "Democratic", wikipediaTitle: "Harry S. Truman"),
    President(order: 34, name: "Dwight D. Eisenhower", term: "1953–1961", party: "Republican", wikipediaTitle: "Dwight D. Eisenhower"),
    President(order: 35, name: "John F. Kennedy", term: "1961–1963", party: "Democratic", wikipediaTitle: "John F. Kennedy"),
    President(order: 36, name: "Lyndon B. Johnson", term: "1963–1969", party: "Democratic", wikipediaTitle: "Lyndon B. Johnson"),
    President(order: 37, name: "Richard Nixon", term: "1969–1974", party: "Republican", wikipediaTitle: "Richard Nixon"),
    President(order: 38, name: "Gerald Ford", term: "1974–1977", party: "Republican", wikipediaTitle: "Gerald Ford"),
    President(order: 39, name: "Jimmy Carter", term: "1977–1981", party: "Democratic", wikipediaTitle: "Jimmy Carter"),
    President(order: 40, name: "Ronald Reagan", term: "1981–1989", party: "Republican", wikipediaTitle: "Ronald Reagan"),
    President(order: 41, name: "George H. W. Bush", term: "1989–1993", party: "Republican", wikipediaTitle: "George H. W. Bush"),
    President(order: 42, name: "Bill Clinton", term: "1993–2001", party: "Democratic", wikipediaTitle: "Bill Clinton"),
    President(order: 43, name: "George W. Bush", term: "2001–2009", party: "Republican", wikipediaTitle: "George W. Bush"),
    President(order: 44, name: "Barack Obama", term: "2009–2017", party: "Democratic", wikipediaTitle: "Barack Obama"),
    President(order: 45, name: "Donald Trump", term: "2017–2021", party: "Republican", wikipediaTitle: "Donald Trump"),
    President(order: 46, name: "Joe Biden", term: "2021–2025", party: "Democratic", wikipediaTitle: "Joe Biden"),
    President(order: 47, name: "Donald Trump", term: "2025–present", party: "Republican", wikipediaTitle: "Donald Trump"),
]

// MARK: - Networking

let session = URLSession.shared

func fetchSummary(for title: String) async throws -> WikipediaSummary {
    guard let encodedTitle = title.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
          let url = URL(string: "https://en.wikipedia.org/api/rest_v1/page/summary/\(encodedTitle)") else {
        throw GeneratorError.invalidTitle
    }
    var request = URLRequest(url: url)
    request.setValue("US-Headers-AssetGenerator/1.0 (https://github.com)", forHTTPHeaderField: "User-Agent")

    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
        throw GeneratorError.badResponse
    }
    return try JSONDecoder().decode(WikipediaSummary.self, from: data)
}

func downloadImage(from urlString: String) async throws -> Data {
    guard let url = URL(string: urlString) else {
        throw GeneratorError.invalidTitle
    }
    var request = URLRequest(url: url)
    request.setValue("US-Headers-AssetGenerator/1.0 (https://github.com)", forHTTPHeaderField: "User-Agent")

    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
        throw GeneratorError.badResponse
    }
    return data
}

// MARK: - Filesystem helpers

func baseImageSetName(for president: President) -> String {
    String(format: "%02d %@", president.order, president.name)
}

func thumbnailImageSetName(for president: President) -> String {
    baseImageSetName(for: president)
}

func largeImageSetName(for president: President) -> String {
    "\(baseImageSetName(for: president)) Large"
}

func writeImageSet(named name: String, imageData: Data, fileExtension: String, in assetsURL: URL) throws {
    let imageSetURL = assetsURL.appendingPathComponent("\(name).imageset")
    try FileManager.default.createDirectory(at: imageSetURL, withIntermediateDirectories: true)

    let filename = "\(name).\(fileExtension)"
    try imageData.write(to: imageSetURL.appendingPathComponent(filename))

    let contents: [String: Any] = [
        "images": [
            ["filename": filename, "idiom": "universal"]
        ],
        "info": ["author": "xcode", "version": 1],
    ]
    let contentsData = try JSONSerialization.data(withJSONObject: contents, options: [.prettyPrinted, .sortedKeys])
    try contentsData.write(to: imageSetURL.appendingPathComponent("Contents.json"))
}

func writeDataSet(named name: String, jsonData: Data, in assetsURL: URL) throws {
    let dataSetURL = assetsURL.appendingPathComponent("\(name).dataset")
    try FileManager.default.createDirectory(at: dataSetURL, withIntermediateDirectories: true)

    let filename = "\(name).json"
    try jsonData.write(to: dataSetURL.appendingPathComponent(filename))

    let contents: [String: Any] = [
        "data": [
            ["filename": filename, "idiom": "universal"]
        ],
        "info": ["author": "xcode", "version": 1],
    ]
    let contentsData = try JSONSerialization.data(withJSONObject: contents, options: [.prettyPrinted, .sortedKeys])
    try contentsData.write(to: dataSetURL.appendingPathComponent("Contents.json"))
}

// MARK: - Main

// Default output path resolves relative to this source file so the tool can be run from anywhere.
let defaultAssetsURL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent() // Sources/GenerateAssets/
    .deletingLastPathComponent() // Sources/
    .deletingLastPathComponent() // GenerateAssets (package root)/
    .deletingLastPathComponent() // Tools/
    .deletingLastPathComponent() // v2/
    .appendingPathComponent("US-Headers/US-Headers/Assets.xcassets")

let assetsURL: URL = {
    let args = CommandLine.arguments
    if args.count > 1 {
        return URL(fileURLWithPath: args[1], isDirectory: true)
    }
    return defaultAssetsURL
}()

print("Writing assets to \(assetsURL.path)")

var summaries: [PresidentSummary] = []

func fileExtension(for urlString: String) -> String {
    let ext = URL(string: urlString)?.pathExtension ?? ""
    return ext.isEmpty ? "jpg" : ext
}

for president in presidents {
    let baseName = baseImageSetName(for: president)
    print("Fetching \(president.wikipediaTitle) (\(baseName))...")
    do {
        let summary = try await fetchSummary(for: president.wikipediaTitle)

        var thumbnailName: String?
        var largeName: String?
        var thumbnailData: Data?

        if let thumbnail = summary.thumbnail {
            thumbnailData = try await downloadImage(from: thumbnail.source)
            let setName = thumbnailImageSetName(for: president)
            try writeImageSet(named: setName, imageData: thumbnailData!, fileExtension: fileExtension(for: thumbnail.source), in: assetsURL)
            thumbnailName = setName
        } else {
            print("  warning: no thumbnail available for \(president.wikipediaTitle)")
        }

        if let original = summary.originalimage {
            // Reuse the thumbnail download if Wikipedia returned the same image for both sizes.
            let originalData = (original.source == summary.thumbnail?.source) ? thumbnailData : try await downloadImage(from: original.source)
            if let originalData {
                let setName = largeImageSetName(for: president)
                try writeImageSet(named: setName, imageData: originalData, fileExtension: fileExtension(for: original.source), in: assetsURL)
                largeName = setName
            }
        } else {
            print("  warning: no large image available for \(president.wikipediaTitle)")
        }

        summaries.append(PresidentSummary(
            order: president.order,
            name: president.name,
            term: president.term,
            party: president.party,
            wikipediaTitle: president.wikipediaTitle,
            extract: summary.extract,
            thumbnailImageName: thumbnailName,
            largeImageName: largeName
        ))
    } catch {
        print("  error: failed to fetch \(president.wikipediaTitle): \(error)")
    }

    // Be polite to the Wikipedia API.
    try await Task.sleep(nanoseconds: 200_000_000)
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let summaryData = try encoder.encode(summaries)
try writeDataSet(named: "Presidents", jsonData: summaryData, in: assetsURL)

print("Done. Wrote \(summaries.count) president summaries and image sets.")
