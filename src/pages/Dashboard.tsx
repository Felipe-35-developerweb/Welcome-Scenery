import { useState, useEffect } from 'react';
import { Package, DollarSign, LogOut, Camera, Save, AlertTriangle, Loader2, Store, CheckCircle, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db, storage } from '../firebase';
import { doc, setDoc, updateDoc, increment, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Tesseract from 'tesseract.js';

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [utilizador, setUtilizador] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [turnoEncerrado, setTurnoEncerrado] = useState(false);
  
  const [lendoInicio, setLendoInicio] = useState(false);
  const [lendoFim, setLendoFim] = useState(false);
  
  const [fotoInicio, setFotoInicio] = useState<File | null>(null);
  const [fotoFim, setFotoFim] = useState<File | null>(null);

  const [pacotesPudo, setPacotesPudo] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState<number | ''>('');
  const [totalConcluidos, setTotalConcluidos] = useState<number | ''>('');
  const [falhados, setFalhados] = useState<number | ''>('');

  const concluidosNum = Number(totalConcluidos) || 0;
  const pacotesNormais = Math.max(0, concluidosNum - pacotesPudo); 
  const ganhosDiarios = ((pacotesNormais * 0.70) + (pacotesPudo * 0.15)).toFixed(2);

  useEffect(() => {
    let pararObservadorBD: () => void;
    const pararObservadorLogin = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUtilizador(user);
        const docRef = doc(db, 'motoristas', user.uid);
        pararObservadorBD = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const dados = docSnap.data();
            setPacotesPudo(dados.pacotesPudo || 0);
            setTotalPedidos(dados.totalPedidos || '');
            setTotalConcluidos(dados.totalConcluidos || '');
            setFalhados(dados.falhados || '');
          } else {
            setDoc(docRef, { pacotesPudo: 0 });
          }
          setCarregando(false);
        });
      } else {
        setCarregando(false);
        navigate('/');
      }
    });
    return () => {
      pararObservadorLogin();
      if (pararObservadorBD) pararObservadorBD();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao terminar sessão", error);
    }
  };

  const registarPudo = () => {
    if (!utilizador) return;
    setPacotesPudo(prev => prev + 1);
    const docRef = doc(db, 'motoristas', utilizador.uid);
    updateDoc(docRef, { pacotesPudo: increment(1) }).catch(console.error);
  };

  // 🧠 IA Tolerante: Procura palavras-chave de forma flexível
  const processarPrintInicio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFotoInicio(file);
    setLendoInicio(true);
    
    try {
      const result = await Tesseract.recognize(file, 'por');
      const textoLimpo = result.data.text.replace(/\s+/g, ' '); 
      console.log("Texto lido:", textoLimpo);
      
      // Procura por "pedidos" ou "todos" e extrai o primeiro número próximo
      const matchTotal = textoLimpo.match(/(?:pedidos|todos)[^\d]*(\d+)/i) || textoLimpo.match(/(\d+)/);
      
      if (matchTotal) {
        const valorLido = Number(matchTotal[1]);
        setTotalPedidos(valorLido);
        const docRef = doc(db, 'motoristas', utilizador!.uid);
        await updateDoc(docRef, { totalPedidos: valorLido });
      }
    } catch (error) {
      console.error("Erro OCR:", error);
    } finally {
      setLendoInicio(false);
    }
  };

  const processarPrintFim = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFotoFim(file);
    setLendoFim(true);
    
    try {
      const result = await Tesseract.recognize(file, 'por');
      const textoLimpo = result.data.text.replace(/\s+/g, ' ');
      
      const matchConcluidos = textoLimpo.match(/conclu[íi1!l]dos[^\d]*(\d+)/i);
      const matchFalhados = textoLimpo.match(/falhados[^\d]*(\d+)/i);
      
      if (matchConcluidos || matchFalhados) {
        const docRef = doc(db, 'motoristas', utilizador!.uid);
        await updateDoc(docRef, { 
          totalConcluidos: matchConcluidos ? Number(matchConcluidos[1]) : 0,
          falhados: matchFalhados ? Number(matchFalhados[1]) : 0
        });
        if (matchConcluidos) setTotalConcluidos(Number(matchConcluidos[1]));
        if (matchFalhados) setFalhados(Number(matchFalhados[1]));
      }
    } catch (error) {
      console.error("Erro OCR:", error);
    } finally {
      setLendoFim(false);
    }
  };

  const guardarRelatorio = async () => {
    if (!utilizador) return;
    
    if (totalPedidos === '' || totalConcluidos === '') {
      alert("Por favor, preencha os pedidos totais e concluídos antes de encerrar o turno.");
      return;
    }
    
    setSalvando(true);
    
    try {
      let urlInicio = "";
      let urlFim = "";

      if (fotoInicio) {
        const refInicio = ref(storage, `comprovativos/${utilizador.uid}/inicio_${Date.now()}`);
        await uploadBytes(refInicio, fotoInicio);
        urlInicio = await getDownloadURL(refInicio);
      }

      if (fotoFim) {
        const refFim = ref(storage, `comprovativos/${utilizador.uid}/fim_${Date.now()}`);
        await uploadBytes(refFim, fotoFim);
        urlFim = await getDownloadURL(refFim);
      }

      const historicoRef = collection(db, 'motoristas', utilizador.uid, 'turnos');
      await addDoc(historicoRef, {
        data: new Date().toISOString(),
        totalPedidos: Number(totalPedidos),
        totalConcluidos: concluidosNum,
        pacotesNormais: pacotesNormais,
        pacotesPudo: pacotesPudo,
        falhados: Number(falhados) || 0,
        ganhos: Number(ganhosDiarios),
        comprovativoInicio: urlInicio || null,
        comprovativoFim: urlFim || null,
      });

      const docRef = doc(db, 'motoristas', utilizador.uid);
      await setDoc(docRef, { 
        pacotesPudo: 0, 
        totalPedidos: '', 
        totalConcluidos: '', 
        falhados: '' 
      });

      setFotoInicio(null);
      setFotoFim(null);
      setTurnoEncerrado(true);
      
    } catch (error) {
      console.error("Erro ao guardar relatório:", error);
      alert("Ocorreu um erro ao guardar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">A carregar o seu turno...</p>
      </div>
    );
  }

  if (turnoEncerrado) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Turno Encerrado!</h2>
          <p className="text-gray-600 mb-8">Os seus dados e comprovativos foram guardados no histórico com sucesso. Bom descanso!</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => navigate('/historico')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md shadow flex items-center justify-center gap-2 font-bold transition-colors"
            >
              <History className="w-5 h-5" />
              Ver Histórico de Turnos
            </button>
            <button 
              onClick={() => setTurnoEncerrado(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-md shadow flex items-center justify-center gap-2 font-medium transition-colors"
            >
              Iniciar Novo Turno
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-blue-600 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">Welcome Scenery</h1>
          <button onClick={handleLogout} className="text-white hover:text-blue-200 transition-colors flex items-center gap-2 text-sm font-medium">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Relatório Diário</h2>
            <p className="text-gray-600">Sessão: <span className="font-semibold">{utilizador?.email}</span></p>
          </div>
          
          <div className="flex gap-3">
            <button onClick={registarPudo} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-md shadow flex items-center gap-2 font-medium transition-colors">
              <Store className="w-5 h-5" /> Registar PUDO (+1)
            </button>
            <button 
              onClick={guardarRelatorio} 
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-md shadow flex items-center gap-2 font-medium transition-colors"
            >
              {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {salvando ? 'A Arquivar...' : 'Encerrar Turno'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-500">Ganhos Calculados</p>
                <p className="text-3xl font-bold text-gray-900">€ {ganhosDiarios}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-500">Entregas Concluídas</p>
                <p className="text-3xl font-bold text-gray-900">{concluidosNum}</p>
                <p className="text-xs text-gray-500 mt-1">Normais: {pacotesNormais} | PUDOs: {pacotesPudo}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">1. Saída do Armazém</h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">Comprovativo de Saída (Print)</p>
                <div className="flex items-center justify-center w-full relative">
                  <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${fotoInicio ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {lendoInicio ? (
                        <>
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                          <p className="text-sm text-gray-500">A ler a imagem...</p>
                        </>
                      ) : fotoInicio ? (
                        <>
                          <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                          <p className="text-sm text-green-700 font-medium">Imagem Anexada!</p>
                        </>
                      ) : (
                        <>
                          <Camera className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500"><span className="font-semibold">Anexar Print (Lê automático)</span></p>
                        </>
                      )}
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={processarPrintInicio} disabled={lendoInicio} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Todos os Pedidos (Pode digitar se necessário)</label>
                <input 
                  type="number" 
                  value={totalPedidos} 
                  onChange={(e) => setTotalPedidos(e.target.value ? Number(e.target.value) : '')} 
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border bg-white" 
                />
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">2. Fim do Turno</h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">Comprovativo de Fim (Print Final)</p>
                <div className="flex items-center justify-center w-full relative">
                  <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${fotoFim ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {lendoFim ? (
                        <>
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                          <p className="text-sm text-gray-500">A ler a imagem...</p>
                        </>
                      ) : fotoFim ? (
                        <>
                          <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                          <p className="text-sm text-green-700 font-medium">Imagem Anexada!</p>
                        </>
                      ) : (
                        <>
                          <Camera className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500"><span className="font-semibold">Anexar Print (Lê automático)</span></p>
                        </>
                      )}
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={processarPrintFim} disabled={lendoFim} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pedidos Concluídos</label>
                  <input 
                    type="number" 
                    value={totalConcluidos} 
                    onChange={(e) => setTotalConcluidos(e.target.value ? Number(e.target.value) : '')} 
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border bg-white" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">Falhados <AlertTriangle className="w-3 h-3 text-orange-500" /></label>
                  <input 
                    type="number" 
                    value={falhados} 
                    onChange={(e) => setFalhados(e.target.value ? Number(e.target.value) : '')} 
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border bg-white" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}