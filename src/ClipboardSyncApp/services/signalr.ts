import { HubConnectionBuilder, HttpTransportType, LogLevel } from '@microsoft/signalr';
import { SERVER_URL } from './api';
import * as Clipboard from '@react-native-clipboard/clipboard';
import {Int32} from "react-native/Libraries/Types/CodegenTypes";

class SignalRService {
    private connection: any = null;

    async connect(deviceName: string, deviceId: string, token: string) {
        if (this.connection) {
            try { await this.connection.stop(); } catch {}
        }

        console.log(`Connecting to: ${SERVER_URL}/hub/clipboardsync?deviceName=${encodeURIComponent(deviceName)}&applicationType=1&deviceIdentifier=${deviceId}`);

        this.connection = new HubConnectionBuilder()
            .withUrl(
                `${SERVER_URL}/hub/clipboardsync?deviceName=${encodeURIComponent(deviceName)}&applicationType=1&deviceIdentifier=${deviceId}`,
                {
                    accessTokenFactory: () => token || '',
                    skipNegotiation: true,
                    transport: HttpTransportType.WebSockets,
                }
            )
            .withAutomaticReconnect()
            .configureLogging(LogLevel.Information)
            .build();

        this.connection.on('ReceiveClipboard', (_id: string, content: string, type: Int32) => {
            if (type === 0) {
                Clipboard.default.setString(content);
                console.log('[SignalR] Clipboard updated from server:', content);
            }
        });

        try {
            await this.connection.start();
            console.log('[SignalR] Connected');
        } catch (err) {
            console.error('[SignalR] Connection error', err);
            setTimeout(() => this.connect(deviceName, deviceId, token), 3000);
        }
    }

    async sendClipboard(text: string, type = 0) {
        if (!this.connection) return;
        try {
            await this.connection.invoke('SendClipboard', text, type);
            console.log('[SignalR] Clipboard sent:', text);
        } catch (err) {
            console.error('[SignalR] SendClipboard failed', err);
        }
    }

    async disconnect() {
        if (this.connection) {
            try {
                await this.connection.stop();
                console.log('SignalR disconnected');
            } catch (err) {
                console.error('Ошибка при отключении SignalR', err);
            }
            this.connection = null;
        }
    }

    isConnected() {
        return this.connection && this.connection.state === 'Connected';
    }

}

export const signalRService = new SignalRService();
