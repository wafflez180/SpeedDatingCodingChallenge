import Foundation
import AVFoundation
import UIKit

class VideoRecorder: NSObject, ObservableObject {
    @Published var isRecording = false
    @Published var recordedVideoURL: URL?
    @Published var permissionGranted = false
    
    private var captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureMovieFileOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    
    override init() {
        super.init()
        print("VideoRecorder: Initializing")
        checkPermissions()
        setupNotifications()
    }
    
    private func setupNotifications() {
        print("VideoRecorder: Setting up notifications")
        NotificationCenter.default.addObserver(self,
                                            selector: #selector(handleStartRecording),
                                            name: .startVideoRecording,
                                            object: nil)
        NotificationCenter.default.addObserver(self,
                                            selector: #selector(handleStopRecording),
                                            name: .stopVideoRecording,
                                            object: nil)
    }
    
    @objc private func handleStartRecording() {
        print("VideoRecorder: Handling start recording notification")
        startRecording()
    }
    
    @objc private func handleStopRecording() {
        print("VideoRecorder: Handling stop recording notification")
        stopRecording()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    private func checkPermissions() {
        print("VideoRecorder: Checking permissions")
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            print("VideoRecorder: Camera permission already granted")
            switch AVCaptureDevice.authorizationStatus(for: .audio) {
            case .authorized:
                print("VideoRecorder: Audio permission already granted")
                permissionGranted = true
                setupCaptureSession()
            case .notDetermined:
                print("VideoRecorder: Requesting audio permission")
                AVCaptureDevice.requestAccess(for: .audio) { [weak self] granted in
                    print("VideoRecorder: Audio permission response - granted: \(granted)")
                    DispatchQueue.main.async {
                        if granted {
                            self?.permissionGranted = true
                            self?.setupCaptureSession()
                        }
                    }
                }
            default:
                print("VideoRecorder: Audio permission denied")
                break
            }
        case .notDetermined:
            print("VideoRecorder: Requesting camera permission")
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                print("VideoRecorder: Camera permission response - granted: \(granted)")
                if granted {
                    switch AVCaptureDevice.authorizationStatus(for: .audio) {
                    case .authorized:
                        DispatchQueue.main.async {
                            print("VideoRecorder: Audio permission already granted")
                            self?.permissionGranted = true
                            self?.setupCaptureSession()
                        }
                    case .notDetermined:
                        print("VideoRecorder: Requesting audio permission")
                        AVCaptureDevice.requestAccess(for: .audio) { [weak self] granted in
                            print("VideoRecorder: Audio permission response - granted: \(granted)")
                            DispatchQueue.main.async {
                                if granted {
                                    self?.permissionGranted = true
                                    self?.setupCaptureSession()
                                }
                            }
                        }
                    default:
                        print("VideoRecorder: Audio permission denied")
                        break
                    }
                }
            }
        default:
            print("VideoRecorder: Camera permission denied")
            break
        }
    }
    
    private func setupCaptureSession() {
        captureSession = AVCaptureSession()
        
        guard let captureSession = captureSession else { return }
        
        // Get the back camera
        guard let backCamera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
            print("Unable to access back camera")
            return
        }
        
        do {
            let input = try AVCaptureDeviceInput(device: backCamera)
            if captureSession.canAddInput(input) {
                captureSession.addInput(input)
            }
            
            // Add audio input
            guard let audioDevice = AVCaptureDevice.default(for: .audio) else { return }
            let audioInput = try AVCaptureDeviceInput(device: audioDevice)
            if captureSession.canAddInput(audioInput) {
                captureSession.addInput(audioInput)
            }
            
            // Setup video output
            videoOutput = AVCaptureMovieFileOutput()
            if let videoOutput = videoOutput, captureSession.canAddOutput(videoOutput) {
                captureSession.addOutput(videoOutput)
            }
            
        } catch {
            print("Error setting up capture session: \(error.localizedDescription)")
        }
    }
    
    func startRecording() {
        guard let videoOutput = videoOutput else { return }
        
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let videoName = "video_\(Date().timeIntervalSince1970).mov"
        let videoPath = documentsPath.appendingPathComponent(videoName)
        
        videoOutput.startRecording(to: videoPath, recordingDelegate: self)
        isRecording = true
    }
    
    func stopRecording() {
        videoOutput?.stopRecording()
        isRecording = false
    }
    
    func getPreviewLayer() -> AVCaptureVideoPreviewLayer? {
        guard let captureSession = captureSession else { return nil }
        
        let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.videoGravity = .resizeAspectFill
        return previewLayer
    }
    
    func startSession() {
        print("VideoRecorder: Starting capture session")
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession?.startRunning()
            print("VideoRecorder: Capture session started")
        }
    }
    
    func stopSession() {
        print("VideoRecorder: Stopping capture session")
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession?.stopRunning()
            print("VideoRecorder: Capture session stopped")
        }
    }
}

extension VideoRecorder: AVCaptureFileOutputRecordingDelegate {
    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        if let error = error {
            print("Error recording video: \(error.localizedDescription)")
            return
        }
        
        DispatchQueue.main.async {
            self.recordedVideoURL = outputFileURL
        }
    }
} 