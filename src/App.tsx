import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Historico from './pages/Historico'; // Importa a página nova

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/historico" element={<Historico />} /> {/* Cria a rota */}
      </Routes>
    </Router>
  );
}

export default App;