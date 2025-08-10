import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from '../services/api';

interface AuthScreenProps {
    onLoginSuccess: (token: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');

    const handleAuth = async () => {
        try {
            const endpoint = isLogin ? '/api/user/login' : '/api/user/register';
            const response = await fetch(`${SERVER_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName, password }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Auth error');
            }

            const { token } = data;
            await AsyncStorage.setItem('token', token);
            await AsyncStorage.setItem('userName', userName);
            onLoginSuccess(token);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Request failed');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{isLogin ? 'Login' : 'Register'}</Text>
            <TextInput
                style={styles.input}
                placeholder="Username"
                value={userName}
                onChangeText={setUserName}
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <Button title={isLogin ? 'Login' : 'Register'} onPress={handleAuth} />
            <Button
                title={`Switch to ${isLogin ? 'Register' : 'Login'}`}
                onPress={() => setIsLogin(!isLogin)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 },
});

export default AuthScreen;
