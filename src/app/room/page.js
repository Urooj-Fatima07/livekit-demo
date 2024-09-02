'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import VideoCall from '../components/VideoCall';

const RoomPage = () => {
  const [token, setToken] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const roomNameParam = params.get('roomName');

    if (tokenParam && roomNameParam) {
      setToken(tokenParam);
      setRoomName(roomNameParam);
    } else {
      setError('Missing token or room name');
    }
  }, []);

  if (token && roomName) {
    return <VideoCall token={token} roomName={roomName} />;
  }

  return (
    <div>
      <h1>Join Room</h1>
      {error && <p>{error}</p>}
    </div>
  );
};

export default RoomPage;
