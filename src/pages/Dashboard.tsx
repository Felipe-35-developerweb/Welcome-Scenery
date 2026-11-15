import { useState, useEffect } from 'react';
import { 
  LogOut, Camera, Save, Loader2, 
  Store, CheckCircle, History, Calendar as CalendarIcon, Sun, Moon, 
  Megaphone, Clock, Truck, Home, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db, storage } from '../firebase';
import { doc, setDoc, updateDoc, increment, onSnapshot, collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Tesseract from 'tesseract.js';

type StatusDia = 'trabalho' | 'folga' | 'ausencia';

interface DiaEscalaInfo {
  status: StatusDia;
  rota?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [utilizador, setUtilizador] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [turnoEncerrado, setTurnoEncerrado] = useState(false);
  
  // Inicia no modo escuro executivo (#171716) por padrão
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('ws_theme');
    return saved ? saved === 'dark' : true;
  });
  const [agora, setAgora] = useState(new Date());

  // Dados do Admin
  const [avisoGeral, setAvisoGeral] = useState<{ mensagem: string; tipo: 'info' | 'alerta' | 'motivacao' } | null>(null);
  const [diasEscala, setDiasEscala] = useState<Record<string, DiaEscalaInfo>>({});
  const [diaSelecionadoInfo, setDiaSelecionadoInfo] = useState<number | null>(null);
  const [diasTrabalhadosMes, setDiasTrabalhadosMes] = useState<number[]>([]);
  const [resumoMes, setResumoMes] = useState({ liquido: 0, descontos: 0 });

  // Estados de OCR e Ficheiros
  const [lendoInicio, setLendoInicio] = useState(false);
  const [lendoFim, setLendoFim] = useState(false);
  const [fotoInicio, setFotoInicio] = useState<File | null>(null);
  const [fotoFim, setFotoFim] = useState<File | null>(null);

  // Campos do Turno
  const [pacotesPudo, setPacotesPudo] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState<number | ''>('');
  const [totalConcluidos, setTotalConcluidos] = useState<number | ''>('');
  const [falhados, setFalhados] = useState<number | ''>('');
  const [fezRecolha, setFezRecolha] = useState(false);

  // CÁLCULO EXATO: PUDOs são subtraídos do total concluído (0,15€ em vez de 0,70€ + 0,15€)
  const concluidosNum = Number(totalConcluidos) || 0;
  const pudosEfetivos = concluidosNum > 0 ? Math.min(pacotesPudo, concluidosNum) : pacotesPudo;
  const pacotesNormais = concluidosNum > 0 ? Math.max(0, concluidosNum - pudosEfetivos) : 0;
  const ganhosDiarios = concluidosNum > 0 
    ? ((pacotesNormais * 0.70) + (pudosEfetivos * 0.15)).toFixed(2)
    : (pacotesPudo * 0.15).toFixed(2);

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const alternarTema = () => {
    const novoTema = !darkMode;
    setDarkMode(novoTema);
    localStorage.setItem('ws_theme', novoTema ? 'dark' : 'light');
  };

  useEffect(() => {
    let pararObservadorBD: () => void;
    let pararAvisos: () => void;
    let pararEscala: () => void;

    const pararObservadorLogin = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUtilizador(user);
        
        const docRef = doc(db, 'motoristas', user.uid);
        pararObservadorBD = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const dados = docSnap.data();
            setPacotesPudo(dados.pacotesPudo || 0);
            setTotalPedidos(dados.totalPedidos ?? '');
            setTotalConcluidos(dados.totalConcluidos ?? '');
            setFalhados(dados.falhados ?? '');
            setFezRecolha(dados.fezRecolha || false);
          } else {
            setDoc(docRef, { pacotesPudo: 0, email: user.email?.toLowerCase() });
          }
          setCarregando(false);
        });

        pararAvisos = onSnapshot(doc(db, 'configuracoes', 'geral'), (snap) => {
          if (snap.exists() && snap.data().mensagemDia) {
            setAvisoGeral({
              mensagem: snap.data().mensagemDia,
              tipo: snap.data().tipoMensagem || 'motivacao'
            });
          }
        });

        const hoje = new Date();
        const chaveMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const escalaDocId = `${user.uid}_${chaveMes}`;
        
        pararEscala = onSnapshot(doc(db, 'escalas_mensais', escalaDocId), (snap) => {
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

        try {
          const q = query(collection(db, 'motoristas', user.uid, 'turnos'), orderBy('data', 'desc'));
          const snapTurnos = await getDocs(q);
          const dias: number[] = [];
          let bruto = 0;
          let desc = 0;

          snapTurnos.forEach(d => {
            const t = d.data();
            const dt = new Date(t.data);
            if (dt.getMonth() === hoje.getMonth() && dt.getFullYear() === hoje.getFullYear()) {
              dias.push(dt.getDate());
              bruto += (t.ganhos || 0);
              desc += (t.penalizacao || 0);
            }
          });
          setDiasTrabalhadosMes(dias);
          setResumoMes({ liquido: bruto - desc, descontos: desc });
        } catch (err) {
          console.error(err);
        }

      } else {
        setCarregando(false);
        navigate('/');
      }
    });

    return () => {
      pararObservadorLogin();
      if (pararObservadorBD) pararObservadorBD();
      if (pararAvisos) pararAvisos();
      if (pararEscala) pararEscala();
    };
  }, [navigate, turnoEncerrado]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const registarPudo = () => {
    if (!utilizador) return;
    setPacotesPudo(prev => prev + 1);
    updateDoc(doc(db, 'motoristas', utilizador.uid), { pacotesPudo: increment(1) }).catch(console.error);
  };

  const removerPudo = () => {
    if (!utilizador || pacotesPudo <= 0) return;
    setPacotesPudo(prev => prev - 1);
    updateDoc(doc(db, 'motoristas', utilizador.uid), { pacotesPudo: increment(-1) }).catch(console.error);
  };

  const prepararImagemParaOCR = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const escala = 2;
        const margem = 40;
        canvas.width = (img.width * escala) + (margem * 2);
        canvas.height = (img.height * escala) + (margem * 2);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(URL.createObjectURL(file));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, margem, margem, img.width * escala, img.height * escala);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const cinza = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const ajustado = Math.min(255, Math.max(0, (cinza - 128) * 1.4 + 128));
          data[i] = ajustado;
          data[i + 1] = ajustado;
          data[i + 2] = ajustado;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const processarPrintInicio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoInicio(file);
    setLendoInicio(true);
    try {
      const imagemTratada = await prepararImagemParaOCR(file);
      const result = await Tesseract.recognize(imagemTratada, 'por');
      const linhas = result.data.text.split('\n');
      let encontrado: number | null = null;

      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        if (/todos\s*os\s*pedidos/i.test(linha)) {
          const nums = linha.match(/\d+/g);
          if (nums && nums.length > 0) {
            encontrado = nums.length > 1 ? Math.max(...nums.map(Number)) : Number(nums.join(''));
            break;
          } else if (linhas[i + 1]) {
            const numsProx = linhas[i + 1].match(/\d+/g);
            if (numsProx && numsProx.length > 0) {
              encontrado = Number(numsProx[0]);
              break;
            }
          }
        }
      }

      if (encontrado !== null) {
        setTotalPedidos(encontrado);
        if (utilizador) await updateDoc(doc(db, 'motoristas', utilizador.uid), { totalPedidos: encontrado });
      }
    } catch (error) {
      console.error("Erro OCR Início:", error);
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
      const imagemTratada = await prepararImagemParaOCR(file);
      const result = await Tesseract.recognize(imagemTratada, 'por');
      const linhas = result.data.text.split('\n');
      let conc: number | null = null;
      let falh: number | null = null;

      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];

        const matchConc = linha.match(/conclu[íi1!l]dos\s*[:\-]?\s*(\d{1,3})(?:\s*[>»71])?$/i);
        if (matchConc) {
          let valor = Number(matchConc[1]);
          if (valor > 200 && totalPedidos && valor > Number(totalPedidos)) {
            valor = Math.floor(valor / 10);
          }
          conc = valor;
        }

        if (/falhados/i.test(linha)) {
          const linhaNormalizada = linha.replace(/\b[Oo]\b/g, '0');
          const matchFalh = linhaNormalizada.match(/falhados\s*[:\-]?\s*(\d{1,3})(?:\s*[>»71])?$/i);
          
          if (matchFalh) {
            let valorF = Number(matchFalh[1]);
            if (matchFalh[1].startsWith('0') && matchFalh[1].length > 1) {
              valorF = Number(matchFalh[1].slice(0, -1));
            } else if (valorF > 100 && totalPedidos && valorF > Number(totalPedidos)) {
              valorF = Math.floor(valorF / 10);
            }
            falh = valorF;
          } else if (linhas[i + 1]) {
            const proxNormalizada = linhas[i + 1].replace(/\b[Oo]\b/g, '0');
            const numsProx = proxNormalizada.match(/\d{1,2}/);
            if (numsProx) falh = Number(numsProx[0]);
          }
        }
      }

      if (falh === null && conc !== null && totalPedidos !== '') {
        falh = Math.max(0, Number(totalPedidos) - conc);
      }

      if (conc !== null) setTotalConcluidos(conc);
      if (falh !== null) setFalhados(falh);

      if ((conc !== null || falh !== null) && utilizador) {
        await updateDoc(doc(db, 'motoristas', utilizador.uid), { 
          ...(conc !== null ? { totalConcluidos: conc } : {}),
          ...(falh !== null ? { falhados: falh } : {})
        });
      }
    } catch (error) {
      console.error("Erro OCR Fim:", error);
    } finally {
      setLendoFim(false);
    }
  };

  const guardarRelatorio = async () => {
    if (!utilizador) return;
    if (totalPedidos === '' || totalConcluidos === '') {
      alert("Preencha os pedidos totais e concluídos antes de encerrar o turno.");
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
      await addDoc(collection(db, 'motoristas', utilizador.uid, 'turnos'), {
        data: new Date().toISOString(),
        totalPedidos: Number(totalPedidos),
        totalConcluidos: concluidosNum,
        pacotesNormais,
        pacotesPudo: pudosEfetivos,
        falhados: Number(falhados) || 0,
        fezRecolha,
        ganhos: Number(ganhosDiarios),
        comprovativoInicio: urlInicio || null,
        comprovativoFim: urlFim || null,
      });
      await setDoc(doc(db, 'motoristas', utilizador.uid), { 
        email: utilizador.email?.toLowerCase(),
        pacotesPudo: 0, 
        totalPedidos: '', 
        totalConcluidos: '', 
        falhados: '',
        fezRecolha: false
      }, { merge: true });
      setFotoInicio(null);
      setFotoFim(null);
      setTurnoEncerrado(true);
    } catch (error) {
      console.error(error);
      alert("Erro ao guardar relatório.");
    } finally {
      setSalvando(false);
    }
  };

  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth();
  const totalDiasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
  const primeiroDiaSemana = new Date(anoAtual, mesAtual, 1).getDay();
  const diasCalendario = Array.from({ length: totalDiasNoMes }, (_, i) => i + 1);
  const espacosVazios = Array.from({ length: primeiroDiaSemana }, (_, i) => i);

  const escalaHoje = diasEscala[String(agora.getDate())];

  // Paleta Oficial: #171716 (Preto), #B79148 (Dourado), #C3C2C2 (Prata)
  const bgPage = darkMode ? 'bg-[#171716] text-white' : 'bg-[#f4f4f3] text-[#171716]';
  const bgCard = darkMode ? 'bg-[#1f1f1e] border-[#2e2e2c]' : 'bg-white border-[#C3C2C2]/60';
  const textMuted = darkMode ? 'text-[#C3C2C2]' : 'text-neutral-600';
  const inputStyle = darkMode 
    ? 'bg-[#171716] border-[#3a3a37] text-white focus:border-[#B79148]' 
    : 'bg-white border-[#C3C2C2] text-[#171716] focus:border-[#B79148]';

  if (carregando) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${bgPage}`}>
        <Loader2 className="w-10 h-10 text-[#B79148] animate-spin mb-4" />
        <p className={textMuted}>A carregar o seu painel...</p>
      </div>
    );
  }

  if (turnoEncerrado) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${bgPage}`}>
        <div className={`p-8 rounded-2xl shadow-xl max-w-md w-full text-center border ${bgCard}`}>
          <CheckCircle className="w-20 h-20 text-[#B79148] mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">Turno Encerrado!</h2>
          <p className={`text-sm mb-8 ${textMuted}`}>Os seus dados e comprovativos foram enviados para a Welcome Scenery.</p>
          <div className="space-y-3">
            <button onClick={() => navigate('/historico')} className="w-full bg-[#B79148] hover:bg-[#a37f3b] text-[#171716] py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-colors">
              <History className="w-5 h-5" /> Ver Extrato e Resumo
            </button>
            <button onClick={() => setTurnoEncerrado(false)} className={`w-full py-3 rounded-xl font-bold border ${darkMode ? 'border-[#3a3a37] hover:bg-[#2a2a28]' : 'border-[#C3C2C2] hover:bg-gray-100'}`}>
              Iniciar Novo Turno
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-200 ${bgPage}`}>
      {/* CABEÇALHO EXECUTIVO PRETO & DOURADO */}
      <header className="bg-[#171716] border-b border-[#B79148]/40 shadow-lg sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3 text-white">
            <div className="bg-[#1f1f1e] border border-[#B79148] p-1.5 rounded-lg">
              <Truck className="w-5 h-5 text-[#B79148]" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-wide leading-none text-white">Welcome Scenery</h1>
              <span className="text-[11px] text-[#C3C2C2] flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-[#B79148]" /> 
                {agora.toLocaleDateString('pt-PT')} • {agora.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={alternarTema} className="p-2 rounded-lg bg-[#1f1f1e] border border-[#2e2e2c] hover:border-[#B79148] text-white transition-colors" title="Alternar Tema">
              {darkMode ? <Sun className="w-4 h-4 text-[#B79148]" /> : <Moon className="w-4 h-4 text-[#C3C2C2]" />}
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg bg-[#1f1f1e] border border-[#2e2e2c] hover:border-red-500 text-[#C3C2C2] hover:text-red-400 transition-colors" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        
        {/* ESCALA DE HOJE */}
        {escalaHoje && (
          <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
            escalaHoje.status === 'trabalho' 
              ? 'bg-[#B79148]/15 border-[#B79148] text-current'
              : escalaHoje.status === 'folga'
              ? (darkMode ? 'bg-amber-950/40 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900')
              : (darkMode ? 'bg-red-950/40 border-red-800 text-red-200' : 'bg-red-50 border-red-300 text-red-900')
          }`}>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 shrink-0 text-[#B79148]" />
              <div>
                <p className="text-[11px] font-bold uppercase opacity-75">Escala de Hoje ({agora.getDate()}/{agora.getMonth() + 1})</p>
                <p className="text-sm font-bold">
                  {escalaHoje.status === 'trabalho' 
                    ? (escalaHoje.rota || 'Dia de Trabalho Escalado') 
                    : escalaHoje.status === 'folga' 
                    ? 'Dia de Folga' 
                    : 'Ausência Registada'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* QUADRO DE AVISOS */}
        {avisoGeral && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${
            avisoGeral.tipo === 'alerta' 
              ? (darkMode ? 'bg-red-950/60 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800')
              : avisoGeral.tipo === 'motivacao'
              ? (darkMode ? 'bg-[#1f1f1e] border-[#B79148]/60 text-white' : 'bg-amber-50/60 border-[#B79148] text-[#171716]')
              : (darkMode ? 'bg-[#1f1f1e] border-[#C3C2C2]/40 text-[#C3C2C2]' : 'bg-gray-100 border-gray-300 text-gray-800')
          }`}>
            <Megaphone className="w-5 h-5 shrink-0 mt-0.5 text-[#B79148]" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#B79148]">Comunicado da Gestão</p>
              <p className="text-sm font-medium mt-0.5">{avisoGeral.mensagem}</p>
            </div>
          </div>
        )}

        {/* RESUMO FINANCEIRO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className={`p-4 rounded-xl border shadow-sm ${bgCard}`}>
            <p className={`text-xs font-medium ${textMuted}`}>Ganhos Hoje</p>
            <p className="text-2xl font-black text-[#B79148] mt-1">€ {ganhosDiarios}</p>
            <p className={`text-[11px] mt-1 ${textMuted}`}>{pacotesNormais} Normais • {pudosEfetivos} PUDO</p>
          </div>

          <div className={`p-4 rounded-xl border shadow-sm ${bgCard}`}>
            <p className={`text-xs font-medium ${textMuted}`}>Entregas Hoje</p>
            <p className="text-2xl font-black text-emerald-500 mt-1">{concluidosNum}</p>
            <p className={`text-[11px] mt-1 ${textMuted}`}>Saída: {totalPedidos || 0} pac.</p>
          </div>

          <div className={`p-4 rounded-xl border shadow-sm ${bgCard}`}>
            <p className={`text-xs font-medium ${textMuted}`}>Acumulado Mês</p>
            <p className="text-2xl font-black mt-1">€ {resumoMes.liquido.toFixed(2)}</p>
            <p className={`text-[11px] mt-1 ${textMuted}`}>{diasTrabalhadosMes.length} dias fechados</p>
          </div>

          <div className={`p-4 rounded-xl border shadow-sm ${bgCard}`}>
            <p className={`text-xs font-medium ${textMuted}`}>Descontos Mês</p>
            <p className={`text-2xl font-black mt-1 ${resumoMes.descontos > 0 ? 'text-red-500' : ''}`}>
              - € {resumoMes.descontos.toFixed(2)}
            </p>
            <button onClick={() => navigate('/historico')} className="text-[11px] text-[#B79148] font-bold hover:underline mt-1">
              Ver extrato →
            </button>
          </div>
        </div>

        {/* BOTÃO RÁPIDO PUDO */}
        <div className={`p-4 rounded-xl border shadow-sm flex items-center justify-between gap-3 ${bgCard}`}>
          <div>
            <h3 className="font-bold text-sm">Entregas em Ponto PUDO (0,15€)</h3>
            <p className={`text-xs ${textMuted}`}>Descontadas automaticamente do total de concluídos</p>
          </div>
          <div className="flex items-center gap-2">
            {pacotesPudo > 0 && (
              <button 
                onClick={removerPudo}
                className={`px-3 py-3 rounded-xl border font-bold text-sm transition-colors ${darkMode ? 'border-[#3a3a37] hover:bg-[#2a2a28] text-[#C3C2C2]' : 'border-[#C3C2C2] hover:bg-gray-100 text-[#171716]'}`}
                title="Remover 1 PUDO"
              >
                -1
              </button>
            )}
            <button 
              onClick={registarPudo}
              className="bg-[#B79148] hover:bg-[#a37f3b] active:scale-95 text-[#171716] px-4 py-3 rounded-xl shadow-md font-black text-sm flex items-center gap-2 transition-all"
            >
              <Store className="w-5 h-5" /> +1 PUDO ({pacotesPudo})
            </button>
          </div>
        </div>

        {/* FORMULÁRIO DE PRINTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`rounded-xl border shadow-sm overflow-hidden ${bgCard}`}>
            <div className={`px-5 py-3.5 border-b font-bold text-sm ${darkMode ? 'bg-[#171716]/60 border-[#2e2e2c]' : 'bg-gray-50 border-gray-200'}`}>
              1. Saída do Armazém
            </div>
            <div className="p-5 space-y-4">
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                fotoInicio 
                  ? 'border-[#B79148] bg-[#B79148]/10' 
                  : (darkMode ? 'border-[#3a3a37] hover:border-[#B79148]' : 'border-[#C3C2C2] hover:border-[#B79148]')
              }`}>
                {lendoInicio ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-7 h-7 text-[#B79148] animate-spin mb-1" />
                    <span className="text-xs font-medium">A ler imagem...</span>
                  </div>
                ) : fotoInicio ? (
                  <div className="flex flex-col items-center text-[#B79148]">
                    <CheckCircle className="w-7 h-7 mb-1" />
                    <span className="text-xs font-bold">Print de Saída Anexado</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Camera className="w-7 h-7 mb-1 text-[#B79148]" />
                    <span className="text-xs font-semibold">Enviar Print de Saída (Leitura IA)</span>
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={processarPrintInicio} disabled={lendoInicio} />
              </label>

              <div>
                <label className={`block text-xs font-bold uppercase mb-1 ${textMuted}`}>Todos os Pedidos</label>
                <input 
                  type="number" 
                  value={totalPedidos} 
                  onChange={(e) => setTotalPedidos(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ex: 75"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm font-bold ${inputStyle}`} 
                />
              </div>
            </div>
          </div>

          <div className={`rounded-xl border shadow-sm overflow-hidden ${bgCard}`}>
            <div className={`px-5 py-3.5 border-b font-bold text-sm ${darkMode ? 'bg-[#171716]/60 border-[#2e2e2c]' : 'bg-gray-50 border-gray-200'}`}>
              2. Fim do Turno
            </div>
            <div className="p-5 space-y-4">
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                fotoFim 
                  ? 'border-[#B79148] bg-[#B79148]/10' 
                  : (darkMode ? 'border-[#3a3a37] hover:border-[#B79148]' : 'border-[#C3C2C2] hover:border-[#B79148]')
              }`}>
                {lendoFim ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-7 h-7 text-[#B79148] animate-spin mb-1" />
                    <span className="text-xs font-medium">A ler imagem...</span>
                  </div>
                ) : fotoFim ? (
                  <div className="flex flex-col items-center text-[#B79148]">
                    <CheckCircle className="w-7 h-7 mb-1" />
                    <span className="text-xs font-bold">Print Final Anexado</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Camera className="w-7 h-7 mb-1 text-[#B79148]" />
                    <span className="text-xs font-semibold">Enviar Print Final (Leitura IA)</span>
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={processarPrintFim} disabled={lendoFim} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold uppercase mb-1 ${textMuted}`}>Concluídos</label>
                  <input 
                    type="number" 
                    value={totalConcluidos} 
                    onChange={(e) => setTotalConcluidos(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Ex: 75"
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm font-bold ${inputStyle}`} 
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold uppercase mb-1 ${textMuted}`}>Falhados</label>
                  <input 
                    type="number" 
                    value={falhados} 
                    onChange={(e) => setFalhados(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Ex: 0"
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm font-bold ${inputStyle}`} 
                  />
                </div>
              </div>

              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${darkMode ? 'border-[#2e2e2c] bg-[#171716]/50' : 'border-gray-200 bg-gray-50'}`}>
                <input 
                  type="checkbox" 
                  checked={fezRecolha}
                  onChange={(e) => setFezRecolha(e.target.checked)}
                  className="w-4 h-4 accent-[#B79148] rounded"
                />
                <span className="text-xs font-semibold">Realizei serviço de Recolha neste turno</span>
              </label>
            </div>
          </div>
        </div>

        <button 
          onClick={guardarRelatorio} 
          disabled={salvando}
          className="w-full bg-[#B79148] hover:bg-[#a37f3b] disabled:opacity-50 text-[#171716] py-4 rounded-xl shadow-lg font-black text-base flex items-center justify-center gap-2 transition-all"
        >
          {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {salvando ? 'A Guardar Turno...' : 'Encerrar e Enviar Relatório do Dia'}
        </button>

        {/* CALENDÁRIO DE ESCALA MENSAL INDIVIDUALIZADA */}
        <div className={`p-5 rounded-xl border shadow-sm ${bgCard}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#2e2e2c]/30">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#B79148]" /> 
                A Minha Escala ({agora.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })})
              </h3>
              <p className={`text-[11px] mt-0.5 ${textMuted}`}>Toque num dia para ver a rota detalhada</p>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Fechado</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#B79148]"></span> Escalado</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#C3C2C2]"></span> Folga</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Ausência</span>
            </div>
          </div>

          {diaSelecionadoInfo !== null && (
            <div className={`mb-4 p-3 rounded-lg border text-xs flex justify-between items-center ${darkMode ? 'bg-[#171716] border-[#B79148]/50' : 'bg-amber-50/70 border-[#B79148]'}`}>
              <div>
                <span className="font-bold text-[#B79148]">Dia {diaSelecionadoInfo}: </span>
                {diasEscala[String(diaSelecionadoInfo)]?.status === 'trabalho' 
                  ? (diasEscala[String(diaSelecionadoInfo)]?.rota || 'Turno de Trabalho Escalado')
                  : diasEscala[String(diaSelecionadoInfo)]?.status === 'folga'
                  ? 'Dia de Folga'
                  : diasEscala[String(diaSelecionadoInfo)]?.status === 'ausencia'
                  ? 'Ausência / Falta'
                  : 'Sem escala definida para este dia'}
              </div>
              <button onClick={() => setDiaSelecionadoInfo(null)} className="text-[#B79148] font-bold ml-2">Fechar</button>
            </div>
          )}
          
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold mb-2 opacity-60">
            <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
            {espacosVazios.map(v => <div key={`v-${v}`} />)}
            {diasCalendario.map(dia => {
              const jaFechouTurno = diasTrabalhadosMes.includes(dia);
              const info = diasEscala[String(dia)];
              const statusEscala = info?.status;
              const ehHoje = dia === agora.getDate();

              let estiloDia = darkMode ? 'bg-[#171716] text-[#C3C2C2]' : 'bg-gray-100 text-gray-600';
              let subTexto = '';

              if (jaFechouTurno) {
                estiloDia = 'bg-emerald-600 text-white shadow-sm';
                subTexto = 'OK';
              } else if (statusEscala === 'trabalho') {
                estiloDia = 'bg-[#B79148] text-[#171716] shadow-sm';
                subTexto = info?.rota ? info.rota : 'Turno';
              } else if (statusEscala === 'folga') {
                estiloDia = 'bg-[#C3C2C2] text-[#171716] shadow-sm';
                subTexto = 'Folga';
              } else if (statusEscala === 'ausencia') {
                estiloDia = 'bg-red-600 text-white shadow-sm';
                subTexto = 'Falta';
              }

              return (
                <button 
                  key={dia}
                  type="button"
                  onClick={() => setDiaSelecionadoInfo(dia)}
                  className={`py-2 px-0.5 min-h-[52px] rounded-lg font-bold flex flex-col items-center justify-center transition-transform active:scale-95 ${estiloDia} ${ehHoje ? 'ring-2 ring-offset-1 ring-[#B79148]' : ''}`}
                >
                  <span>{dia}</span>
                  {subTexto && <span className="text-[9px] font-extrabold opacity-95 line-clamp-1 max-w-full px-0.5">{subTexto}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* RODAPÉ F&L LAB */}
        <footer className="pt-4 text-center">
          <div className={`inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border ${bgCard}`}>
            <img src="/FL-Lab-Avatar.png" alt="F&L Lab" className="w-4 h-4 rounded object-contain" />
            <span className={`text-[11px] font-medium ${textMuted}`}>
              Produzido por <strong className={darkMode ? 'text-white' : 'text-[#171716]'}>F&L Lab</strong>
            </span>
          </div>
        </footer>
      </main>

      {/* BARRA DE NAVEGAÇÃO MOBILE INFERIOR */}
      <nav className={`fixed bottom-0 inset-x-0 border-t z-40 flex justify-around py-2.5 ${darkMode ? 'bg-[#171716] border-[#2e2e2c]' : 'bg-white border-gray-200'}`}>
        <button className="flex flex-col items-center text-[#B79148] font-bold text-[11px] gap-1">
          <Home className="w-5 h-5" /> Turno Atual
        </button>
        <button onClick={() => navigate('/historico')} className={`flex flex-col items-center font-medium text-[11px] gap-1 ${textMuted} hover:text-[#B79148]`}>
          <History className="w-5 h-5" /> Extrato & Recibos
        </button>
      </nav>
    </div>
  );
}