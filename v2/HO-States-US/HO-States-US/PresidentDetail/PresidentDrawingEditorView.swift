import PencilKit
import SwiftUI

/// Pushed from `PresidentDetailView`'s pencil button: the president's portrait with a PencilKit
/// canvas laid exactly over it. The drawing is saved automatically when this view goes away (Done
/// or Back), so there's no way to lose strokes by leaving; Clear empties the canvas, and leaving
/// with an empty canvas deletes the saved drawing. Reactions are added and removed here too, with
/// the controls above the photo (the tool picker docks along the bottom on iPhone) and the emoji
/// shown as a layer along the photo's bottom edge.
struct PresidentDrawingEditorView: View {
    let president: President
    @Environment(AppModel.self) private var appModel
    @Environment(\.dismiss) private var dismiss

    @State private var controller = DrawingCanvasController()
    @State private var showingAddPicker = false
    @State private var showingEmojiSheet = false

    private var photo: UIImage? {
        guard let name = president.largeImageName ?? president.thumbnailImageName else { return nil }
        return UIImage(named: name)
    }

    var body: some View {
        Group {
            if let photo {
                VStack(spacing: 12) {
                    reactionControl
                    Image(uiImage: photo)
                        .resizable()
                        .scaledToFit()
                        // The overlay gets exactly the fitted image's frame, so the canvas bounds are
                        // the photo's on-screen rect — the basis for converting to image coordinates.
                        .overlay {
                            DrawingCanvas(
                                controller: controller,
                                imageSize: photo.size,
                                presidentID: president.id
                            )
                        }
                        .overlay { ReactionOverlay(president: president) }
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .padding()
            } else {
                ContentUnavailableView("No Photo", systemImage: "photo")
            }
        }
        .navigationTitle(president.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button(role: .destructive) {
                    controller.clear()
                } label: {
                    Label("Clear", systemImage: "trash")
                }
                .disabled(photo == nil)

                Button("Done") { dismiss() }
            }
        }
        .onDisappear(perform: save)
        .sheet(isPresented: $showingEmojiSheet) {
            EmojiPickerSheet(onPick: addReaction)
        }
    }

    /// + opens the quick-pick strip (whose ★ opens the full emoji sheet); − removes the most
    /// recently added reaction. The reactions themselves show on the photo, not here.
    private var reactionControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Button {
                    withAnimation(.easeOut(duration: 0.2)) {
                        showingAddPicker.toggle()
                    }
                } label: {
                    Image(systemName: "plus.circle")
                }
                .accessibilityLabel("Add Reaction")

                Button {
                    appModel.removeLastReaction(for: president)
                } label: {
                    Image(systemName: "minus.circle")
                }
                .accessibilityLabel("Remove Reaction")
                .disabled(appModel.reactions(for: president).isEmpty)
            }
            .font(.title3)

            if showingAddPicker {
                // Always all presets — repeats are allowed, so there's nothing to filter out here.
                ReactionPickerStrip(
                    options: PresidentReaction.presets,
                    onPick: addReaction,
                    onMore: { showingEmojiSheet = true }
                )
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func addReaction(_ reaction: PresidentReaction) {
        appModel.addReaction(reaction, for: president)
        withAnimation(.easeOut(duration: 0.2)) {
            showingAddPicker = false
        }
    }

    private func save() {
        guard let photo, let drawing = controller.imageSpaceDrawing() else { return }
        if drawing.strokes.isEmpty {
            PresidentDrawingStore.delete(for: president.id)
            appModel.setDrawingFileName(nil, for: president)
        } else if let fileName = try? PresidentDrawingStore.save(drawing, imageSize: photo.size, for: president.id) {
            appModel.setDrawingFileName(fileName, for: president)
        }
    }
}

/// Handle the SwiftUI side keeps onto the UIKit canvas, for Clear and for reading the drawing
/// back out on save.
final class DrawingCanvasController {
    // Strong so the canvas is still readable in the editor's `onDisappear`, even if SwiftUI has
    // already dismantled the representable by then.
    fileprivate var canvas: PhotoDrawingCanvasView?

    func clear() {
        canvas?.drawing = PKDrawing()
    }

    func imageSpaceDrawing() -> PKDrawing? {
        canvas?.imageSpaceDrawing
    }
}

private struct DrawingCanvas: UIViewRepresentable {
    let controller: DrawingCanvasController
    let imageSize: CGSize
    let presidentID: President.ID

    func makeUIView(context: Context) -> PhotoDrawingCanvasView {
        let canvas = PhotoDrawingCanvasView()
        canvas.imageSize = imageSize
        canvas.pendingDrawing = PresidentDrawingStore.loadDrawing(for: presidentID)
        controller.canvas = canvas
        return canvas
    }

    func updateUIView(_ canvas: PhotoDrawingCanvasView, context: Context) {}

    static func dismantleUIView(_ canvas: PhotoDrawingCanvasView, coordinator: ()) {
        canvas.toolPicker.setVisible(false, forFirstResponder: canvas)
        canvas.toolPicker.removeObserver(canvas)
    }
}

/// A transparent `PKCanvasView` that keeps its strokes in step with the photo underneath it.
/// Strokes live in canvas points while editing, but are loaded from and handed back in the
/// photo's own point space (`imageSize`), and are rescaled if the canvas is resized (rotation,
/// split view) so they stay pinned to the same spot on the photo.
private final class PhotoDrawingCanvasView: PKCanvasView {
    let toolPicker = PKToolPicker()
    var imageSize: CGSize = .zero
    /// A drawing in image coordinates, waiting for the first non-zero layout to be scaled in.
    var pendingDrawing: PKDrawing?
    private var laidOutWidth: CGFloat = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        isScrollEnabled = false
        drawingPolicy = .anyInput
        // Ink colors are shown as picked on top of a photo, not inverted for dark mode.
        overrideUserInterfaceStyle = .light
        tool = PKInkingTool(.pen, color: .systemRed, width: 5)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil else { return }
        toolPicker.addObserver(self)
        toolPicker.setVisible(true, forFirstResponder: self)
        becomeFirstResponder()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let width = bounds.width
        guard width > 0, imageSize.width > 0 else { return }
        if let pending = pendingDrawing {
            let scale = width / imageSize.width
            drawing = pending.transformed(using: CGAffineTransform(scaleX: scale, y: scale))
            pendingDrawing = nil
        } else if laidOutWidth > 0, width != laidOutWidth {
            let scale = width / laidOutWidth
            drawing = drawing.transformed(using: CGAffineTransform(scaleX: scale, y: scale))
        }
        laidOutWidth = width
    }

    var imageSpaceDrawing: PKDrawing? {
        // Never laid out means the saved drawing was never loaded in — nothing to write back.
        guard laidOutWidth > 0 else { return nil }
        let scale = imageSize.width / laidOutWidth
        return drawing.transformed(using: CGAffineTransform(scaleX: scale, y: scale))
    }
}
