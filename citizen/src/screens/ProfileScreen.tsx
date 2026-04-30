import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

export default function ProfileScreen({ navigation }: any) {
  const { user, refreshBalance } = useAuth();
  const [name, setName]   = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!name.trim()) return Alert.alert('어라?', '이름은 꼭 알려주셔야 해요! 🦊');
    if (!user) return;

    setLoading(true);
    try {
      await api.updateUser(user.id, { name: name.trim(), phone: phone.trim() });
      await refreshBalance(); // 최신 정보로 동기화
      Alert.alert('성공!', '정보가 말랑말랑하게 수정되었어요! ✨');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('에러', '정보 수정에 실패했어요 😿');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#FFF5F7', '#F0F8FF']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← 홈으로</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>내 정보 관리</Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.card}>
            <View style={styles.mascotArea}>
              <Text style={styles.mascot}>🦊</Text>
              <Text style={styles.userTitle}>{user?.title || '성동 입문자'}</Text>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>탐험가 닉네임</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="멋진 이름을 지어주세요"
                placeholderTextColor="#D1D1D1"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>연락처</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="010-0000-0000"
                placeholderTextColor="#D1D1D1"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.walletInfo}>
              <Text style={styles.walletLabel}>🔗 연결된 지갑 주소</Text>
              <Text style={styles.walletAddr}>{user?.wallet_addr || '지갑 없음'}</Text>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>수정 완료 ✨</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => Alert.alert('로그아웃', '정말 떠나실 건가요? 😿', [
          { text: '아니요', style: 'cancel' },
          { text: '네, 로그아웃할게요', onPress: () => { /* logout 로직 */ } }
        ])}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  backBtn: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, elevation: 2 },
  backText: { color: '#FF8E9E', fontWeight: '700', fontSize: 13 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: '#2D3436', marginRight: 80 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 35,
    padding: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  mascotArea: { alignItems: 'center', marginBottom: 30 },
  mascot: { fontSize: 60, marginBottom: 10 },
  userTitle: { backgroundColor: '#7FE9DE', color: '#FFF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: '800', overflow: 'hidden' },

  inputWrapper: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#636E72', marginBottom: 8, marginLeft: 5 },
  input: { backgroundColor: '#F9F9F9', borderRadius: 18, padding: 16, fontSize: 16, color: '#2D3436', borderWidth: 1.5, borderColor: '#F0F0F0' },

  walletInfo: { backgroundColor: '#F8F9FA', padding: 15, borderRadius: 18, marginBottom: 30 },
  walletLabel: { fontSize: 11, fontWeight: '700', color: '#B2BEC3', marginBottom: 5 },
  walletAddr: { fontSize: 11, color: '#636E72', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  saveBtn: {
    backgroundColor: '#FFD93D',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    borderBottomWidth: 5,
    borderBottomColor: '#F1C40F',
  },
  saveBtnText: { fontSize: 18, fontWeight: '900', color: '#000' },

  logoutBtn: { marginTop: 30, alignItems: 'center' },
  logoutText: { color: '#B2BEC3', fontSize: 13, textDecorationLine: 'underline', fontWeight: '600' },
});
