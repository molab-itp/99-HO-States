import SwiftUI

/// Full-screen cropper: drag a corner to resize the crop rectangle, drag inside it to move it.
struct PhotoCropView: View {
    let image: UIImage
    let onCancel: () -> Void
    /// Called with the crop in unit coordinates (0…1 on both axes, origin at the top left), or
    /// `nil` when it covers the whole image.
    let onDone: (CGRect?) -> Void

    @State private var crop = CGRect(x: 0, y: 0, width: 1, height: 1)
    /// The crop when the current drag began; translations are measured from it.
    @State private var dragStart: CGRect?

    /// Smallest crop side, as a fraction of the image's side.
    private static let minSide = 0.1
    private static let handleSize = 44.0

    private enum Corner: CaseIterable {
        case topLeft, topRight, bottomLeft, bottomRight

        var isLeft: Bool { self == .topLeft || self == .bottomLeft }
        var isTop: Bool { self == .topLeft || self == .topRight }
    }

    private var isWholeImage: Bool { crop.width > 0.999 && crop.height > 0.999 }

    var body: some View {
        NavigationStack {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                // The overlay has the fitted image's size, so unit coordinates scale by it.
                .overlay {
                    GeometryReader { geometry in
                        cropOverlay(in: geometry.size)
                    }
                }
                .padding(Self.handleSize / 2)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.black)
                .navigationTitle("Crop Photo")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel", action: onCancel)
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { onDone(isWholeImage ? nil : crop) }
                    }
                    ToolbarItem(placement: .bottomBar) {
                        Button("Reset") { crop = CGRect(x: 0, y: 0, width: 1, height: 1) }
                            .disabled(isWholeImage)
                    }
                }
        }
    }

    private func cropOverlay(in size: CGSize) -> some View {
        let frame = CGRect(x: crop.minX * size.width, y: crop.minY * size.height,
                           width: crop.width * size.width, height: crop.height * size.height)
        return ZStack(alignment: .topLeading) {
            // Dim everything outside the crop.
            Path { path in
                path.addRect(CGRect(origin: .zero, size: size))
                path.addRect(frame)
            }
            .fill(.black.opacity(0.6), style: FillStyle(eoFill: true))
            .allowsHitTesting(false)

            Rectangle()
                .fill(.clear)
                .stroke(.white, lineWidth: 1)
                .contentShape(Rectangle())
                .frame(width: frame.width, height: frame.height)
                .offset(x: frame.minX, y: frame.minY)
                .gesture(drag { move(by: $0, in: size) })

            ForEach(Corner.allCases, id: \.self) { corner in
                Circle()
                    .fill(.white)
                    .frame(width: 16, height: 16)
                    .frame(width: Self.handleSize, height: Self.handleSize)
                    .contentShape(Rectangle())
                    .position(x: corner.isLeft ? frame.minX : frame.maxX,
                              y: corner.isTop ? frame.minY : frame.maxY)
                    .gesture(drag { resize(corner, by: $0, in: size) })
            }
        }
    }

    private func drag(_ update: @escaping (CGSize) -> Void) -> some Gesture {
        DragGesture()
            .onChanged { update($0.translation) }
            .onEnded { _ in dragStart = nil }
    }

    private func move(by translation: CGSize, in size: CGSize) {
        let start = dragStart ?? crop
        dragStart = start
        crop.origin.x = min(max(0, start.minX + translation.width / size.width), 1 - start.width)
        crop.origin.y = min(max(0, start.minY + translation.height / size.height), 1 - start.height)
    }

    private func resize(_ corner: Corner, by translation: CGSize, in size: CGSize) {
        let start = dragStart ?? crop
        dragStart = start
        let dx = translation.width / size.width
        let dy = translation.height / size.height
        var (minX, maxX, minY, maxY) = (start.minX, start.maxX, start.minY, start.maxY)
        if corner.isLeft {
            minX = min(max(0, minX + dx), maxX - Self.minSide)
        } else {
            maxX = max(min(1, maxX + dx), minX + Self.minSide)
        }
        if corner.isTop {
            minY = min(max(0, minY + dy), maxY - Self.minSide)
        } else {
            maxY = max(min(1, maxY + dy), minY + Self.minSide)
        }
        crop = CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }
}
