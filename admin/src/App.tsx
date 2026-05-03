import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import MapControl from './pages/MapControl';

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
      {now.toLocaleString('ko', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

const PAGE_TITLES: Record<string, string> = {
  '/':    '📊 대시보드',
  '/map': '🗺️ 지도 & 행사 관리',
};

export default function App() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 상단 헤더 */}
        <header style={styles.header}>
          <Routes>
            {Object.entries(PAGE_TITLES).map(([path, title]) => (
              <Route key={path} path={path} element={<h1 style={styles.pageTitle}>{title}</h1>} />
            ))}
          </Routes>
          <div style={styles.headerRight}>
            <LiveClock />
            <div style={styles.adminBadge}>🔑 관리자</div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main style={styles.main}>
          <Routes>
            <Route path="/"    element={<Dashboard />} />
            <Route path="/map" element={<MapControl />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 'var(--header-h)', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)',
  },
  pageTitle: { fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  adminBadge: {
    background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
  },
  main: { flex: 1, overflowY: 'auto', padding: 24 },
};
