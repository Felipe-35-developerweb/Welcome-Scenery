import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, DollarSign, Package, Image as ImageIcon, Loader2 } from 'lucide-react';

// Define como é o "molde" de um turno gravado
interface Turno {
  id: string;
  data: string;
  totalPedidos: number;
  totalConcluidos: number;
  pacotesNormais: number;
  pacotesPudo: number;
  falhados: number;
  ganhos: number;
  comprovativoInicio: string | null;
  comprovativoFim: string | null;
}

export default function Historico() {
  const navigate = useNavigate();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        try {
          // Vai à pasta "turnos" deste motorista e ordena do mais recente para o mais antigo
          const q = query(
            collection(db, 'motoristas', user.uid, 'turnos'),
            orderBy('data', 'desc')
          );
          
          const querySnapshot = await getDocs(q);
          const turnosCarregados = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Turno[];
          
          setTurnos(turnosCarregados);
        } catch (error) {
          console.error("Erro ao carregar histórico:", error);
        } finally {
          setCarregando(false);
        }
      } else {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">A carregar o seu histórico...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-blue-600 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">Welcome Scenery</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-white hover:text-blue-200 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Histórico de Turnos</h2>
          <p className="text-gray-600">Consulte aqui as suas rotas e ganhos passados.</p>
        </div>

        {turnos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center border border-gray-200">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Ainda não há turnos registados</h3>
            <p className="text-gray-500">Quando encerrar o seu primeiro turno, ele aparecerá aqui.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {turnos.map((turno) => (
              <div key={turno.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-gray-800 font-bold">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    {new Date(turno.data).toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(turno.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-full">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Ganhos do Dia</p>
                      <p className="text-xl font-bold text-gray-900">€ {turno.ganhos?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-full">
                      <Package className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Concluídos</p>
                      <p className="text-xl font-bold text-gray-900">{turno.totalConcluidos}</p>
                      <p className="text-xs text-gray-500">{turno.pacotesNormais} Normais | {turno.pacotesPudo} PUDOs</p>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-2">
                    {turno.comprovativoInicio ? (
                      <a href={turno.comprovativoInicio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                        <ImageIcon className="w-4 h-4" /> Ver Print de Saída ({turno.totalPedidos} ped.)
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Sem print de saída</span>
                    )}
                    
                    {turno.comprovativoFim ? (
                      <a href={turno.comprovativoFim} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                        <ImageIcon className="w-4 h-4" /> Ver Print Final ({turno.falhados} falhados)
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Sem print final</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}