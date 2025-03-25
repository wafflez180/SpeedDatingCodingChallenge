//
//  ContentView.swift
//  SpeedDatingCodingChallenge
//
//  Created by Arthur De Araujo on 3/24/25.
//

import SwiftUI
import WebKit

struct ContentView: View {
    @State private var shouldRefresh = false
    @State private var webViewState: MagicTextState = .loading
    @State private var showVideoRecorder = false
    @State private var recordedVideoURL: URL?
    @State private var webView: MagicTextView?
    
    var body: some View {
        NavigationView {
            MagicText(shouldRefresh: $shouldRefresh, onWebViewCreated: { magicTextView in
                DispatchQueue.main.async {
                    webView = magicTextView
                }
            }) { state in
                DispatchQueue.main.async {
                    webViewState = state
                }
            }
            .navigationTitle("Speed Dating")
            .overlay {
                switch webViewState {
                case .loading:
                    ProgressView("Loading...")
                        .padding()
                        .background(Color(.systemBackground))
                        .cornerRadius(10)
                case .failed(let error):
                    VStack {
                        Text("Failed to load content")
                            .foregroundColor(.red)
                        Button("Retry") {
                            shouldRefresh.toggle()
                        }
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(10)
                case .loaded:
                    EmptyView()
                }
            }
            .sheet(isPresented: $showVideoRecorder) {
                VideoRecordingView(
                    isPresented: $showVideoRecorder,
                    recordedVideoURL: $recordedVideoURL,
                    webView: webView
                ) { url in
                    // Convert video to base64 and pass to WebView
                    if let videoData = try? Data(contentsOf: url) {
                        let base64String = videoData.base64EncodedString()
                        // Pass the video data to the WebView
                        let script = """
                            window.dispatchEvent(new CustomEvent('videoRecorded', {
                                detail: {
                                    videoData: '\(base64String)',
                                    fileName: '\(url.lastPathComponent)',
                                    mimeType: 'video/mp4'
                                }
                            }));
                        """
                        webView?.executeJavaScript(script)
                    }
                }
            }
        }
        .onAppear {
            shouldRefresh = true
            
            // Add notification observers
            NotificationCenter.default.addObserver(
                forName: .startVideoRecording,
                object: nil,
                queue: .main
            ) { _ in
                showVideoRecorder = true
            }
            
            NotificationCenter.default.addObserver(
                forName: .stopVideoRecording,
                object: nil,
                queue: .main
            ) { _ in
                showVideoRecorder = false
            }
        }
        .onDisappear {
            // Remove notification observers
            NotificationCenter.default.removeObserver(self)
        }
    }
}
