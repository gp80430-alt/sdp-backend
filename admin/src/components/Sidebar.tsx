import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/',    icon: '📊', label: '대시보드' },
  { to: '/map', icon: '🗺️', label: '지도 & 행사 관리' },
];

export default function Sidebar() {
  return (
    <aside style={styles.sidebar}>
      {/* 로고 */}
      <div style={styles.logo}>
        <span style={{ fontSize: 28 }}>🏙️</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#FFF' }}>성동 패스</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>ADMIN</div>
        </div>
      </div>

      <nav style={styles.nav}>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}>
            <span style={{ fontSize: 18 }}>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={styles.footer}>
        <div style={styles.footerBadge}>🔗 블록체인 연동</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          성동구청 디지털정책팀<br />v1.0.0
        </div>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-w)', flexShrink: 0,
    background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column',
    padding: '0',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '20px 20px 16px', borderBottom: '1px solid var(--border)',
  },
  nav: { flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 },
  navLink: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 10,
    color: 'var(--text-secondary)', textDecoration: 'none',
    fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
  },
  navLinkActive: {
    background: 'var(--accent-glow)', color: '#FFF',
    fontWeight: 700, boxShadow: 'inset 0 0 0 1px var(--border-glow)',
  },
  footer: { padding: '16px 20px', borderTop: '1px solid var(--border)' },
  footerBadge: {
    fontSize: 11, padding: '4px 10px', borderRadius: 6,
    background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
    display: 'inline-block', marginBottom: 6,
  },
};
