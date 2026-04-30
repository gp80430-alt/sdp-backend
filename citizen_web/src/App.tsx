import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { LoginView } from './Views/LoginView';
import { HomeView } from './Views/HomeView';
import { ARView } from './Views/ARView';
import { SpendView } from './Views/SpendView';

const MainContent = () => {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState('HOME');

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)' }}>
        <div className="animate-float" style={{ fontSize: '40px' }}>🪙</div>
      </div>
    );
  }

  if (!user) return <LoginView />;

  if (currentView === 'AR') {
    return <ARView onBack={() => setCurrentView('HOME')} />;
  }

  if (currentView === 'SPEND') {
    return <SpendView onBack={() => setCurrentView('HOME')} />;
  }

  return <HomeView onNavigate={setCurrentView} />;
};

function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
