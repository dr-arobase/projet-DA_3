import 'dotenv/config';
import { io as ioClient } from 'socket.io-client';

const badge = process.argv[2] || 'PL-003';
const password = process.argv[3] || 'Test1234!';

const loginRes = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ badge_number: badge, password })
});
const { token } = await loginRes.json();

const socket = ioClient('http://localhost:3000', { auth: { token } });

socket.on('connect', () => console.log('Connecté :', socket.id));
socket.on('presence:update', (list) => console.log('presence:update ->', list));
socket.on('criminal:added', (c) => console.log('criminal:added ->', c));
socket.on('criminal:updated', (c) => console.log('criminal:updated ->', c));
socket.on('criminal:removed', (c) => console.log('criminal:removed ->', c));
socket.on('alert:broadcast', (a) => console.log('alert:broadcast ->', a));
socket.on('connect_error', (err) => console.error('Erreur de connexion :', err.message));