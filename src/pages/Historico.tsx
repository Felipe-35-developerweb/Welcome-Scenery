import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Package, Image as ImageIcon, Loader2, AlertCircle, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';

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
  penalizacao?: number;
  motivoPenalizacao?: string;
}

export default function Historico() {
  const navigate = useNavigate();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [perfil, setPerfil] = useState<{ nome?: string; codigoFrota?: string; email?: string }>({});
  const [carregando, setCarregando] = useState(true);
  const [mesSelecionado, setMesSelecionado] = useState(new Date());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        try {
          const perfilSnap = await getDoc(doc(db, 'motoristas', user.uid));
          if (perfilSnap.exists()) {
            setPerfil(perfilSnap.data());
          } else {
            setPerfil({ email: user.email || '' });
          }

          const q = query(
            collection(db, 'motoristas', user.uid, 'turnos'),
            orderBy('data', 'desc')
          );
          
          const querySnapshot = await getDocs(q);
          const turnosCarregados = querySnapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
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

  const mudarMes = (direcao: number) => {
    setMesSelecionado(prev => new Date(prev.getFullYear(), prev.getMonth() + direcao, 1));
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#171716] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#B79148] animate-spin mb-4" />
        <p className="text-[#C3C2C2] font-medium">A carregar extrato de serviços...</p>
      </div>
    );
  }

  const mesIndex = mesSelecionado.getMonth();
  const anoIndex = mesSelecionado.getFullYear();
  const nomeMes = mesSelecionado.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  const turnosDoMes = turnos.filter(t => {
    const dataTurno = new Date(t.data);
    return dataTurno.getMonth() === mesIndex && dataTurno.getFullYear() === anoIndex;
  });

  const diasTrabalhados = turnosDoMes.length;
  const totalEntregas = turnosDoMes.reduce((acc, t) => acc + (t.totalConcluidos || 0), 0);
  const totalPedidosSaida = turnosDoMes.reduce((acc, t) => acc + (t.totalPedidos || 0), 0);
  const totalFalhados = turnosDoMes.reduce((acc, t) => acc + (t.falhados || 0), 0);
  const mediaEntregasDia = diasTrabalhados > 0 ? (totalEntregas / diasTrabalhados).toFixed(2) : '0.00';
  const edrPercentual = totalPedidosSaida > 0 ? ((totalFalhados / totalPedidosSaida) * 100).toFixed(2) : '0.00';

  const brutoMes = turnosDoMes.reduce((acc, t) => acc + (t.ganhos || 0), 0);
  const totalPudosEuros = turnosDoMes.reduce((acc, t) => acc + ((t.pacotesPudo || 0) * 0.15), 0);
  const descontosMes = turnosDoMes.reduce((acc, t) => acc + (t.penalizacao || 0), 0);
  const totalAReceber = brutoMes - descontosMes;

  return (
    <div className="min-h-screen bg-[#171716] text-white pb-12">
      <header className="bg-[#171716] border-b border-[#B79148]/40 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-lg font-extrabold text-white">Welcome Scenery • Extrato</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-[#C3C2C2] hover:text-[#B79148] transition-colors flex items-center gap-2 text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        
        {/* NAVEGADOR DE MÊS */}
        <div className="bg-[#1f1f1e] rounded-xl border border-[#2e2e2c] p-4 flex items-center justify-between">
          <button onClick={() => mudarMes(-1)} className="p-2 rounded-lg border border-[#3a3a37] hover:border-[#B79148] text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-[11px] text-[#C3C2C2] uppercase font-bold">Mês de Referência</p>
            <h2 className="text-lg font-black text-white capitalize">{nomeMes}</h2>
          </div>
          <button onClick={() => mudarMes(1)} className="p-2 rounded-lg border border-[#3a3a37] hover:border-[#B79148] text-white">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* RESUMO MENSAL DE ATIVIDADE E PAGAMENTO */}
        <div className="bg-[#1f1f1e] rounded-xl border border-[#B79148]/50 overflow-hidden shadow-xl">
          <div className="bg-[#171716] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2e2e2c]">
            <div className="flex items-center gap-2.5">
              <Receipt className="w-5 h-5 text-[#B79148]" />
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide text-white">Resumo Mensal de Atividade</h3>
                <p className="text-xs text-[#C3C2C2]">
                  {perfil.codigoFrota ? `${perfil.codigoFrota} • ` : ''}{perfil.nome || perfil.email}
                </p>
              </div>
            </div>
            <span className="text-xs bg-[#B79148]/20 border border-[#B79148]/40 px-3 py-1 rounded-full text-[#B79148] font-bold">
              Conferência de Faturação
            </span>
          </div>

          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 border-b border-[#2e2e2c]">
            <div>
              <p className="text-[11px] font-bold text-[#C3C2C2] uppercase">Dias Trabalhados</p>
              <p className="text-xl font-black text-white mt-0.5">{diasTrabalhados}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#C3C2C2] uppercase">Total Entregas</p>
              <p className="text-xl font-black text-white mt-0.5">{totalEntregas}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#C3C2C2] uppercase">Média / Dia</p>
              <p className="text-xl font-black text-[#B79148] mt-0.5">{mediaEntregasDia}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#C3C2C2] uppercase">EDR do Mês</p>
              <p className="text-xl font-black text-white mt-0.5">{edrPercentual}%</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#C3C2C2] uppercase">PUDOs (€)</p>
              <p className="text-xl font-black text-white mt-0.5">{totalPudosEuros.toFixed(2)} €</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#C3C2C2] uppercase">Penalizações</p>
              <p className={`text-xl font-black mt-0.5 ${descontosMes > 0 ? 'text-red-500' : 'text-white'}`}>
                {descontosMes > 0 ? `-${descontosMes.toFixed(2)}` : '0.00'} €
              </p>
            </div>
          </div>

          <div className="bg-[#B79148]/15 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#B79148] uppercase">Total Líquido a Receber</p>
              <p className="text-[11px] text-[#C3C2C2]">Valor estimado para emissão de recibo</p>
            </div>
            <p className="text-3xl font-black text-[#B79148]">{totalAReceber.toFixed(2)} €</p>
          </div>
        </div>

        {/* DETALHAMENTO DIÁRIO */}
        <div>
          <h3 className="text-base font-bold text-white mb-3">Detalhe Diário ({turnosDoMes.length} registos)</h3>

          {turnosDoMes.length === 0 ? (
            <div className="bg-[#1f1f1e] rounded-xl p-8 text-center border border-[#2e2e2c]">
              <Calendar className="w-12 h-12 text-[#3a3a37] mx-auto mb-3" />
              <p className="text-sm font-medium text-[#C3C2C2]">Sem turnos registados neste mês.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {turnosDoMes.map((turno) => {
                const ganhosFinais = turno.ganhos - (turno.penalizacao || 0);
                const edrDia = turno.totalPedidos > 0 ? (((turno.falhados || 0) / turno.totalPedidos) * 100).toFixed(2) : '0.00';

                return (
                  <div key={turno.id} className={`bg-[#1f1f1e] rounded-xl border overflow-hidden ${turno.penalizacao ? 'border-red-800' : 'border-[#2e2e2c]'}`}>
                    <div className={`px-5 py-3 border-b flex justify-between items-center ${turno.penalizacao ? 'bg-red-950/40 border-red-800' : 'bg-[#171716]/60 border-[#2e2e2c]'}`}>
                      <div className="flex items-center gap-2 text-white font-bold text-sm">
                        <Calendar className={`w-4 h-4 ${turno.penalizacao ? 'text-red-400' : 'text-[#B79148]'}`} />
                        {new Date(turno.data).toLocaleDateString('pt-PT')}
                      </div>
                      <span className="text-xs font-bold text-[#C3C2C2]">EDR: {edrDia}%</span>
                    </div>
                    
                    <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div>
                        <p className="text-xs text-[#C3C2C2]">Valor a Receber</p>
                        {turno.penalizacao && (
                          <p className="text-xs text-[#C3C2C2] line-through">{turno.ganhos.toFixed(2)} €</p>
                        )}
                        <p className="text-xl font-black text-[#B79148]">
                          {ganhosFinais.toFixed(2)} €
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-[#C3C2C2] flex items-center gap-1"><Package className="w-3.5 h-3.5 text-[#B79148]"/> Entregues / Saída</p>
                        <p className="text-base font-bold text-white">{turno.totalConcluidos} / {turno.totalPedidos}</p>
                        <p className="text-[11px] text-[#C3C2C2]">{turno.pacotesNormais} Normais • {turno.pacotesPudo} PUDO</p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {turno.comprovativoInicio && (
                          <a href={turno.comprovativoInicio} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#B79148] hover:underline font-bold">
                            <ImageIcon className="w-3.5 h-3.5" /> Print Saída
                          </a>
                        )}
                        {turno.comprovativoFim && (
                          <a href={turno.comprovativoFim} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#B79148] hover:underline font-bold">
                            <ImageIcon className="w-3.5 h-3.5" /> Print Final
                          </a>
                        )}
                      </div>

                      {turno.penalizacao ? (
                        <div className="bg-red-950/60 p-2.5 rounded-lg border border-red-800">
                          <p className="text-xs font-bold text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> -{turno.penalizacao.toFixed(2)} €
                          </p>
                          <p className="text-[11px] text-red-200 mt-0.5">{turno.motivoPenalizacao}</p>
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-400 font-semibold">
                          ✓ Sem penalizações
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}