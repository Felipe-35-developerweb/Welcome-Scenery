import { Package, DollarSign, CalendarCheck, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase'; // Importa a nossa base de dados

export default function Dashboard() {
  const navigate = useNavigate();

  // Vai buscar os dados do utilizador que acabou de entrar
  const utilizador = auth.currentUser;

  const handleLogout = async () => {
    try {
      await signOut(auth); // Desliga no Firebase
      navigate('/'); // Volta para o Login
    } catch (error) {
      console.error("Erro ao terminar sessão", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">Welcome Scenery</h1>
          <button 
            onClick={handleLogout}
            className="text-white hover:text-blue-200 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Olá, Motorista</h2>
          {/* Mostra o email do motorista logado */}
          <p className="text-gray-600">Sessão iniciada como: <span className="font-semibold">{utilizador?.email}</span></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-500">Ganhos Diários</p>
                <p className="text-2xl font-bold text-gray-900">€ 84.50</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-500">Entregas Concluídas</p>
                <p className="text-2xl font-bold text-gray-900">24 pacotes</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <CalendarCheck className="w-8 h-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Disponibilidade</p>
                  <p className="text-lg font-bold text-green-600">Turno Ativo</p>
                </div>
              </div>
              <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle" defaultChecked className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" />
                <label htmlFor="toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-green-500 cursor-pointer"></label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Estatísticas e Rotas Recentes</h3>
          </div>
          <div className="p-6 text-center text-gray-500">
            Nenhuma rota pendente no momento.
          </div>
        </div>
      </main>
    </div>
  );
}