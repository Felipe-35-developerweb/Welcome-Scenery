import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { 
  Users, LogOut, ShieldCheck, Loader2, ArrowLeft, Calendar, 
  ImageIcon, Megaphone, Send, CheckSquare, AlertTriangle, Download, ChevronLeft, ChevronRight, MapPin 
} from 'lucide-react';

interface Motorista { 
  id: string; 
  email?: string; 
  nome?: string;
  codigoFrota?: string;
}

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
  fezRecolha?: boolean;
}

type StatusDia = 'trabalho' | 'folga' | 'ausencia';

interface DiaEscalaInfo {
  status: StatusDia;
  rota?: string;
}

const PENALIZACOES_PREDEFINIDAS = [
  { nome: "N/A (Não Atendido)", valor: 2.00 },
  { nome: "Fake (Tentativa Irregular)", valor: 10.00 },
  { nome: "Falso Ausente", valor: 5.00 },
  { nome: "Penalização No Retorno", valor: 3.00 },
  { nome: "Extravio de Pacote", valor: 15.00 },
  { nome: "Outro / Personalizado", valor: 0 }
];

export default function Admin() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'frota' | 'escala' | 'avisos'>('frota');
  
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<Motorista | null>(null);
  const [turnosMotorista, setTurnosMotorista] = useState<Turno[]>([]);
  const [carregandoTurnos, setCarregandoTurnos] = useState(false);

  const [turnoParaPenalizar, setTurnoParaPenalizar] = useState<string | null>(null);
  const [indicePenalizacao, setIndicePenalizacao] = useState<number>(0);
  const [valorPersonalizado, setValorPersonalizado] = useState<string>('');
  const [observacaoPenalizacao, setObservacaoPenalizacao] = useState<string>('');
  
  const [mensagemDia, setMensagemDia] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState<'info' | 'alerta' | 'motivacao'>('motivacao');
  const [salvandoMensagem, setSalvandoMensagem] = useState(false);

  const [escalaMotoristaId, setEscalaMotoristaId] = useState('');
  const [mesEscala, setMesEscala] = useState(new Date());
  const [diasEscala, setDiasEscala] = useState<Record<string, DiaEscalaInfo>>({});
  const [rotaRapida, setRotaRapida] = useState('');
  const [salvandoEscala, setSalvandoEscala] = useState(false);

  const [diaEditando, setDiaEditando] = useState<number | null>(null);
  const [statusDiaModal, setStatusDiaModal] = useState<StatusDia>('trabalho');
  const [rotaDiaModal, setRotaDiaModal] = useState('');
  
  const ADMIN_EMAILS = ['welcomescenery@gmail.com', 'fllab.oficial@gmail.com'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        try {
          const querySnapshot = await getDocs(collection(db, 'motoristas'));
          const lista = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Motorista[];
          setMotoristas(lista);
          if (lista.length > 0) {
            setEscalaMotoristaId(lista[0].id);
          }
        } catch (error) {
          console.error("Erro ao carregar motoristas:", error);
        } finally {
          setCarregando(false);
        }
      } else {
        navigate(user ? '/dashboard' : '/');
      }
    });

    const unsubMsg = onSnapshot(doc(db, 'configuracoes', 'geral'), (docSnap) => {
      if (docSnap.exists()) {
        setMensagemDia(docSnap.data().mensagemDia || '');
        setTipoMensagem(docSnap.data().tipoMensagem || 'motivacao');
      }
    });

    return () => { unsubscribe(); unsubMsg(); };
  }, [navigate]);

  useEffect(() => {
    if (!escalaMotoristaId) return;
    const chaveMes = `${mesEscala.getFullYear()}-${String(mesEscala.getMonth() + 1).padStart(2, '0')}`;
    const docId = `${escalaMotoristaId}_${chaveMes}`;

    const unsub = onSnapshot(doc(db, 'escalas_mensais', docId), (snap) => {
      if (snap.exists()) {
        const dadosBrutos = snap.data().dias || {};
        const rotaGlobalAntiga = snap.data().rotaPadrao || '';
        const normalizado: Record<string, DiaEscalaInfo> = {};

        Object.entries(dadosBrutos).forEach(([dia, val]) => {
          if (typeof val === 'string') {
            normalizado[dia] = { status: val as StatusDia, rota: val === 'trabalho' ? rotaGlobalAntiga : '' };
          } else {
            normalizado[dia] = val as DiaEscalaInfo;
          }
        });
        setDiasEscala(normalizado);
      } else {
        setDiasEscala({});
      }
    });

    return () => unsub();
  }, [escalaMotoristaId, mesEscala]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const abrirEdicaoDia = (dia: number) => {
    const infoAtual = diasEscala[String(dia)];
    setDiaEditando(dia);
    setStatusDiaModal(infoAtual?.status || 'trabalho');
    setRotaDiaModal(infoAtual?.rota || rotaRapida);
  };

  const salvarDiaModal = () => {
    if (diaEditando === null) return;
    const novoMapa = { ...diasEscala };
    novoMapa[String(diaEditando)] = {
      status: statusDiaModal,
      rota: statusDiaModal === 'trabalho' ? rotaDiaModal.trim() : ''
    };
    setDiasEscala(novoMapa);
    setDiaEditando(null);
  };

  const limparDiaModal = () => {
    if (diaEditando === null) return;
    const novoMapa = { ...diasEscala };
    delete novoMapa[String(diaEditando)];
    setDiasEscala(novoMapa);
    setDiaEditando(null);
  };

  const guardarEscalaMensal = async () => {
    if (!escalaMotoristaId) return;
    setSalvandoEscala(true);
    const chaveMes = `${mesEscala.getFullYear()}-${String(mesEscala.getMonth() + 1).padStart(2, '0')}`;
    const docId = `${escalaMotoristaId}_${chaveMes}`;
    const motoristaObj = motoristas.find(m => m.id === escalaMotoristaId);

    try {
      await setDoc(doc(db, 'escalas_mensais', docId), {
        motoristaId: escalaMotoristaId,
        motoristaEmail: motoristaObj?.email || '',
        mes: chaveMes,
        dias: diasEscala,
        atualizadoEm: new Date().toISOString()
      });
      alert("Escala mensal guardada e sincronizada com o motorista!");
    } catch (error) {
      console.error(error);
      alert("Erro ao guardar escala.");
    } finally {
      setSalvandoEscala(false);
    }
  };

  const mudarMesEscala = (direcao: number) => {
    setMesEscala(prev => new Date(prev.getFullYear(), prev.getMonth() + direcao, 1));
  };

  const verDetalhesMotorista = async (motorista: Motorista) => {
    setMotoristaSelecionado(motorista);
    setCarregandoTurnos(true);
    try {
      const q = query(collection(db, 'motoristas', motorista.id, 'turnos'), orderBy('data', 'desc'));
      const querySnapshot = await getDocs(q);
      setTurnosMotorista(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Turno[]);
    } catch (error) {
      console.error("Erro ao carregar turnos:", error);
    } finally {
      setCarregandoTurnos(false);
    }
  };

  const confirmarPenalizacao = async () => {
    if (!turnoParaPenalizar || !motoristaSelecionado) return;
    const itemSelecionado = PENALIZACOES_PREDEFINIDAS[indicePenalizacao];
    const valorFinal = itemSelecionado.valor === 0 
      ? Number(valorPersonalizado.replace(',', '.')) 
      : itemSelecionado.valor;

    if (isNaN(valorFinal) || valorFinal <= 0) {
      alert("Por favor, insira um valor válido para o desconto.");
      return;
    }

    const motivoCompleto = observacaoPenalizacao.trim() 
      ? `${itemSelecionado.nome} - ${observacaoPenalizacao}` 
      : itemSelecionado.nome;

    try {
      const turnoRef = doc(db, 'motoristas', motoristaSelecionado.id, 'turnos', turnoParaPenalizar);
      await updateDoc(turnoRef, { 
        penalizacao: valorFinal, 
        motivoPenalizacao: motivoCompleto 
      });

      setTurnosMotorista(prev => prev.map(t => 
        t.id === turnoParaPenalizar ? { ...t, penalizacao: valorFinal, motivoPenalizacao: motivoCompleto } : t
      ));
      
      setTurnoParaPenalizar(null);
      setObservacaoPenalizacao('');
      setValorPersonalizado('');
    } catch (error) {
      alert("Erro ao aplicar penalização.");
    }
  };

  const exportarParaExcel = () => {
    if (!motoristaSelecionado || turnosMotorista.length === 0) {
      alert("Não há turnos para exportar.");
      return;
    }

    const cabecalho = [
      "Data", "Hora", "Motorista", "Codigo Frota", "Total Pedidos Saida", "Total Concluidos",
      "Entregas Normais (0.70)", "Entregas PUDO (0.15)", "Falhados", "EDR (%)", "Fez Recolha",
      "Valor Bruto (EUR)", "Desconto/Penalizacao (EUR)", "Motivo Desconto", "Valor Liquido a Pagar (EUR)"
    ];

    const linhas = turnosMotorista.map(t => {
      const dataObj = new Date(t.data);
      const dataStr = dataObj.toLocaleDateString('pt-PT');
      const horaStr = dataObj.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const edr = t.totalPedidos > 0 ? (((t.falhados || 0) / t.totalPedidos) * 100).toFixed(2).replace('.', ',') : '0,00';
      const bruto = (t.ganhos || 0).toFixed(2).replace('.', ',');
      const desconto = (t.penalizacao || 0).toFixed(2).replace('.', ',');
      const liquido = ((t.ganhos || 0) - (t.penalizacao || 0)).toFixed(2).replace('.', ',');

      return [
        dataStr, horaStr, motoristaSelecionado.nome || motoristaSelecionado.email || motoristaSelecionado.id,
        motoristaSelecionado.codigoFrota || 'LIS WS',
        t.totalPedidos, t.totalConcluidos, t.pacotesNormais, t.pacotesPudo,
        t.falhados, edr, t.fezRecolha ? "Sim" : "Nao", bruto, desconto,
        `"${(t.motivoPenalizacao || '').replace(/"/g, '""')}"`, liquido
      ].join(';');
    });

    const csvContent = "\uFEFF" + [cabecalho.join(';'), ...linhas].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    const nomeLimpo = (motoristaSelecionado.nome || motoristaSelecionado.email || 'motorista').split('@')[0].replace(/\s+/g, '_');
    link.setAttribute("download", `Relatorio_WelcomeScenery_${nomeLimpo}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const publicarMensagem = async () => {
    if (!mensagemDia.trim()) return;
    setSalvandoMensagem(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'geral'), {
        mensagemDia,
        tipoMensagem,
        dataAtualizacao: new Date().toISOString()
      }, { merge: true });
      alert("Aviso publicado no painel de todos os motoristas!");
    } catch (error) {
      alert("Erro ao publicar mensagem.");
    } finally {
      setSalvandoMensagem(false);
    }
  };

  const anoCal = mesEscala.getFullYear();
  const mesCal = mesEscala.getMonth();
  const totalDiasMes = new Date(anoCal, mesCal + 1, 0).getDate();
  const primeiroDiaSemana = new Date(anoCal, mesCal, 1).getDay();
  const diasArray = Array.from({ length: totalDiasMes }, (_, i) => i + 1);
  const vaziosArray = Array.from({ length: primeiroDiaSemana }, (_, i) => i);

  const totalTrabalho = Object.values(diasEscala).filter(d => d.status === 'trabalho').length;
  const totalFolgas = Object.values(diasEscala).filter(d => d.status === 'folga').length;
  const totalAusencias = Object.values(diasEscala).filter(d => d.status === 'ausencia').length;

  if (carregando) return <div className="min-h-screen bg-[#171716] flex items-center justify-center"><Loader2 className="w-10 h-10 text-[#B79148] animate-spin" /></div>;

  const totalBruto = turnosMotorista.reduce((acc, t) => acc + (t.ganhos || 0), 0);
  const totalDescontos = turnosMotorista.reduce((acc, t) => acc + (t.penalizacao || 0), 0);
  const totalLiquido = totalBruto - totalDescontos;

  return (
    <div className="min-h-screen bg-[#171716] text-white flex flex-col">
      <header className="bg-[#171716] border-b border-[#B79148]/40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 text-white">
            <div className="bg-[#1f1f1e] border border-[#B79148] p-2 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-[#B79148]" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-none">Welcome Scenery</h1>
              <span className="text-xs text-[#C3C2C2]">Central de Operações</span>
            </div>
          </div>
          <button onClick={handleLogout} className="text-[#C3C2C2] hover:text-red-400 flex items-center gap-2 text-sm font-bold transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-6 border-t border-[#2e2e2c]">
          <button 
            onClick={() => { setAbaAtiva('frota'); setMotoristaSelecionado(null); }}
            className={`py-3.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${abaAtiva === 'frota' ? 'border-[#B79148] text-[#B79148]' : 'border-transparent text-[#C3C2C2] hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> Frota & Auditoria
          </button>
          <button 
            onClick={() => setAbaAtiva('escala')}
            className={`py-3.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${abaAtiva === 'escala' ? 'border-[#B79148] text-[#B79148]' : 'border-transparent text-[#C3C2C2] hover:text-white'}`}
          >
            <Calendar className="w-4 h-4" /> Escala Mensal
          </button>
          <button 
            onClick={() => setAbaAtiva('avisos')}
            className={`py-3.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${abaAtiva === 'avisos' ? 'border-[#B79148] text-[#B79148]' : 'border-transparent text-[#C3C2C2] hover:text-white'}`}
          >
            <Megaphone className="w-4 h-4" /> Quadro de Avisos
          </button>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* ABA 1: FROTA E AUDITORIA */}
        {abaAtiva === 'frota' && (
          !motoristaSelecionado ? (
            <div className="bg-[#1f1f1e] rounded-2xl border border-[#2e2e2c] overflow-hidden shadow-xl">
              <div className="px-6 py-4 bg-[#171716]/60 flex justify-between items-center border-b border-[#2e2e2c]">
                <h3 className="font-bold text-white">Motoristas Registados</h3>
                <span className="bg-[#B79148]/20 border border-[#B79148]/40 text-[#B79148] text-xs font-bold px-3 py-1 rounded-full">
                  {motoristas.length} contas
                </span>
              </div>
              <div className="divide-y divide-[#2e2e2c]">
                {motoristas.map((motorista) => (
                  <div key={motorista.id} className="p-5 flex items-center justify-between hover:bg-[#262624] transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-white">{motorista.nome || motorista.email || 'Conta sem nome'}</p>
                        {motorista.codigoFrota && (
                          <span className="text-[10px] font-bold bg-[#B79148]/20 text-[#B79148] px-2 py-0.5 rounded">
                            {motorista.codigoFrota}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#C3C2C2] mt-0.5">{motorista.email || motorista.id}</p>
                    </div>
                    <button 
                      onClick={() => verDetalhesMotorista(motorista)} 
                      className="bg-[#B79148] hover:bg-[#a37f3b] text-[#171716] px-4 py-2 rounded-xl text-xs font-black transition-colors shadow-sm"
                    >
                      Auditar Turnos
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button onClick={() => setMotoristaSelecionado(null)} className="bg-[#1f1f1e] px-4 py-2.5 rounded-xl border border-[#3a3a37] text-sm font-bold flex items-center gap-2 hover:border-[#B79148] text-white">
                    <ArrowLeft className="w-4 h-4 text-[#B79148]" /> Voltar
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-white">{motoristaSelecionado.nome || motoristaSelecionado.email}</h2>
                    <p className="text-xs text-[#C3C2C2]">{motoristaSelecionado.codigoFrota ? `${motoristaSelecionado.codigoFrota} • ` : ''}{motoristaSelecionado.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-[#1f1f1e] px-5 py-2.5 rounded-xl border border-[#2e2e2c] flex gap-6">
                    <div>
                      <p className="text-[11px] text-[#C3C2C2]">Bruto Acumulado</p>
                      <p className="text-base font-bold text-white">€ {totalBruto.toFixed(2)}</p>
                    </div>
                    <div className="border-l border-[#2e2e2c] pl-6">
                      <p className="text-[11px] text-[#C3C2C2]">Descontos</p>
                      <p className="text-base font-bold text-red-400">- € {totalDescontos.toFixed(2)}</p>
                    </div>
                    <div className="border-l border-[#2e2e2c] pl-6">
                      <p className="text-[11px] text-[#C3C2C2]">Líquido a Pagar</p>
                      <p className="text-lg font-black text-[#B79148]">€ {totalLiquido.toFixed(2)}</p>
                    </div>
                  </div>

                  <button 
                    onClick={exportarParaExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Exportar Excel / Sheets
                  </button>
                </div>
              </div>

              {carregandoTurnos ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-[#B79148] animate-spin" /></div>
              ) : turnosMotorista.length === 0 ? (
                <div className="bg-[#1f1f1e] rounded-xl p-8 text-center border border-[#2e2e2c] text-[#C3C2C2]">
                  Este motorista ainda não encerrou nenhum turno.
                </div>
              ) : (
                <div className="space-y-4">
                  {turnosMotorista.map((turno) => (
                    <div key={turno.id} className="bg-[#1f1f1e] rounded-xl border border-[#2e2e2c] p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white text-base">
                            {new Date(turno.data).toLocaleDateString('pt-PT')}
                          </span>
                          <span className="text-xs bg-[#171716] text-[#C3C2C2] px-2 py-0.5 rounded font-medium border border-[#2e2e2c]">
                            {new Date(turno.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {turno.fezRecolha && (
                            <span className="text-xs bg-[#B79148]/20 text-[#B79148] border border-[#B79148]/40 px-2 py-0.5 rounded font-bold">
                              Fez Recolha
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-[#C3C2C2]">
                          <strong className="text-white">{turno.totalConcluidos}</strong> Entregas ({turno.pacotesNormais} Normais | {turno.pacotesPudo} PUDO | {turno.falhados} Falhados)
                        </p>

                        <div className="flex gap-4 pt-1">
                          {turno.comprovativoInicio && (
                            <a href={turno.comprovativoInicio} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#B79148] hover:underline">
                              <ImageIcon className="w-3.5 h-3.5" /> Ver Print Saída ({turno.totalPedidos})
                            </a>
                          )}
                          {turno.comprovativoFim && (
                            <a href={turno.comprovativoFim} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#B79148] hover:underline">
                              <ImageIcon className="w-3.5 h-3.5" /> Ver Print Final
                            </a>
                          )}
                        </div>

                        {turno.penalizacao && (
                          <div className="mt-2 inline-flex items-center gap-1.5 bg-red-950/60 text-red-300 px-3 py-1 rounded-md text-xs font-bold border border-red-800">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Desconto: -€{turno.penalizacao.toFixed(2)} ({turno.motivoPenalizacao})
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-[#2e2e2c]">
                        <div className="text-right">
                          <p className="text-xs text-[#C3C2C2]">Valor do Turno</p>
                          <p className="text-lg font-black text-[#B79148]">€ {(turno.ganhos - (turno.penalizacao || 0)).toFixed(2)}</p>
                        </div>
                        <button 
                          onClick={() => setTurnoParaPenalizar(turno.id)}
                          className="bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                          Aplicar Desconto
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* ABA 2: CALENDÁRIO INTERATIVO DE ESCALA MENSAL */}
        {abaAtiva === 'escala' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#1f1f1e] rounded-2xl border border-[#2e2e2c] p-6 space-y-5 h-fit">
              <div>
                <h3 className="font-bold text-white text-base">Planeamento de Escala</h3>
                <p className="text-xs text-[#C3C2C2] mt-0.5">Clique num dia do calendário para definir o estado e a rota específica desse dia.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#C3C2C2] uppercase mb-1.5">1. Escolher Motorista</label>
                <select 
                  value={escalaMotoristaId} 
                  onChange={(e) => setEscalaMotoristaId(e.target.value)}
                  className="w-full p-2.5 border border-[#3a3a37] rounded-lg text-sm font-bold bg-[#171716] text-white"
                >
                  {motoristas.map(m => (
                    <option key={m.id} value={m.id}>{m.nome || m.email || m.id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#C3C2C2] uppercase mb-1.5">2. Sugestão de Rota (Preenchimento rápido)</label>
                <input 
                  type="text" 
                  value={rotaRapida}
                  onChange={(e) => setRotaRapida(e.target.value)}
                  placeholder="Ex: Rota Cascais 08:30"
                  className="w-full p-2.5 border border-[#3a3a37] rounded-lg text-sm bg-[#171716] text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-[#B79148]/15 border border-[#B79148]/40 p-2.5 rounded-lg text-center">
                  <p className="text-lg font-black text-[#B79148]">{totalTrabalho}</p>
                  <p className="text-[11px] font-bold text-[#B79148]">Trabalho</p>
                </div>
                <div className="bg-[#C3C2C2]/15 border border-[#C3C2C2]/40 p-2.5 rounded-lg text-center">
                  <p className="text-lg font-black text-[#C3C2C2]">{totalFolgas}</p>
                  <p className="text-[11px] font-bold text-[#C3C2C2]">Folgas</p>
                </div>
                <div className="bg-red-950/50 border border-red-800 p-2.5 rounded-lg text-center">
                  <p className="text-lg font-black text-red-400">{totalAusencias}</p>
                  <p className="text-[11px] font-bold text-red-400">Ausências</p>
                </div>
              </div>

              <button 
                onClick={guardarEscalaMensal}
                disabled={salvandoEscala}
                className="w-full bg-[#B79148] hover:bg-[#a37f3b] text-[#171716] font-black py-3 rounded-xl text-sm transition-colors shadow-md flex items-center justify-center gap-2"
              >
                {salvandoEscala ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                Guardar Escala do Mês
              </button>
            </div>

            <div className="lg:col-span-2 bg-[#1f1f1e] rounded-2xl border border-[#2e2e2c] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#2e2e2c]">
                <div className="flex items-center gap-3">
                  <button onClick={() => mudarMesEscala(-1)} className="p-2 rounded-lg border border-[#3a3a37] hover:border-[#B79148] text-white">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-lg font-bold text-white capitalize min-w-[160px] text-center">
                    {mesEscala.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button onClick={() => mudarMesEscala(1)} className="p-2 rounded-lg border border-[#3a3a37] hover:border-[#B79148] text-white">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[#B79148]">
                    <span className="w-3 h-3 rounded-full bg-[#B79148]"></span> Trabalho
                  </span>
                  <span className="flex items-center gap-1.5 text-[#C3C2C2]">
                    <span className="w-3 h-3 rounded-full bg-[#C3C2C2]"></span> Folga
                  </span>
                  <span className="flex items-center gap-1.5 text-red-400">
                    <span className="w-3 h-3 rounded-full bg-red-600"></span> Ausência
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#C3C2C2] mb-2">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {vaziosArray.map(v => <div key={`v-${v}`} />)}
                {diasArray.map(dia => {
                  const info = diasEscala[String(dia)];
                  const status = info?.status;
                  
                  let estiloDia = 'bg-[#171716] border-[#2e2e2c] text-[#C3C2C2] hover:border-[#B79148]';
                  let labelStatus = '—';

                  if (status === 'trabalho') {
                    estiloDia = 'bg-[#B79148] border-[#B79148] text-[#171716] shadow-sm';
                    labelStatus = info?.rota ? info.rota : 'Trabalho';
                  } else if (status === 'folga') {
                    estiloDia = 'bg-[#C3C2C2] border-[#C3C2C2] text-[#171716] shadow-sm';
                    labelStatus = 'Folga';
                  } else if (status === 'ausencia') {
                    estiloDia = 'bg-red-600 border-red-700 text-white shadow-sm';
                    labelStatus = 'Ausência';
                  }

                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => abrirEdicaoDia(dia)}
                      className={`p-2 min-h-[64px] rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 ${estiloDia}`}
                    >
                      <span className="text-sm sm:text-base font-black">{dia}</span>
                      <span className="text-[10px] font-bold mt-0.5 line-clamp-1 max-w-full px-1">{labelStatus}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: QUADRO DE AVISOS */}
        {abaAtiva === 'avisos' && (
          <div className="max-w-2xl mx-auto bg-[#1f1f1e] rounded-2xl border border-[#2e2e2c] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="w-6 h-6 text-[#B79148]" />
              <div>
                <h3 className="font-bold text-white">Comunicado Geral para Motoristas</h3>
                <p className="text-xs text-[#C3C2C2]">Esta mensagem aparecerá em destaque assim que abrirem a aplicação.</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#C3C2C2] uppercase mb-1">Tipo de Destaque</label>
                <select 
                  value={tipoMensagem} 
                  onChange={(e) => setTipoMensagem(e.target.value as any)}
                  className="w-full p-2.5 border border-[#3a3a37] rounded-lg text-sm bg-[#171716] text-white"
                >
                  <option value="motivacao">🌟 Motivação / Bom Trabalho (Dourado)</option>
                  <option value="info">ℹ️ Orientação / Informação (Prata)</option>
                  <option value="alerta">⚠️ Atenção / Regra Urgente (Vermelho)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#C3C2C2] uppercase mb-1">Mensagem</label>
                <textarea 
                  rows={4}
                  value={mensagemDia}
                  onChange={(e) => setMensagemDia(e.target.value)}
                  placeholder="Escreva aqui o aviso ou frase motivacional do dia..."
                  className="w-full p-3 border border-[#3a3a37] rounded-lg text-sm bg-[#171716] text-white focus:border-[#B79148]"
                />
              </div>

              <button 
                onClick={publicarMensagem}
                disabled={salvandoMensagem}
                className="w-full bg-[#B79148] hover:bg-[#a37f3b] text-[#171716] py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {salvandoMensagem ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
                Publicar no Painel da Frota
              </button>
            </div>
          </div>
        )}

      </main>

      {/* MODAL PARA DEFINIR ESTADO E ROTA DO DIA */}
      {diaEditando !== null && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1f1f1e] border border-[#B79148]/50 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#B79148]" />
              Dia {diaEditando} de {mesEscala.toLocaleDateString('pt-PT', { month: 'long' })}
            </h3>

            <div>
              <label className="block text-xs font-bold text-[#C3C2C2] uppercase mb-1.5">Situação do Motorista</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatusDiaModal('trabalho')}
                  className={`py-2 px-2 rounded-lg text-xs font-black border ${statusDiaModal === 'trabalho' ? 'bg-[#B79148] text-[#171716] border-[#B79148]' : 'bg-[#171716] text-[#C3C2C2] border-[#3a3a37]'}`}
                >
                  Trabalho
                </button>
                <button
                  type="button"
                  onClick={() => setStatusDiaModal('folga')}
                  className={`py-2 px-2 rounded-lg text-xs font-black border ${statusDiaModal === 'folga' ? 'bg-[#C3C2C2] text-[#171716] border-[#C3C2C2]' : 'bg-[#171716] text-[#C3C2C2] border-[#3a3a37]'}`}
                >
                  Folga
                </button>
                <button
                  type="button"
                  onClick={() => setStatusDiaModal('ausencia')}
                  className={`py-2 px-2 rounded-lg text-xs font-black border ${statusDiaModal === 'ausencia' ? 'bg-red-600 text-white border-red-600' : 'bg-[#171716] text-[#C3C2C2] border-[#3a3a37]'}`}
                >
                  Ausência
                </button>
              </div>
            </div>

            {statusDiaModal === 'trabalho' && (
              <div>
                <label className="block text-xs font-bold text-[#C3C2C2] uppercase mb-1">Rota / Horário deste dia</label>
                <input
                  type="text"
                  value={rotaDiaModal}
                  onChange={(e) => setRotaDiaModal(e.target.value)}
                  placeholder="Ex: Rota Sintra 08:30 + Recolha"
                  className="w-full p-2.5 border border-[#3a3a37] rounded-lg text-sm bg-[#171716] text-white"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={limparDiaModal}
                className="px-3 py-2.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-950/50 border border-red-800"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setDiaEditando(null)}
                className="flex-1 bg-[#171716] hover:bg-[#2a2a28] text-[#C3C2C2] font-bold py-2.5 rounded-lg text-xs border border-[#3a3a37]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarDiaModal}
                className="flex-1 bg-[#B79148] hover:bg-[#a37f3b] text-[#171716] font-black py-2.5 rounded-lg text-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTERATIVO DE PENALIZAÇÃO */}
      {turnoParaPenalizar && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1f1f1e] border border-red-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Aplicar Desconto ao Turno
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#C3C2C2] uppercase mb-1">Selecione a Ocorrência (Tabela Paack)</label>
                <select 
                  value={indicePenalizacao}
                  onChange={(e) => setIndicePenalizacao(Number(e.target.value))}
                  className="w-full p-2.5 border border-[#3a3a37] rounded-lg text-sm bg-[#171716] text-white"
                >
                  {PENALIZACOES_PREDEFINIDAS.map((p, idx) => (
                    <option key={idx} value={idx}>
                      {p.nome} {p.valor > 0 ? `(-€ ${p.valor.toFixed(2)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {PENALIZACOES_PREDEFINIDAS[indicePenalizacao].valor === 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#C3C2C2] uppercase mb-1">Valor do Desconto (€)</label>
                  <input 
                    type="text" 
                    value={valorPersonalizado}
                    onChange={(e) => setValorPersonalizado(e.target.value)}
                    placeholder="Ex: 7.50"
                    className="w-full p-2.5 border border-[#3a3a37] rounded-lg text-sm bg-[#171716] text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#C3C2C2] uppercase mb-1">Motivo / Detalhe (Opcional)</label>
                <input 
                  type="text" 
                  value={observacaoPenalizacao}
                  onChange={(e) => setObservacaoPenalizacao(e.target.value)}
                  placeholder="Ex: Código do pacote #84920"
                  className="w-full p-2.5 border border-[#3a3a37] rounded-lg text-sm bg-[#171716] text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setTurnoParaPenalizar(null)}
                  className="flex-1 bg-[#171716] hover:bg-[#2a2a28] text-[#C3C2C2] font-bold py-2.5 rounded-lg text-xs border border-[#3a3a37]"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmarPenalizacao}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-2.5 rounded-lg text-xs flex items-center justify-center gap-1"
                >
                  <CheckSquare className="w-4 h-4" /> Confirmar Desconto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RODAPÉ OFICIAL F&L LAB */}
      <footer className="bg-[#171716] border-t border-[#2e2e2c] py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2">
          <img src="/FL-Lab-Avatar.png" alt="F&L Lab" className="w-5 h-5 rounded object-contain" />
          <p className="text-xs text-[#C3C2C2] font-medium">
            Produzido por <span className="text-white font-bold">F&L Lab</span>
          </p>
        </div>
      </footer>
    </div>
  );
}