import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getHistory } from '../services/api';

interface TxItem {
  hash: string; index: number; timestamp: number;
  type: string; amount: number; treasureName?: string;
  merchantName?: string;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string; sign: string }> = {
  EARN:  { label: '보물 획득', color: '#10B981', icon: '🪙', sign: '+' },
  SPEND: { label: 'QR 결제', color: '#F59E0B', icon: '🛍️', sign: '-' },
  MINT:  { label: '지급',    color: '#6366F1', icon: '🎁', sign: '+' },
};

export default function HistoryScreen({ navigation }: any) {
  const { user }     = useAuth();
  const [txs, setTxs]     = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const res = await getHistory(user.id);
        setTxs((res.history || []).reverse());
      } catch {
        // 서버 미연결 시 목업
        setTxs([
          { hash: '0xabc', index: 5, timestamp: Date.now() - 3600000,  type: 'EARN',  amount: 3, treasureName: '응봉산 팔각정' },
          { hash: '0xdef', index: 4, timestamp: Date.now() - 86400000, type: 'SPEND', amount: 1, merchantName: '서울숲 카페' },
          { hash: '0xghi', index: 3, timestamp: Date.now() - 172800000,type: 'EARN',  amount: 2, treasureName: '뚝섬한강공원' },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const totalEarned = txs.filter(t => t.type !== 'SPEND').reduce((s, t) => s + t.amount, 0);
  const totalSpent  = txs.filter(t => t.type === 'SPEND').reduce((s, t) => s + t.amount, 0);

  return (
    <LinearGradient colors={['#0A0E1A', '#0F1B35']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>코인 내역</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* 요약 카드 */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>총 획득</Text>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>+{totalEarned} SDP</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>총 사용</Text>
            <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>-{totalSpent} SDP</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>총 건수</Text>
            <Text style={[styles.summaryValue, { color: '#FFF' }]}>{txs.length}건</Text>
          </View>
        </View>

        {/* 내역 리스트 */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#6366F1" size="large" />
            <Text style={{ color: '#6B7EAB', marginTop: 12 }}>내역 불러오는 중…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {txs.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 48 }}>📭</Text>
                <Text style={styles.emptyText}>아직 코인 내역이 없습니다.</Text>
                <Text style={styles.emptySub}>AR 보물찾기로 첫 코인을 획득해 보세요!</Text>
              </View>
            ) : txs.map((tx, i) => {
              const cfg = TYPE_CONFIG[tx.type] || TYPE_CONFIG.EARN;
              return (
                <View key={tx.hash + i} style={styles.txCard}>
                  <View style={[styles.txIcon, { backgroundColor: cfg.color + '22' }]}>
                    <Text style={{ fontSize: 22 }}>{cfg.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txName}>
                      {tx.treasureName || tx.merchantName || cfg.label}
                    </Text>
                    <Text style={styles.txMeta}>{cfg.label}</Text>
                    <Text style={styles.txHash}>
                      {tx.hash?.slice(0, 18)}…
                    </Text>
                    <Text style={styles.txDate}>
                      {new Date(tx.timestamp).toLocaleString('ko')}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: cfg.color }]}>
                    {cfg.sign}{tx.amount} SDP
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  backText:   { color: '#6B7EAB', fontSize: 14 },
  title:      { color: '#FFF', fontSize: 18, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 16 },
  summaryCard:{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  summaryLabel:{ color: '#6B7EAB', fontSize: 11, marginBottom: 4 },
  summaryValue:{ fontSize: 15, fontWeight: '800' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:       { padding: 20, gap: 10, paddingBottom: 40 },
  emptyBox:   { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText:  { color: '#FFF', fontSize: 16, fontWeight: '600' },
  emptySub:   { color: '#6B7EAB', fontSize: 13 },
  txCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  txIcon:   { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  txName:   { color: '#FFF', fontSize: 14, fontWeight: '600' },
  txMeta:   { color: '#6B7EAB', fontSize: 11, marginTop: 2 },
  txHash:   { color: '#374151', fontSize: 9, fontFamily: 'monospace', marginTop: 2 },
  txDate:   { color: '#374151', fontSize: 10, marginTop: 1 },
  txAmount: { fontSize: 15, fontWeight: '800' },
});
