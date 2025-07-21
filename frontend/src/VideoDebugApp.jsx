import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'

// Simple video test component to debug video issues
function VideoDebugApp() {
  const [hasPermission, setHasPermission] = useState(false)
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const videoRef = useRef(null)

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-10), `${timestamp}: ${message}`])
    console.log(`[VideoDebug] ${message}`)
  }

  const requestCamera = async () => {
    try {
      addLog('Requesting camera access...')
      setError(null)
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      })
      
      addLog(`Camera access granted! Stream ID: ${mediaStream.id}`)
      addLog(`Video tracks: ${mediaStream.getVideoTracks().length}`)
      addLog(`Audio tracks: ${mediaStream.getAudioTracks().length}`)
      
      setStream(mediaStream)
      setHasPermission(true)
      
      // Set video element source
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        addLog('Video element srcObject set')
        
        // Try to play
        try {
          await videoRef.current.play()
          addLog('Video playback started successfully')
        } catch (playError) {
          addLog(`Video play error: ${playError.message}`)
        }
      }
      
    } catch (err) {
      addLog(`Camera error: ${err.name} - ${err.message}`)
      setError(err.message)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop()
        addLog(`Stopped ${track.kind} track`)
      })
      setStream(null)
      setHasPermission(false)
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      addLog('Camera stopped')
    }
  }

  // Video element event handlers
  const handleVideoLoad = () => addLog('Video loaded')
  const handleVideoPlay = () => addLog('Video playing')
  const handleVideoError = (e) => addLog(`Video error: ${e.target.error?.message || 'Unknown error'}`)

  useEffect(() => {
    addLog('VideoDebugApp initialized')
    
    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Video Debug Tool</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button 
                  onClick={requestCamera} 
                  disabled={hasPermission}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Request Camera
                </Button>
                <Button 
                  onClick={stopCamera} 
                  disabled={!hasPermission}
                  variant="destructive"
                >
                  Stop Camera
                </Button>
              </div>
              
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  Error: {error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Video Display */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Video Output</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls
                className="w-full h-64 object-cover bg-gray-900"
                onLoadedData={handleVideoLoad}
                onPlay={handleVideoPlay}
                onError={handleVideoError}
                style={{ backgroundColor: '#111827' }}
              />
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Stream Info:</strong>
                <ul className="mt-2 space-y-1">
                  <li>Has Permission: {hasPermission ? '✅' : '❌'}</li>
                  <li>Stream Active: {stream ? '✅' : '❌'}</li>
                  <li>Video Element: {videoRef.current ? '✅' : '❌'}</li>
                  <li>Video Source Set: {videoRef.current?.srcObject ? '✅' : '❌'}</li>
                </ul>
              </div>
              
              <div>
                <strong>Stream Details:</strong>
                {stream && (
                  <ul className="mt-2 space-y-1">
                    <li>Stream ID: {stream.id.substring(0, 8)}...</li>
                    <li>Video Tracks: {stream.getVideoTracks().length}</li>
                    <li>Audio Tracks: {stream.getAudioTracks().length}</li>
                    <li>Active: {stream.active ? '✅' : '❌'}</li>
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default VideoDebugApp