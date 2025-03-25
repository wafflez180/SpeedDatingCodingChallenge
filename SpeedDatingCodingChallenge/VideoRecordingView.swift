import SwiftUI
import WebKit
import UIKit
import AVFoundation

struct VideoRecordingView: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    @Binding var recordedVideoURL: URL?
    let webView: MagicTextView?
    let onVideoRecorded: (URL) -> Void
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        print("VideoRecordingView: Creating UIImagePickerController")
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = .camera
        picker.mediaTypes = ["public.movie"]
        picker.videoQuality = .typeHigh
        picker.cameraCaptureMode = .video
        picker.videoMaximumDuration = 45 // Limit video duration to 45 seconds
        
        // Configure camera if possible
        if let cameraDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) {
            do {
                try cameraDevice.lockForConfiguration()
                if cameraDevice.isExposureModeSupported(.continuousAutoExposure) {
                    cameraDevice.exposureMode = .continuousAutoExposure
                }
                if cameraDevice.isWhiteBalanceModeSupported(.continuousAutoWhiteBalance) {
                    cameraDevice.whiteBalanceMode = .continuousAutoWhiteBalance
                }
                cameraDevice.unlockForConfiguration()
            } catch {
                print("VideoRecordingView Error: Failed to configure camera: \(error)")
            }
        }
        
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: VideoRecordingView
        
        init(_ parent: VideoRecordingView) {
            self.parent = parent
            super.init()
            print("VideoRecordingView Coordinator: Initialized")
        }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            print("VideoRecordingView: Did finish picking media")
            
            guard let videoURL = info[.mediaURL] as? URL else {
                print("VideoRecordingView Error: No video URL in picker info")
                DispatchQueue.main.async {
                    self.parent.isPresented = false
                }
                return
            }
            
            print("VideoRecordingView: Video recorded at URL:", videoURL.path)
            
            // Create a temporary file URL
            let tempDir = FileManager.default.temporaryDirectory
            let videoName = "video_\(Date().timeIntervalSince1970).mov"
            let tempURL = tempDir.appendingPathComponent(videoName)
            
            do {
                // Copy the video to our temporary location
                if FileManager.default.fileExists(atPath: tempURL.path) {
                    try FileManager.default.removeItem(at: tempURL)
                }
                try FileManager.default.copyItem(at: videoURL, to: tempURL)
                print("VideoRecordingView: Copied video to temporary location:", tempURL.path)
                
                // Update the recordedVideoURL
                self.parent.recordedVideoURL = tempURL
                
                // Process and send the video
                print("VideoRecordingView: Reading video data")
                let videoData = try Data(contentsOf: tempURL)
                print("VideoRecordingView: Video data size:", videoData.count, "bytes")
                let base64String = videoData.base64EncodedString()
                print("VideoRecordingView: Base64 string length:", base64String.count)
                
                // First, verify the JavaScript event is received
                let setupLoggingScript = """
                    // Initialize window.listeners if it doesn't exist
                    if (!window.listeners) {
                        window.listeners = {};
                    }
                    
                    // Set up logging bridge
                    window.iosLog = function(type, ...args) {
                        const message = args.map(arg => {
                            if (typeof arg === 'object') {
                                return JSON.stringify(arg, null, 2);
                            }
                            return String(arg);
                        }).join(' ');
                        window.webkit.messageHandlers.logger.postMessage({
                            type: type,
                            message: message
                        });
                    };
                    
                    // Override console methods
                    const originalConsole = {
                        log: console.log,
                        error: console.error,
                        warn: console.warn,
                        info: console.info
                    };
                    
                    console.log = function(...args) {
                        originalConsole.log.apply(console, args);
                        window.iosLog('log', ...args);
                    };
                    
                    console.error = function(...args) {
                        originalConsole.error.apply(console, args);
                        window.iosLog('error', ...args);
                    };
                    
                    console.warn = function(...args) {
                        originalConsole.warn.apply(console, args);
                        window.iosLog('warn', ...args);
                    };
                    
                    console.info = function(...args) {
                        originalConsole.info.apply(console, args);
                        window.iosLog('info', ...args);
                    };
                    
                    // Initialize event listeners
                    window.listeners = window.listeners || {};
                    window.listeners.videoRecorded = true;
                    window.listeners.stopVideoRecording = true;
                    window.listeners.recordingCancelled = true;
                    
                    // Test logging
                    console.log('Logging bridge and listeners initialized');
                """
                
                let verifyScript = """
                    \(setupLoggingScript)
                    
                    console.log('iOS Test: Setting up test event listener');
                    window.addEventListener('test-event', function(e) {
                        console.log('iOS Test: Event listener triggered with detail:', e.detail);
                    }, { once: true });
                    console.log('iOS Test: Dispatching test event');
                    window.dispatchEvent(new CustomEvent('test-event', { detail: 'test' }));
                    console.log('iOS Test: Test event dispatched');
                """
                
                if let magicTextView = self.parent.webView {
                    print("iOS: Found MagicTextView, setting up logging bridge")
                    
                    // First set up logging - we need to find the WKWebView
                    if let webView = magicTextView.subviews.first as? WKWebView {
                        print("iOS: Found WKWebView, adding message handler")
                        webView.configuration.userContentController.add(LogHandler(), name: "logger")
                        
                        print("iOS: Executing setup script")
                        webView.evaluateJavaScript(verifyScript) { result, error in
                            if let error = error {
                                print("iOS Error: Test script failed:", error.localizedDescription)
                            } else {
                                print("iOS: Test script executed successfully")
                                // Then send the actual video data
                                let videoScript = """
                                    console.log('iOS: Starting video data transmission');
                                    try {
                                        // Ensure window.listeners exists
                                        if (!window.listeners) {
                                            window.listeners = {};
                                        }
                                        
                                        // Initialize listeners if they don't exist
                                        window.listeners.videoRecorded = true;
                                        window.listeners.stopVideoRecording = true;
                                        window.listeners.recordingCancelled = true;
                                        
                                        // First ensure React is ready
                                        window.ReactIsReady = true;
                                        console.log('iOS: Set React ready state to true');
                                        
                                        // Create and dispatch the event
                                        console.log('iOS: Creating video event with data length:', '\(base64String.count)');
                                        
                                        // First, verify event listeners
                                        console.log('iOS: Current event listeners:', Object.keys(window.listeners));
                                        
                                        const videoEvent = new CustomEvent('videoRecorded', {
                                            detail: {
                                                videoData: '\(base64String)',
                                                fileName: '\(videoURL.lastPathComponent)',
                                                mimeType: 'video/quicktime'
                                            }
                                        });
                                        
                                        // Log before dispatch
                                        console.log('iOS: About to dispatch video event');
                                        window.dispatchEvent(videoEvent);
                                        console.log('iOS: Video event dispatched');
                                        
                                        // Verify the event was handled
                                        setTimeout(() => {
                                            console.log('iOS: Checking video processing results');
                                            console.log('iOS: State check:', {
                                                videoUrl: window._videoUrl ? 'set' : 'not set',
                                                hasVideo: window._hasVideo,
                                                videoBlob: window._videoBlob ? 'exists' : 'not found',
                                                reactState: window.reactState || {},
                                                listeners: window.listeners || {}
                                            });
                                        }, 1000);
                                    } catch(e) {
                                        console.error('iOS Error: Failed to dispatch video event:', e);
                                    }
                                """
                                
                                print("iOS: Executing video data script")
                                webView.evaluateJavaScript(videoScript) { result, error in
                                    if let error = error {
                                        print("iOS Error: Video script failed:", error.localizedDescription)
                                    } else {
                                        print("iOS: Video script executed successfully")
                                        // Verify the event was received
                                        let verifyReceiptScript = """
                                            console.log('iOS: Verifying video data transmission');
                                            if (window._lastReceivedVideoData) {
                                                console.log('iOS: Video data received by web app, length:', window._lastReceivedVideoData.length);
                                            } else {
                                                console.error('iOS: No video data found in web app');
                                            }
                                        """
                                        
                                        webView.evaluateJavaScript(verifyReceiptScript) { result, error in
                                            if let error = error {
                                                print("iOS Error: Verification script failed:", error.localizedDescription)
                                            } else {
                                                print("iOS: Verification script executed successfully")
                                                // Call the completion handler
                                                self.parent.onVideoRecorded(videoURL)
                                                print("iOS: Video recording completion handler called")
                                                
                                                // Close the picker
                                                DispatchQueue.main.async {
                                                    self.parent.isPresented = false
                                                    print("iOS: Camera picker dismissed")
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        print("iOS Error: Could not find WKWebView in MagicTextView")
                        DispatchQueue.main.async {
                            self.parent.isPresented = false
                        }
                    }
                } else {
                    print("iOS Error: MagicTextView not found")
                    DispatchQueue.main.async {
                        self.parent.isPresented = false
                    }
                }
            } catch {
                print("VideoRecordingView Error: Failed to process video:", error)
                DispatchQueue.main.async {
                    self.parent.isPresented = false
                }
            }
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            print("VideoRecordingView: Recording cancelled")
            DispatchQueue.main.async {
                self.parent.isPresented = false
            }
        }
    }
}

class LogHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let body = message.body as? [String: Any],
           let type = body["type"] as? String,
           let message = body["message"] as? String {
            switch type {
            case "error":
                print("React Error:", message)
            case "warn":
                print("React Warning:", message)
            case "info":
                print("React Info:", message)
            default:
                print("React Log:", message)
            }
        }
    }
} 
