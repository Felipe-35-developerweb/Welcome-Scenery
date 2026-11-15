import  { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Lazy‑load das páginas para reduzir o bundle inicial
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Historico = lazy(() => import('./pages/Historico'));
const Admin = lazy(() => import('./pages/Admin'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><span>Carregando...</span></div>}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
