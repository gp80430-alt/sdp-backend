import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, ActivityIndicator, Alert,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);

  // 버튼 애니메이션용
  const scaleAnim = new Animated.Value(1);

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
  };

    const handleKakaoLogin = async () => {
      if (!name.trim()) {
        Alert.alert('어라?', '이름을 알려주세요! 🐣');
        return;
      }
      setLoading(true);
      try {
        const fakeKakaoId = `kakao_${Date.now()}`;
        // 가입 시도 (최대 10초 대기 설정)
        const loginPromise = login(fakeKakaoId, name.trim(), phone.trim());
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('서버 응답 시간이 초과되었습니다. 다시 시도해 주세요.')), 15000)
        );

        await Promise.race([loginPromise, timeoutPromise]);
      } catch (e: any) {
        Alert.alert('로그인 알림', e.message || '로그인에 실패했어요. 서버가 준비 중일 수 있으니 잠시 후 다시 시도해 주세요. 😿');
      } finally {
        setLoading(false);
      }
    };

  return (
    <LinearGradient colors={['#FFF5F7', '#FFE4E8', '#E0F7FA']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        {/* 상단 마스코트 영역 */}
        <View style={styles.mascotArea}>
          <View style={styles.speechBubble}>
            <Text style={styles.bubbleText}>반가워! 성동구 보물 탐험가 {name || '친구'}! ✨</Text>
            <View style={styles.bubbleTail} />
          </View>
          <Text style={styles.mascotEmoji}>🦊</Text>
          <Text style={styles.mainTitle}>성동 패스</Text>
          <View style={styles.taglineBadge}>
            <Text style={styles.taglineText}>말랑말랑 코인 탐험대</Text>
          </View>
        </View>

        {/* 입력 카드 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>탐험가 등록하기 📝</Text>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>이름</Text>
            <TextInput
              style={styles.input}
              placeholder="예) 성동이"
              placeholderTextColor="#B2BEC3"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>연락처 (선택)</Text>
            <TextInput
              style={styles.input}
              placeholder="010-0000-0000"
              placeholderTextColor="#B2BEC3"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={styles.kakaoBtn}
              onPress={handleKakaoLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <>
                    <Text style={styles.btnIcon}>🍭</Text>
                    <Text style={styles.btnText}>시작하기!</Text>
                  </>
              }
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* 하단 장식 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>성동구청과 함께 행복한 탐험을 떠나요 🏠</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'space-around' },
  
  mascotArea: { alignItems: 'center', marginBottom: 20 },
  mascotEmoji: { fontSize: 80, marginBottom: 10 },
  
  speechBubble: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FF8E9E',
    marginBottom: 15,
    position: 'relative',
    shadowColor: '#FF8E9E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  bubbleText: { color: '#FF6B6B', fontWeight: '800', fontSize: 15 },
  bubbleTail: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF8E9E',
  },

  mainTitle: { fontSize: 40, fontWeight: '900', color: '#2D3436', textAlign: 'center' },
  taglineBadge: {
    backgroundColor: '#7FE9DE',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
    marginTop: 8,
  },
  taglineText: { color: '#FFF', fontWeight: '800', fontSize: 12 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 35,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#2D3436', marginBottom: 25, textAlign: 'center' },
  
  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#636E72', marginBottom: 8, marginLeft: 5 },
  input: {
    backgroundColor: '#F9F9F9',
    borderRadius: 18,
    padding: 16,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    color: '#2D3436',
  },

  kakaoBtn: {
    backgroundColor: '#FFD93D',
    borderRadius: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 5,
    borderBottomColor: '#F1C40F',
  },
  btnIcon: { fontSize: 22 },
  btnText: { fontSize: 18, fontWeight: '900', color: '#000' },

  footer: { alignItems: 'center' },
  footerText: { color: '#B2BEC3', fontSize: 12, fontWeight: '600' },
});
