import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Animated
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

export default function QRScreen({ navigation }: any) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [token, setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const qrScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer: any;
    if (timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else {
      setToken(null);
    }
    return () => clearInterval(timer);
  }, [timeLeft]);

  const generateToken = async () => {
    const val = parseInt(amount);
    if (isNaN(val) || val <= 0) return Alert.alert('잠깐!', '보낼 코인 양을 적어주세요! 🍯');
    if (val > (user?.balance || 0)) return Alert.alert('어라?', '코인이 조금 부족해요! 😿');

    setLoading(true);
    try {
      const res = await api.generateQR(user!.id, val);
      setToken(res.token);
      setTimeLeft(res.expiresIn ?? 300);
      // QR 등장 애니메이션
      Animated.spring(qrScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    } catch (e: any) {
      Alert.alert('에러', e.message);
    } finally {
      setLoading(false);
    }
  };

  // 간단한 QR 표시 (실제는 react-native-qrcode-svg 사용)
  const qrDisplay = token ? token.replace(/-/g, '\n').slice(0, 36) : '';

  return (
    <LinearGradient colors={['#0A0E1A', '#0F1B35']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>QR 코드 결제</Text>
          <View style={{ width: 48 }} />
        </View>

        <View style={styles.body}>
          {/* 잔액 표시 */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>보유 코인</Text>
            <Text style={styles.balanceAmt}>🪙 {user?.balance ?? 0} SDP</Text>
          </View>

          {/* 금액 입력 */}
          <Text style={styles.label}>결제할 코인 수량</Text>
          <View style={styles.inputRow}>
            {[1, 2, 3, 5].map(v => (
              <TouchableOpacity key={v} style={[styles.quickBtn, amount === String(v) && styles.quickBtnActive]}
                onPress={() => setAmount(String(v))}>
                <Text style={[styles.quickBtnText, amount === String(v) && { color: '#FFF' }]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="직접 입력"
            placeholderTextColor="#4A5568"
          />

          {/* QR 생성 버튼 */}
          {!token && (
            <TouchableOpacity style={styles.genBtn} onPress={generateToken} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.genBtnText}>📲 QR 코드 생성</Text>
              }
            </TouchableOpacity>
          )}

          {/* QR 코드 표시 */}
          {token && (
            <View style={styles.qrBox}>
              <View style={styles.qrFrame}>
                {/* 실제 배포 시 QRCode 컴포넌트로 교체 */}
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrIcon}>▣</Text>
                  <Text style={styles.qrToken}>{token.slice(0, 8).toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.qrAmount}>{amount} SDP</Text>
              <Text style={[styles.qrExpiry, timeLeft < 60 && { color: '#EF4444' }]}>
                ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} 후 만료
              </Text>
              <Text style={styles.qrHint}>가맹점 단말기에 이 화면을 보여주세요</Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setToken(null); setTimeLeft(0); }}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 사용 가능 가맹점 안내 */}
          <Text style={styles.sectionTitle}>💳 제휴 가맹점</Text>
          {[
            { icon: '🌭', name: '응봉산 축제 푸드트럭' },
            { icon: '🏊', name: '성동 생활체육센터' },
            { icon: '☕', name: '서울숲 카페' },
          ].map(m => (
            <View key={m.name} style={styles.merchantRow}>
              <Text style={{ fontSize: 20 }}>{m.icon}</Text>
              <Text style={styles.merchantName}>{m.name}</Text>
            </View>
          ))}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  back:        { color: '#6B7EAB', fontSize: 14 },
  title:       { color: '#FFF', fontSize: 18, fontWeight: '700' },
  body:        { flex: 1, paddingHorizontal: 20, paddingBottom: 32 },
  balanceCard: { backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  balanceLabel:{ color: '#8B9CD8', fontSize: 12 },
  balanceAmt:  { color: '#FFD700', fontSize: 26, fontWeight: '800', marginTop: 4 },
  label:       { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  inputRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  quickBtnActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  quickBtnText:{ color: '#6B7EAB', fontSize: 15, fontWeight: '700' },
  input:       { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 16 },
  genBtn:      { backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
  genBtnText:  { color: '#FFF', fontSize: 17, fontWeight: '700' },
  qrBox:       { alignItems: 'center', marginBottom: 24 },
  qrFrame:     { width: 200, height: 200, backgroundColor: '#FFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  qrPlaceholder: { alignItems: 'center' },
  qrIcon:      { fontSize: 100, color: '#1A1A2E', lineHeight: 120 },
  qrToken:     { fontSize: 12, color: '#6366F1', fontFamily: 'monospace', fontWeight: '700' },
  qrAmount:    { color: '#FFD700', fontSize: 24, fontWeight: '800' },
  qrExpiry:    { color: '#F59E0B', fontSize: 13, marginTop: 6 },
  qrHint:      { color: '#6B7EAB', fontSize: 12, marginTop: 8 },
  cancelBtn:   { marginTop: 12, paddingHorizontal: 24, paddingVertical: 8 },
  cancelText:  { color: '#EF4444', fontSize: 13 },
  sectionTitle:{ color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 8 },
  merchantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  merchantName:{ color: '#94A3B8', fontSize: 13 },
});
