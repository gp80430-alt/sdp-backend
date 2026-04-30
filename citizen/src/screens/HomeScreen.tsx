import React, { useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const MERCHANTS = [
  { icon: '🌭', name: '응봉산 푸드트럭', desc: '1코인 = 핫도그 1개', color: '#FFEAA7' },
  { icon: '🏊', name: '성동 수영장', desc: '5코인 = 1일 이용권', color: '#81ECEC' },
  { icon: '🧋', name: '서울숲 카페', desc: '1코인 = 아아 1잔', color: '#FAB1A0' },
  { icon: '📚', name: '공공도서관', desc: '2코인 = 대여 연장', color: '#A29BFE' },
];

export default function HomeScreen({ navigation }: any) {
  const { user, refreshBalance } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const coinScale = useRef(new Animated.Value(0.8)).current;
  const coinOpacity = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(coinScale,   { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(coinOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -15, duration: 1500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,   duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshBalance();
    setRefreshing(false);
  };

  return (
    <LinearGradient colors={['#FFF5F7', '#F0F8FF']} style={styles.gradient}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8E9E" />}
        >
          {/* 상단 헤더 */}
          <View style={styles.header}>
            <View>
              <Text style={styles.titleText}>{user?.title || '성동 입문자'} ✨</Text>
              <Text style={styles.userName}>{user?.name ?? '탐험가'} 님</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.historyBtn}>
                <Text style={styles.historyBtnText}>⚙️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('History')} style={styles.historyBtn}>
                <Text style={styles.historyBtnText}>활동 기록 🐾</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 메인 잔액 카드 (솜사탕 디자인) */}
          <Animated.View style={[styles.balanceCard, { opacity: coinOpacity, transform: [{ scale: coinScale }] }]}>
            <LinearGradient
              colors={['#FF8E9E', '#FFB7B2']}
              style={styles.balanceGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={styles.whiteCircle} />
              <Animated.Text style={[styles.coinEmoji, { transform: [{ translateY: floatAnim }] }]}>
                🪙
              </Animated.Text>
              <Text style={styles.balanceLabel}>모은 코인</Text>
              <View style={styles.amountRow}>
                <Text style={styles.balanceAmount}>{user?.balance ?? 0}</Text>
                <Text style={styles.balanceUnit}>SDP</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* 액션 버튼 (동글동글) */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#7FE9DE' }]}
              onPress={() => navigation.navigate('AR')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnIcon}>🧭</Text>
              <Text style={styles.actionBtnTitle}>보물찾기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FFD93D' }]}
              onPress={() => navigation.navigate('QR')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnIcon}>🎁</Text>
              <Text style={styles.actionBtnTitle}>코인사용</Text>
            </TouchableOpacity>
          </View>

          {/* 추천 사용처 */}
          <Text style={styles.sectionTitle}>어디서 쓸까요? 🤔</Text>
          <View style={styles.merchantGrid}>
            {MERCHANTS.map(m => (
              <View key={m.name} style={[styles.merchantCard, { backgroundColor: '#FFF' }]}>
                <View style={[styles.iconCircle, { backgroundColor: m.color }]}>
                  <Text style={{ fontSize: 24 }}>{m.icon}</Text>
                </View>
                <View style={styles.merchantInfo}>
                  <Text style={styles.merchantName}>{m.name}</Text>
                  <Text style={styles.merchantDesc}>{m.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { padding: 20, paddingBottom: 40 },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  titleText:    { color: '#FF8E9E', fontSize: 14, fontWeight: '800' },
  userName:     { color: '#2D3436', fontSize: 24, fontWeight: '900' },
  historyBtn:   { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, elevation: 3 },
  historyBtnText: { color: '#636E72', fontSize: 13, fontWeight: '700' },

  balanceCard:     { marginBottom: 25, borderRadius: 35, overflow: 'hidden', elevation: 8 },
  balanceGradient: { padding: 30, alignItems: 'center', position: 'relative' },
  whiteCircle: {
    position: 'absolute', width: 180, height: 180,
    borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.15)',
    top: -30, right: -30,
  },
  coinEmoji:     { fontSize: 70, marginBottom: 5 },
  balanceLabel:  { color: '#FFF', fontSize: 16, fontWeight: '700', opacity: 0.9 },
  amountRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  balanceAmount: { color: '#FFF', fontSize: 60, fontWeight: '900' },
  balanceUnit:   { color: '#FFF', fontSize: 20, fontWeight: '700', opacity: 0.8 },

  actionRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  actionBtn: {
    flex: 1, borderRadius: 30, padding: 25, alignItems: 'center',
    elevation: 5, borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  actionBtnIcon:  { fontSize: 32, marginBottom: 5 },
  actionBtnTitle: { color: '#2D3436', fontSize: 16, fontWeight: '800' },

  sectionTitle: { color: '#2D3436', fontSize: 20, fontWeight: '900', marginBottom: 15 },
  merchantGrid: { gap: 12 },
  merchantCard: {
    borderRadius: 25, padding: 15,
    flexDirection: 'row', alignItems: 'center', gap: 15,
    elevation: 2, borderWidth: 1, borderColor: '#F0F0F0',
  },
  iconCircle: {
    width: 55, height: 55, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
  },
  merchantInfo:   { flex: 1 },
  merchantName:   { color: '#2D3436', fontSize: 16, fontWeight: '800' },
  merchantDesc:   { color: '#636E72', fontSize: 13, marginTop: 2 },
});
