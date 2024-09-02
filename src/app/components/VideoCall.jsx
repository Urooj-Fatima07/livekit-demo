'use client';

import { useEffect, useRef, useState } from 'react';
import { Room, createLocalTracks } from 'livekit-client';

const VideoCall = ({ token }) => {
  const [room, setRoom] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const localVideoRef = useRef(null);
  const screenShareRef = useRef(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const connectToRoom = async () => {
      if (!token) return;

      try {
        const room = new Room();
        room.on('disconnected', () => {
          console.warn('Disconnected from room.');
          setRoom(null);
        });

        room.on('reconnected', () => {
          console.log('Reconnected to room.');
        });

        await room.connect('wss://liveconnectsphere-vtny1wpc.livekit.cloud', token);
        setRoom(room);

        const [audioTrack, videoTrack] = await createLocalTracks({
          audio: true,
          video: true,
        });

        await room.localParticipant.publishTrack(audioTrack);
        await room.localParticipant.publishTrack(videoTrack);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([videoTrack.mediaStreamTrack]);
        }

        const stream = new MediaStream([videoTrack.mediaStreamTrack, audioTrack.mediaStreamTrack]);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recorder.ondataavailable = handleDataAvailable;
        recorder.onstop = handleStopRecording;
        setMediaRecorder(recorder);

        const handleTrackSubscribed = (track, publication, participant) => {
          if (track.kind === 'video') {
            if (track.source === 'screen') {
              if (screenShareRef.current) {
                screenShareRef.current.srcObject = new MediaStream([track.mediaStreamTrack]);
                setIsScreenSharing(true);
              }
            } else {
              setRemoteParticipants(prevParticipants => {
                const existing = prevParticipants.find(p => p.identity === participant.identity);
                if (existing) {
                  return prevParticipants.map(p =>
                    p.identity === participant.identity ? { ...p, track } : p
                  );
                } else {
                  return [...prevParticipants, { identity: participant.identity, track }];
                }
              });
            }
          }
        };

        room.on('trackSubscribed', handleTrackSubscribed);

        return () => {
          room.off('trackSubscribed', handleTrackSubscribed);
          room.disconnect();
        };
      } catch (err) {
        console.error('Error connecting to LiveKit room:', err);
      }
    };

    connectToRoom();
  }, [token]);

  const handleTrackSubscribed = (track, publication, participant) => {
    if (track.kind === 'video') {
      if (track.source === 'screen') {
        if (screenShareRef.current) {
          screenShareRef.current.srcObject = new MediaStream([track.mediaStreamTrack]);
          setIsScreenSharing(true);
        }
      } else {
        setRemoteParticipants(prevParticipants => {
          const existing = prevParticipants.find(p => p.identity === participant.identity);
          if (existing) {
            return prevParticipants.map(p =>
              p.identity === participant.identity ? { ...p, track } : p
            );
          } else {
            return [...prevParticipants, { identity: participant.identity, track }];
          }
        });
      }
    }
  };

  const handleScreenShare = async () => {
    if (!room || room.state !== 'connected') {
      console.error('Room is not connected, cannot share screen.');
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      const trackPublications = room.localParticipant.trackPublications;
      const existingScreenPublication = trackPublications
        ? Array.from(trackPublications.values()).find(publication =>
          publication.track && publication.track.source === 'screen'
        )
        : null;

      if (existingScreenPublication) {
        await room.localParticipant.unpublishTrack(existingScreenPublication.track);
      }

      await room.localParticipant.publishTrack(screenTrack);
      setIsScreenSharing(true);
      console.log('Screen shared successfully');
    } catch (err) {
      console.error('Error sharing screen:', err);
      setIsScreenSharing(false);
    }
  };

  const handleStartRecording = () => {
    if (mediaRecorder && !isRecording) {
      mediaRecorder.start();
      setIsRecording(true);
      console.log('Recording started');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      console.log('Recording stopped');
    }
  };

  const handleDataAvailable = (event) => {
    if (event.data.size > 0) {
      setRecordedChunks(prevChunks => [...prevChunks, event.data]);
    }
  };

  const handleDownload = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recording.mp4'; // Renamed extension to .mp4
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-100 to-purple-100 overflow-hidden">
      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center py-2 font-bold text-lg">
          Recording...
        </div>
      )}
      
      <div className="relative z-10 bg-transparent p-6 rounded-lg max-w-4xl w-full mx-4 md:mx-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Video Call</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Local Video */}
          <div className="flex flex-col items-center space-y-2">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              className="w-full h-auto bg-gray-900 rounded-lg shadow-md"
            ></video>
            <span className="text-sm text-gray-600">Your Video</span>
          </div>
          
          {/* Remote Participants */}
          <div className="flex flex-col items-center space-y-4">
            {remoteParticipants.map((participant, index) => (
              <div key={index} className="flex flex-col items-center space-y-2">
                <video
                  autoPlay
                  className="w-full h-64 bg-gray-900 rounded-lg shadow-md"
                  ref={el => {
                    if (el) {
                      el.srcObject = new MediaStream([participant.track.mediaStreamTrack]);
                    }
                  }}
                ></video>
                <span className="text-sm text-gray-600">{participant.identity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:justify-center mt-6 space-y-4 md:space-y-0 md:space-x-4">
          <button
            onClick={handleScreenShare}
            className="py-2 px-4 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-300 ease-in-out"
          >
            Share Screen
          </button>

          <button
            onClick={handleStartRecording}
            className="py-2 px-4 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300 ease-in-out"
          >
            Start Recording
          </button>

          <button
            onClick={handleStopRecording}
            className="py-2 px-4 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition duration-300 ease-in-out"
          >
            Stop Recording
          </button>

          <button
            onClick={handleDownload}
            className="py-2 px-4 bg-gray-600 text-white rounded-lg shadow-md hover:bg-gray-700 transition duration-300 ease-in-out"
            disabled={recordedChunks.length === 0}
          >
            Download Recording
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
