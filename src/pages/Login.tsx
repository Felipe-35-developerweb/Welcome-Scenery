import { useState } from 'react';
import { Truck, User, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase'; // Liga ao seu ficheiro firebase.ts

export default function Login() {
  const navigate = useNavigate();
  
  // Guardam o que o motorista escreve
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Guardam o estado do ecrã (erros e carregamento)
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      // Bate à porta do Firebase com os dados
      await signInWithEmailAndPassword(auth, email, password);
      // Se a porta abrir (sucesso), vai para o dashboard
      navigate('/dashboard');
    } catch (error) {
      // Se falhar, mostra mensagem de erro
      setErro('Dados incorretos. Verifique o email e a palavra-passe.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <Truck className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Welcome Scenery
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Portal do Motorista
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            
            {/* Caixa de Erro que só aparece se falhar */}
            {erro && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4">
                <p className="text-sm text-red-700">{erro}</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Email ou N.º de Telemóvel</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                  placeholder="Email / N.º Telemóvel" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Palavra-passe</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <div>
              <button 
                type="submit" 
                disabled={carregando}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-blue-400"
              >
                {carregando ? 'A verificar...' : 'Entrar no Sistema'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}