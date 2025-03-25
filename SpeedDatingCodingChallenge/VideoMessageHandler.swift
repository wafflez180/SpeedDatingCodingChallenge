import WebKit
import AVFoundation

class VideoMessageHandler: NSObject, WKScriptMessageHandler {
    weak var viewController: UIViewController?
    weak var webView: WKWebView?
    private var isRecording = false
    private var videoRecorder: VideoRecorder?
    
    init(viewController: UIViewController?, webView: WKWebView?) {
        self.viewController = viewController
        self.webView = webView
        super.init()
        print("VideoMessageHandler: Initializing")
        setupNotifications()
        videoRecorder = VideoRecorder()
    }
    
    private func setupNotifications() {
        print("VideoMessageHandler: Setting up notifications")
        NotificationCenter.default.addObserver(self,
                                            selector: #selector(handleStopRecording),
                                            name: .stopVideoRecording,
                                            object: nil)
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        print("VideoMessageHandler: Received message from web - \(message.body)")
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            print("VideoMessageHandler: Invalid message format")
            return
        }
        
        switch action {
        case "startRecording":
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                print("VideoMessageHandler: Processing startRecording action")
                if !self.isRecording {
                    self.isRecording = true
                    self.checkCameraPermissionsAndPresent()
                }
            }
        case "stopRecording":
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                print("VideoMessageHandler: Processing stopRecording action")
                if self.isRecording {
                    self.isRecording = false
                    NotificationCenter.default.post(name: .stopVideoRecording, object: nil)
                    self.notifyWebAppOfStopRecording()
                }
            }
        default:
            print("VideoMessageHandler: Unknown action received - \(action)")
            break
        }
    }
    
    private func checkCameraPermissionsAndPresent() {
        print("VideoMessageHandler: Checking camera permissions")
        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            print("VideoMessageHandler: Camera permission response - granted: \(granted)")
            if granted {
                AVCaptureDevice.requestAccess(for: .audio) { audioGranted in
                    print("VideoMessageHandler: Audio permission response - granted: \(audioGranted)")
                    DispatchQueue.main.async {
                        if audioGranted {
                            print("VideoMessageHandler: Presenting video preview")
                            if let videoRecorder = self?.videoRecorder {
                                let previewVC = VideoPreviewViewController(videoRecorder: videoRecorder)
                                previewVC.modalPresentationStyle = .fullScreen
                                self?.viewController?.present(previewVC, animated: true)
                            } else {
                                print("VideoMessageHandler: ERROR - VideoRecorder not initialized")
                                self?.notifyWebAppOfError("Failed to initialize video recorder")
                            }
                        } else {
                            print("VideoMessageHandler: Audio permission denied")
                            self?.notifyWebAppOfError("Microphone permission denied")
                        }
                    }
                }
            } else {
                print("VideoMessageHandler: Camera permission denied")
                self?.notifyWebAppOfError("Camera permission denied")
            }
        }
    }
    
    private func notifyWebAppOfError(_ message: String) {
        let script = """
            console.error('iOS Error: \(message)');
            window.dispatchEvent(new CustomEvent('recordingError', {
                detail: '\(message)'
            }));
        """
        webView?.evaluateJavaScript(script, completionHandler: nil)
    }
    
    private func notifyWebAppOfStopRecording() {
        let script = """
            console.log('iOS: Stopping video recording');
            window.dispatchEvent(new CustomEvent('stopVideoRecording'));
        """
        webView?.evaluateJavaScript(script) { [weak self] result, error in
            if let error = error {
                print("Error notifying web app of stop recording: \(error)")
                self?.notifyWebAppOfError("Failed to stop recording")
            }
        }
    }
    
    @objc private func handleStopRecording() {
        isRecording = false
        videoRecorder?.stopSession()
        notifyWebAppOfStopRecording()
    }
    
    func notifyWebAppOfRecordedVideo(videoURL: URL) {
        guard !videoURL.absoluteString.isEmpty else {
            notifyWebAppOfError("Invalid video URL")
            return
        }
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                let videoData = try Data(contentsOf: videoURL)
                let base64String = videoData.base64EncodedString()
                
                DispatchQueue.main.async {
                    let script = """
                        console.log('iOS: Sending recorded video to web app');
                        window.dispatchEvent(new CustomEvent('videoRecorded', {
                            detail: {
                                videoData: '\(base64String)',
                                fileName: '\(videoURL.lastPathComponent)',
                                mimeType: 'video/mp4'
                            }
                        }));
                    """
                    
                    self?.webView?.evaluateJavaScript(script) { result, error in
                        if let error = error {
                            print("Error notifying web app of recorded video: \(error)")
                            self?.notifyWebAppOfError("Failed to process recorded video")
                        }
                    }
                }
            } catch {
                print("Error reading video data: \(error)")
                DispatchQueue.main.async {
                    self?.notifyWebAppOfError("Failed to read video data")
                }
            }
        }
    }
}

extension UIViewController {
    func presentVideoRecorder() {
        NotificationCenter.default.post(name: .startVideoRecording, object: nil)
    }
    
    func stopVideoRecording() {
        NotificationCenter.default.post(name: .stopVideoRecording, object: nil)
    }
}

extension Notification.Name {
    static let startVideoRecording = Notification.Name("startVideoRecording")
    static let stopVideoRecording = Notification.Name("stopVideoRecording")
} 