import SwiftUI
import WebKit

private let webAppURL = URL(string: "https://early-bats-wave.loca.lt")!

/// Provides the state of loading web content
public enum MagicTextState {
    case loading
    case loaded
    case failed(any Error)
}

/// A UIView subclass that loads the Magic Text Web App
public class MagicTextView: UIView {

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private let webView = WKWebView()

    private func setup() {
        webView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(webView)
        addConstraints([
            webView.leadingAnchor.constraint(equalTo: leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: trailingAnchor),
            webView.topAnchor.constraint(equalTo: topAnchor),
            webView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])

        webView.navigationDelegate = self
        
        // Add message handler for video recording
        let contentController = webView.configuration.userContentController
        contentController.add(self, name: "videoRecorder")
    }

    /// Begins a request to load the web app. Calling while a request is in progress has no effect.
    public func refresh() {
        // Make sure a request isn't already in progress
        guard request == nil else { return }

        DispatchQueue.main.async {
            self.onStateChange?(.loading)
        }
        performRequest(kind: .network)
    }

    /// Set this to be notified of web content loading updates
    public var onStateChange: ((MagicTextState) -> Void)?

    private enum RequestKind {
        case network
        case cache
    }

    private var request: RequestKind?

    private func performRequest(kind: RequestKind) {
        request = kind

        let cachePolicy: URLRequest.CachePolicy = switch kind {
        case .network:
            .useProtocolCachePolicy
        case .cache:
            .returnCacheDataElseLoad
        }

        webView.load(URLRequest(url: webAppURL, cachePolicy: cachePolicy))
    }

    public func executeJavaScript(_ script: String, completion: ((Any?, Error?) -> Void)? = nil) {
        webView.evaluateJavaScript(script, completionHandler: completion)
    }

}

extension MagicTextView: WKNavigationDelegate {

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
        request = nil
        onStateChange?(.failed(error))
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
        switch request {
        case .none:
            break
        case .network:
            performRequest(kind: .cache)
        case .cache:
            request = nil
            onStateChange?(.failed(error))
        }
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        request = nil
        onStateChange?(.loaded)
    }

}

extension MagicTextView: WKScriptMessageHandler {
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "videoRecorder" {
            if let body = message.body as? [String: Any],
               let action = body["action"] as? String {
                switch action {
                case "startRecording":
                    NotificationCenter.default.post(name: .startVideoRecording, object: nil)
                case "stopRecording":
                    NotificationCenter.default.post(name: .stopVideoRecording, object: nil)
                default:
                    break
                }
            }
        }
    }
}

/// A SwiftUI View that loads the Magic Text Web App
@available(iOS 13.0, *)
public struct MagicText: UIViewRepresentable {
    
    /// - parameter shouldRefresh: set this to `true` to start a new request to load web content
    /// - parameter onWebViewCreated: callback when the MagicTextView is created
    /// - parameter onStateChange: provide this callback to be notified of web content loading updates
    public init(shouldRefresh: Binding<Bool>, 
               onWebViewCreated: ((MagicTextView) -> Void)? = nil,
               onStateChange: ((MagicTextState) -> Void)? = nil) {
        _shouldRefresh = shouldRefresh
        self.onWebViewCreated = onWebViewCreated
        self.onStateChange = onStateChange
    }

    @Binding private var shouldRefresh: Bool
    private let onWebViewCreated: ((MagicTextView) -> Void)?
    private let onStateChange: ((MagicTextState) -> Void)?

    public func makeUIView(context: Context) -> MagicTextView {
        let view = MagicTextView()
        context.coordinator.webView = view
        onWebViewCreated?(view)
        return view
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    public class Coordinator {
        weak var webView: MagicTextView?
    }

    public func updateUIView(_ uiView: MagicTextView, context: Context) {
        uiView.onStateChange = onStateChange

        if shouldRefresh {
            uiView.refresh()
            Task { @MainActor in
                shouldRefresh = false
            }
        }
    }

}
