import UIKit
import AVFoundation

class VideoPreviewViewController: UIViewController {
    private var videoRecorder: VideoRecorder
    private var previewView: UIView!
    
    init(videoRecorder: VideoRecorder) {
        self.videoRecorder = videoRecorder
        super.init(nibName: nil, bundle: nil)
        print("VideoPreviewViewController: Initializing with video recorder")
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        print("VideoPreviewViewController: viewDidLoad")
        setupUI()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        print("VideoPreviewViewController: viewWillAppear")
        videoRecorder.startSession()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        print("VideoPreviewViewController: viewWillDisappear")
        videoRecorder.stopSession()
    }
    
    private func setupUI() {
        print("VideoPreviewViewController: Setting up UI")
        view.backgroundColor = .black
        
        previewView = UIView()
        previewView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(previewView)
        
        NSLayoutConstraint.activate([
            previewView.topAnchor.constraint(equalTo: view.topAnchor),
            previewView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            previewView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            previewView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        if let previewLayer = videoRecorder.getPreviewLayer() {
            print("VideoPreviewViewController: Adding preview layer to view")
            previewLayer.frame = view.bounds
            previewView.layer.addSublayer(previewLayer)
        } else {
            print("VideoPreviewViewController: ERROR - Failed to get preview layer")
        }
        
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Close", for: .normal)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)
        view.addSubview(closeButton)
        
        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            closeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16)
        ])
    }
    
    @objc private func closeButtonTapped() {
        print("VideoPreviewViewController: Close button tapped")
        dismiss(animated: true) {
            print("VideoPreviewViewController: Dismissed")
            NotificationCenter.default.post(name: .stopVideoRecording, object: nil)
        }
    }
} 