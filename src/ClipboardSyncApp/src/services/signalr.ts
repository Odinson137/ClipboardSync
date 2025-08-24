import { HubConnectionBuilder, HttpTransportType, LogLevel } from '@microsoft/signalr';
import { SERVER_URL } from './api';
import * as Clipboard from '@react-native-clipboard/clipboard';
import { Buffer } from 'buffer';
import AesGcmCrypto from 'react-native-aes-gcm-crypto';
import { NativeModules } from 'react-native';

const { NativeBridgeModule } = NativeModules;

class SignalRService {
    private connection: any = null;
    private cipherEnabled = false;
    private salt = '';
    private prevHash = '';
    private blockImageOnce = false;
    private maxsize = 10485760;
    private maxLocalLimit = 10485760;
    private enableImage = true;
    private enableFiles = true;

    configure(options: {
        cipherEnabled?: string,
        salt?: string,
        maxsize?: number,
        maxLocalLimit?: number,
        enableImage?: string,
        enableFiles?: string
    }) {
        this.cipherEnabled = options.cipherEnabled === 'true';
        this.salt = options.salt || '';
        this.maxsize = options.maxsize || 10485760;
        this.maxLocalLimit = options.maxLocalLimit || 10485760;
        this.enableImage = options.enableImage !== 'false';
        this.enableFiles = options.enableFiles !== 'false';
    }

    async connect(deviceName: string, deviceId: string, token: string) {
        if (this.connection) {
            try { await this.connection.stop(); } catch {}
        }

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

        this.connection.on('ReceiveClipboard', async (_id: string, content: string, type: number) => {
            try {
                let cb = String(content);
                const type_ = type === 0 ? 'text' : type === 1 ? 'image' : 'files';

                if (this.cipherEnabled) {
                    cb = await this.decrypt(cb);
                }

                if (await this.validateSize(cb, type_, 'inbound')) {
                    if (type_ === 'text') {
                        Clipboard.default.setString(cb);
                        console.log('[SignalR] Text clipboard updated from server');
                    } else if (type_ === 'image') {
                        try {
                            await NativeBridgeModule.copyBase64ImageToClipboardUsingCache(cb);
                            this.blockImageOnce = true;
                            console.log('[SignalR] Image received and copied');
                        } catch (e) {
                            console.error('Image copy error', e);
                        }
                    }
                }
            } catch (e) {
                console.error('Inbound error', e);
            }
        });

        this.connection.onreconnected(() => {
            console.log('[SignalR] ✅ Reconnected');
        });

        this.connection.onclose(() => {
            this.blockImageOnce = false;
            console.log('[SignalR] ⚠️ Connection closed');
        });

        try {
            await this.connection.start();
            console.log('[SignalR] Connected');
        } catch (err) {
            console.error('[SignalR] Connection error', err);
            setTimeout(() => this.connect(deviceName, deviceId, token), 3000);
        }
    }

    async sendClipboard(content: string, type_: 'text' | 'image' | 'files' = 'text') {
        try {
            if (this.blockImageOnce) {
                this.blockImageOnce = false;
                return;
            }

            if ((type_ === 'image' && !this.enableImage) ||
                (type_ === 'files' && !this.enableFiles)) return;

            if (await this.validateSize(content, type_, 'outbound')) {
                let processed = content;

                if (type_ === 'image') {
                    processed = await NativeBridgeModule.getFileAsBase64(content);
                }

                if (this.cipherEnabled) {
                    processed = await this.encrypt(processed);
                }

                const typeCode = type_ === 'text' ? 0 : type_ === 'image' ? 1 : 2;
                await this.connection.invoke('SendClipboard', processed, typeCode);
                console.log(`[SignalR] Sent ${type_}`);
            }
        } catch (e) {
            this.blockImageOnce = false;
            console.error('Outbound error', e);
        }
    }

    async disconnect() {
        if (this.connection) {
            try {
                await this.connection.stop();
                console.log('[SignalR] Disconnected');
            } catch (err) {
                console.error('Ошибка при отключении SignalR', err);
            }
            this.connection = null;
        }
    }

    isConnected() {
        return this.connection && this.connection.state === 'Connected';
    }

    // 🔒 Helpers
    private async encrypt(plainText: string) {
        try {
            const encrypted = await AesGcmCrypto.encrypt(plainText, false, this.salt);
            return JSON.stringify({
                nonce: Buffer.from(encrypted.iv, 'hex').toString('base64'),
                ciphertext: encrypted.content,
                tag: Buffer.from(encrypted.tag, 'hex').toString('base64'),
            });
        } catch {
            return plainText;
        }
    }

    private async decrypt(encryptedData: any) {
        try {
            const data = typeof encryptedData === 'string' ? JSON.parse(encryptedData) : encryptedData;
            return await AesGcmCrypto.decrypt(
                data.ciphertext,
                this.salt,
                Buffer.from(data.nonce, 'base64').toString('hex'),
                Buffer.from(data.tag, 'base64').toString('hex'),
                false,
            );
        } catch {
            return encryptedData;
        }
    }

    private async validateSize(content: any, type: string, dir: 'inbound' | 'outbound') {
        let len = 0;
        if (type === 'text') len = Buffer.byteLength(content, 'utf8');
        else len = Buffer.byteLength(JSON.stringify(content), 'utf8');

        if (len <= this.maxsize && len <= this.maxLocalLimit) return true;
        console.log(`⚠️ ${dir} ignored: too big (${len})`);
        return false;
    }
}

export const signalRService = new SignalRService();
