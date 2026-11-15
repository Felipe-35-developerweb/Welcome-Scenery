import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  Users, LogOut, ShieldCheck, Loader2, ArrowLeft, Calendar,
  ImageIcon, Megaphone, Send, CheckSquare, AlertTriangle, Download,
  ChevronLeft, ChevronRight, MapPin, Sun, Moon, Monitor
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

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
  { nome: 'N/A (Não Atendido)', valor: 2.00 },
  { nome: 'Fake (Tentativa Irregular)', valor: 10.00 },
  { nome: 'Falso Ausente', valor: 5.00 },
  { nome: 'Penalização No Retorno', valor: 3.00 },
  { nome: 'Extravio de Pacote', valor: 15.00 },
  { nome: 'Outro / Personalizado', valor: 0 }
];

export default function Admin() {
  const navigate = useNavigate();
  const { themeMode, isDark, cycleTheme } = useTheme();
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
          console.error('Erro ao carregar motoristas:', error);
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

  // LOGÓTIPO INTELIGENTE: volta sempre à visão inicial da Central de Operações
  const irParaHomeAdmin = () => {
    setAbaAtiva('frota');
    setMotoristaSelecionado(null);
    setDiaEditando(null);
    setTurnoParaPenalizar(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      alert('Escala mensal guardada e sincronizada com o motorista!');
    } catch (error) {
      console.error(error);
      alert('Erro ao guardar escala.');
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
      console.error('Erro ao carregar turnos:', error);
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
      alert('Por favor, insira um valor válido para o desconto.');
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
      alert('Erro ao aplicar penalização.');
    }
  };

  const exportarParaExcel = () => {
    if (!motoristaSelecionado || turnosMotorista.length === 0) {
      alert('Não há turnos para exportar.');
      return;
    }

    const cabecalho = [
      'Data', 'Hora', 'Motorista', 'Codigo Frota', 'Total Pedidos Saida', 'Total Concluidos',
      'Entregas Normais (0.70)', 'Entregas PUDO (0.15)', 'Falhados', 'EDR (%)', 'Fez Recolha',
      'Valor Bruto (EUR)', 'Desconto/Penalizacao (EUR)', 'Motivo Desconto', 'Valor Liquido a Pagar (EUR)'
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
        t.falhados, edr, t.fezRecolha ? 'Sim' : 'Nao', bruto, desconto,
        `"${(t.motivoPenalizacao || '').replace(/"/g, '""')}"`, liquido
      ].join(';');
    });

    const csvContent = '\uFEFF' + [cabecalho.join(';'), ...linhas].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const nomeLimpo = (motoristaSelecionado.nome || motoristaSelecionado.email || 'motorista').split('@')[0].replace(/\s+/g, '_');
    link.setAttribute('download', `Relatorio_WelcomeScenery_${nomeLimpo}_${new Date().toISOString().slice(0, 10)}.csv`);
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
      alert('Aviso publicado no painel de todos os motoristas!');
    } catch (error) {
      alert('Erro ao publicar mensagem.');
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

  const bgPage = isDark ? 'bg-[#171716] text-white' : 'bg-[#f4f4f3] text-[#171716]';
  const bgCard = isDark ? 'bg-[#1f1f1e] border-[#2e2e2c]' : 'bg-white border-[#C3C2C2]/60';
  const textMuted = isDark ? 'text-[#C3C2C2]' : 'text-neutral-600';
  const inputStyle = isDark
    ? 'bg-[#171716] border-[#3a3a37] text-white focus:border-[#B79148]'
    : 'bg-gray-50 border-[#C3C2C2] text-[#171716] focus:border-[#B79148]';

  if (carregando) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${bgPage}`}>
        <Loader2 className="w-10 h-10 text-[#B79148] animate-spin" />
      </div>
    );
  }

  const totalBruto = turnosMotorista.reduce((acc, t) => acc + (t.ganhos || 0), 0);
  const totalDescontos = turnosMotorista.reduce((acc, t) => acc + (t.penalizacao || 0), 0);
  const totalLiquido = totalBruto - totalDescontos;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${bgPage}`}>
      <header className="bg-[#171716] border-b border-[#B79148]/40 shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <button
            type="button"
            onClick={irParaHomeAdmin}
            className="flex items-center gap-3 text-left text-white group focus:outline-none"
            title="Voltar ao início da Central de Operações"
          >
            <div className="bg-[#1f1f1e] border border-[#B79148] p-2 rounded-xl group-hover:bg-[#B79148] transition-colors">
              <ShieldCheck className="w-6 h-6 text-[#B79148] group-hover:text-[#171716] transition-colors" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-none group-hover:text-[#B79148] transition-colors">
                Welcome Scenery
              </h1>
              <span className="text-xs text-[#C3C2C2]">Central de Operações</span>
            </div>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={cycleTheme}
              className="px-2.5 py-2 rounded-lg bg-[#1f1f1e] border border-[#2e2e2c] hover:border-[#B79148] text-white transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Alternar tema: Automático / Escuro / Claro"
            >
              {themeMode === 'auto' ? (
                <Monitor className="w-4 h-4 text-[#B79148]" />
              ) : themeMode === 'dark' ? (
                <Moon className="w-4 h-4 text-[#B79148]" />
              ) : (
                <Sun className="w-4 h-4 text-[#B79148]" />
              )}
              <span className="hidden sm:inline capitalize">{themeMode}</span>
            </button>
            <button onClick={handleLogout} className="text-[#C3C2C2] hover:text-red-400 flex items-center gap-1.5 text-xs font-bold px-2.5 py-2 rounded-lg bg-[#1f1f1e] border border-[#2e2e2c] transition-colors">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
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
        {abaAtiva === 'frota' && (
          !motoristaSelecionado ? (
            <div className={`rounded-2xl border overflow-hidden shadow-xl ${bgCard}`}>
              <div className={`px-6 py-4 flex justify-between items-center border-b ${isDark ? 'bg-[#171716]/60 border-[#2e2e2c]' : 'bg-gray-50 border-gray-200'}`}>
                <h3 className="font-bold">Motoristas Registados</h3>
                <span className="bg-[#B79148]/20 border border-[#B79148]/40 text-[#B79148] text-xs font-bold px-3 py-1 rounded-full">
                  {motoristas.length} contas
                </span>
              </div>
              <div className={`divide-y ${isDark ? 'divide-[#2e2e2c]' : 'divide-gray-200'}`}>
                {motoristas.map((motorista) => (
                  <div key={motorista.id} className={`p-5 flex items-center justify-between transition-colors ${isDark ? 'hover:bg-[#262624]' : 'hover:bg-gray-50'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold">{motorista.nome || motorista.email || 'Conta sem nome'}</p>
                        {motorista.codigoFrota && (
                          <span className="text-[10px] font-bold bg-[#B79148]/20 text-[#B79148] px-2 py-0.5 rounded">
                            {motorista.codigoFrota}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${textMuted}`}>{motorista.email || motorista.id}</p>
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
                  <button onClick={() => setMotoristaSelecionado(null)} className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center gap-2 hover:border-[#B79148] ${bgCard}`}>
                    <ArrowLeft className="w-4 h-4 text-[#B79148]" /> Voltar
                  </button>
                  <div>
                    <h2 className="text-xl font-bold">{motoristaSelecionado.nome || motoristaSelecionado.email}</h2>
                    <p className={`text-xs ${textMuted}`}>{motoristaSelecionado.codigoFrota ? `${motoristaSelecionado.codigoFrota} • ` : ''}{motoristaSelecionado.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className={`px-5 py-2.5 rounded-xl border flex gap-6 ${bgCard}`}>
                    <div>
                      <p className={`text-[11px] ${textMuted}`}>Bruto Acumulado</p>
                      <p className="text-base font-bold">€ {totalBruto.toFixed(2)}</p>
                    </div>
                    <div className={`border-l pl-6 ${isDark ? 'border-[#2e2e2c]' : 'border-gray-200'}`}>
                      <p className={`text-[11px] ${textMuted}`}>Descontos</p>
                      <p className="text-base font-bold text-red-500">- € {totalDescontos.toFixed(2)}</p>
                    </div>
                    <div className={`border-l pl-6 ${isDark ? 'border-[#2e2e2c]' : 'border-gray-200'}`}>
                      <p className={`text-[11px] ${textMuted}`}>Líquido a Pagar</p>
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
                <div className={`rounded-xl p-8 text-center border ${bgCard} ${textMuted}`}>
                  Este motorista ainda não encerrou nenhum turno.
                </div>
              ) : (
                <div className="space-y-4">
                  {turnosMotorista.map((turno) => (
                    <div key={turno.id} className={`rounded-xl border p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${bgCard}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-base">
                            {new Date(turno.data).toLocaleDateString('pt-PT')}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium border ${isDark ? 'bg-[#171716] text-[#C3C2C2] border-[#2e2e2c]' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {new Date(turno.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {turno.fezRecolha && (
                            <span className="text-xs bg-[#B79148]/20 text-[#B79148] border border-[#B79148]/40 px-2 py-0.5 rounded font-bold">
                              Fez Recolha
                            </span>
                          )}
                        </div>

                        <p className={`text-sm ${textMuted}`}>
                          <strong className={isDark ? 'text-white' : 'text-[#171716]'}>{turno.totalConcluidos}</strong> Entregas ({turno.pacotesNormais} Normais | {turno.pacotesPudo} PUDO | {turno.falhados} Falhados)
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

                      <div className={`flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 ${isDark ? 'border-[#2e2e2c]' : 'border-gray-200'}`}>
                        <div className="text-right">
                          <p className={`text-xs ${textMuted}`}>Valor do Turno</p>
                          <p className="text-lg font-black text-[#B79148]">€ {(turno.ganhos - (turno.penalizacao || 0)).toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => setTurnoParaPenalizar(turno.id)}
                          className="bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-800 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
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

        {abaAtiva === 'escala' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`rounded-2xl border p-6 space-y-5 h-fit ${bgCard}`}>
              <div>
                <h3 className="font-bold text-base">Planeamento de Escala</h3>
                <p className={`text-xs mt-0.5 ${textMuted}`}>Clique num dia do calendário para definir o estado e a rota específica desse dia.</p>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase mb-1.5 ${textMuted}`}>1. Escolher Motorista</label>
                <select
                  value={escalaMotoristaId}
                  onChange={(e) => setEscalaMotoristaId(e.target.value)}
                  className={`w-full p-2.5 border rounded-lg text-sm font-bold ${inputStyle}`}
                >
                  {motoristas.map(m => (
                    <option key={m.id} value={m.id}>{m.nome || m.email || m.id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase mb-1.5 ${textMuted}`}>2. Sugestão de Rota (Preenchimento rápido)</label>
                <input
                  type="text"
                  value={rotaRapida}
                  onChange={(e) => setRotaRapida(e.target.value)}
                  placeholder="Ex: Rota Cascais 08:30"
                  className={`w-full p-2.5 border rounded-lg text-sm ${inputStyle}`}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-[#B79148]/15 border border-[#B79148]/40 p-2.5 rounded-lg text-center">
                  <p className="text-lg font-black text-[#B79148]">{totalTrabalho}</p>
                  <p className="text-[11px] font-bold text-[#B79148]">Trabalho</p>
                </div>
                <div className="bg-[#C3C2C2]/15 border border-[#C3C2C2]/40 p-2.5 rounded-lg text-center">
                  <p className="text-lg font-black">{totalFolgas}</p>
                  <p className={`text-[11px] font-bold ${textMuted}`}>Folgas</p>
                </div>
                <div className="bg-red-950/40 border border-red-800 p-2.5 rounded-lg text-center">
                  <p className="text-lg font-black text-red-500">{totalAusencias}</p>
                  <p className="text-[11px] font-bold text-red-500">Ausências</p>
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

            <div className={`lg:col-span-2 rounded-2xl border p-6 ${bgCard}`}>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b ${isDark ? 'border-[#2e2e2c]' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => mudarMesEscala(-1)} className={`p-2 rounded-lg border hover:border-[#B79148] ${isDark ? 'border-[#3a3a37]' : 'border-[#C3C2C2]'}`}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-lg font-bold capitalize min-w-[160px] text-center">
                    {mesEscala.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button onClick={() => mudarMesEscala(1)} className={`p-2 rounded-lg border hover:border-[#B79148] ${isDark ? 'border-[#3a3a37]' : 'border-[#C3C2C2]'}`}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[#B79148]">
                    <span className="w-3 h-3 rounded-full bg-[#B79148]"></span> Trabalho
                  </span>
                  <span className={`flex items-center gap-1.5 ${textMuted}`}>
                    <span className="w-3 h-3 rounded-full bg-[#C3C2C2]"></span> Folga
                  </span>
                  <span className="flex items-center gap-1.5 text-red-500">
                    <span className="w-3 h-3 rounded-full bg-red-600"></span> Ausência
                  </span>
                </div>
              </div>

              <div className={`grid grid-cols-7 gap-2 text-center text-xs font-bold mb-2 ${textMuted}`}>
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {vaziosArray.map(v => <div key={`v-${v}`} />)}
                {diasArray.map(dia => {
                  const info = diasEscala[String(dia)];
                  const status = info?.status;

                  let estiloDia = isDark
                    ? 'bg-[#171716] border-[#2e2e2c] text-[#C3C2C2] hover:border-[#B79148]'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-[#B79148]';
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

        {abaAtiva === 'avisos' && (
          <div className={`max-w-2xl mx-auto rounded-2xl border p-6 ${bgCard}`}>
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="w-6 h-6 text-[#B79148]" />
              <div>
                <h3 className="font-bold">Comunicado Geral para Motoristas</h3>
                <p className={`text-xs ${textMuted}`}>Esta mensagem aparecerá em destaque assim que abrirem a aplicação.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold uppercase mb-1 ${textMuted}`}>Tipo de Destaque</label>
                <select
                  value={tipoMensagem}
                  onChange={(e) => setTipoMensagem(e.target.value as any)}
                  className={`w-full p-2.5 border rounded-lg text-sm ${inputStyle}`}
                >
                  <option value="motivacao">🌟 Motivação / Bom Trabalho (Dourado)</option>
                  <option value="info">ℹ️ Orientação / Informação (Prata)</option>
                  <option value="alerta">⚠️ Atenção / Regra Urgente (Vermelho)</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase mb-1 ${textMuted}`}>Mensagem</label>
                <textarea
                  rows={4}
                  value={mensagemDia}
                  onChange={(e) => setMensagemDia(e.target.value)}
                  placeholder="Escreva aqui o aviso ou frase motivacional do dia..."
                  className={`w-full p-3 border rounded-lg text-sm ${inputStyle}`}
                />
              </div>

              <button
                onClick={publicarMensagem}
                disabled={salvandoMensagem}
                className="w-full bg-[#B79148] hover:bg-[#a37f3b] text-[#171716] py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {salvandoMensagem ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Publicar no Painel da Frota
              </button>
            </div>
          </div>
        )}
      </main>

      {diaEditando !== null && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className={`border border-[#B79148]/50 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 ${bgCard}`}>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#B79148]" />
              Dia {diaEditando} de {mesEscala.toLocaleDateString('pt-PT', { month: 'long' })}
            </h3>

            <div>
              <label className={`block text-xs font-bold uppercase mb-1.5 ${textMuted}`}>Situação do Motorista</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatusDiaModal('trabalho')}
                  className={`py-2 px-2 rounded-lg text-xs font-black border ${statusDiaModal === 'trabalho' ? 'bg-[#B79148] text-[#171716] border-[#B79148]' : `${inputStyle}`}`}
                >
                  Trabalho
                </button>
                <button
                  type="button"
                  onClick={() => setStatusDiaModal('folga')}
                  className={`py-2 px-2 rounded-lg text-xs font-black border ${statusDiaModal === 'folga' ? 'bg-[#C3C2C2] text-[#171716] border-[#C3C2C2]' : `${inputStyle}`}`}
                >
                  Folga
                </button>
                <button
                  type="button"
                  onClick={() => setStatusDiaModal('ausencia')}
                  className={`py-2 px-2 rounded-lg text-xs font-black border ${statusDiaModal === 'ausencia' ? 'bg-red-600 text-white border-red-600' : `${inputStyle}`}`}
                >
                  Ausência
                </button>
              </div>
            </div>

            {statusDiaModal === 'trabalho' && (
              <div>
                <label className={`block text-xs font-bold uppercase mb-1 ${textMuted}`}>Rota / Horário deste dia</label>
                <input
                  type="text"
                  value={rotaDiaModal}
                  onChange={(e) => setRotaDiaModal(e.target.value)}
                  placeholder="Ex: Rota Sintra 08:30 + Recolha"
                  className={`w-full p-2.5 border rounded-lg text-sm ${inputStyle}`}
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
                className={`flex-1 font-bold py-2.5 rounded-lg text-xs border ${inputStyle}`}
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

      {turnoParaPenalizar && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className={`border border-red-800 rounded-2xl max-w-md w-full p-6 shadow-2xl ${bgCard}`}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Aplicar Desconto ao Turno
            </h3>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold uppercase mb-1 ${textMuted}`}>Selecione a Ocorrência (Tabela Paack)</label>
                <select
                  value={indicePenalizacao}
                  onChange={(e) => setIndicePenalizacao(Number(e.target.value))}
                  className={`w-full p-2.5 border rounded-lg text-sm ${inputStyle}`}
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
                  <label className={`block text-xs font-bold uppercase mb-1 ${textMuted}`}>Valor do Desconto (€)</label>
                  <input
                    type="text"
                    value={valorPersonalizado}
                    onChange={(e) => setValorPersonalizado(e.target.value)}
                    placeholder="Ex: 7.50"
                    className={`w-full p-2.5 border rounded-lg text-sm ${inputStyle}`}
                  />
                </div>
              )}

              <div>
                <label className={`block text-xs font-bold uppercase mb-1 ${textMuted}`}>Motivo / Detalhe (Opcional)</label>
                <input
                  type="text"
                  value={observacaoPenalizacao}
                  onChange={(e) => setObservacaoPenalizacao(e.target.value)}
                  placeholder="Ex: Código do pacote #84920"
                  className={`w-full p-2.5 border rounded-lg text-sm ${inputStyle}`}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setTurnoParaPenalizar(null)}
                  className={`flex-1 font-bold py-2.5 rounded-lg text-xs border ${inputStyle}`}
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

      <footer className={`border-t py-4 mt-auto ${isDark ? 'bg-[#171716] border-[#2e2e2c]' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2">
          <img src="/FL-Lab-Avatar.png" alt="F&L Lab" className="w-5 h-5 rounded object-contain" />
          <p className={`text-xs font-medium ${textMuted}`}>
            Produzido por <span className={`font-bold ${isDark ? 'text-white' : 'text-[#171716]'}`}>F&L Lab</span>
          </p>
        </div>
      </footer>
    </div>
  );
}