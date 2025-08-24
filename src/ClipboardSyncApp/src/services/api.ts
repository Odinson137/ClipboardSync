export const SERVER_URL = 'https://probable-dogfish-known.ngrok-free.app';

export async function register(userName: string, password: string) {
    const res = await fetch(`${SERVER_URL}/api/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    return data;
}

export async function login(userName: string, password: string) {
    const res = await fetch(`${SERVER_URL}/api/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    return data;
}
