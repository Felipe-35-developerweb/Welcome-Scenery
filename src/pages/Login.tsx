import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Truck, Loader2, Sun, Moon, Monitor, KeyRound, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function Login() {
  const navigate = useNavigate();
  const { themeMode, isDark, cycleTheme } = useTheme();

  const [modoLogin, setModoLogin] = useState(true);
  const [nome, setNome] = useState('');
  const [codigoFrota, setCodigoFrota] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [sucessoMsg, setSucessoMsg] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);

  const ADMIN_EMAILS = ['welcomescenery@gmail.com', 'fllab.oficial@gmail.com'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucessoMsg('');
    setCarregando(true);

    try {
      let userCredential;
      if (modoLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        if (nome.trim().split(/\s+/).length < 2) {
          setErro('Por favor, indique o seu Nome e Sobrenome (ex: João Silva).');
          setCarregando(false);
          return;
        }
        userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      }

      const emailLimpo = email.trim().toLowerCase();
      const ehAdmin = ADMIN_EMAILS.includes(emailLimpo);

      if (userCredential.user) {
        const dadosPerfil: Record<string, any> = {
          email: emailLimpo,
          role: ehAdmin ? 'admin' : 'motorista',
          ultimoAcesso: new Date().toISOString()
        };
        if (!modoLogin) {
          dadosPerfil.nome = nome.trim().toUpperCase();
          dadosPerfil.codigoFrota = codigoFrota.trim().toUpperCase() || 'LIS WS';
        }
        await setDoc(doc(db, 'motoristas', userCredential.user.uid), dadosPerfil, { merge: true });
      }

      navigate(ehAdmin ? '/admin' : '/dashboard');
    } catch (error: any) {
      console.error(error);
      if (modoLogin) {
        setErro('Email ou palavra-passe incorretos.');
      } else {
        setErro('Erro ao criar conta. Verifique o email e use no mínimo 6 caracteres na palavra-passe.');
      }
    } finally {
      setCarregando(false);
    }
  };

  const handleEsqueciSenha = async () => {
    setErro('');
    setSucessoMsg('');
    if (!email.trim()) {
      setErro('Insira o seu email no campo acima e clique novamente em "Esqueci a palavra-passe".');
      return;
    }

    setEnviandoReset(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSucessoMsg(
        `Enviámos um link de redefinição de palavra-passe para ${email.trim()}. Verifique também a pasta de Spam.`
      );
    } catch (error: any) {
      console.error(error);
      setErro('Não foi possível enviar o email de recuperação. Verifique se o endereço está correto.');
    } finally {
      setEnviandoReset(false);
    }
  };

  const bgPage = isDark ? 'bg-[#171716] text-white' : 'bg-[#f4f4f3] text-[#171716]';
  const bgCard = isDark ? 'bg-[#1f1f1e] border-[#2e2e2c]' : 'bg-white border-[#C3C2C2]/70';
  const textMuted = isDark ? 'text-[#C3C2C2]' : 'text-neutral-600';
  const inputStyle = isDark
    ? 'bg-[#171716] border-[#3a3a37] text-white focus:border-[#B79148]'
    : 'bg-gray-50 border-[#C3C2C2] text-[#171716] focus:border-[#B79148]';

  const labelTema = themeMode === 'auto' ? 'Auto' : themeMode === 'dark' ? 'Escuro' : 'Claro';

  return (
    <div className={`min-h-screen flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8 transition-colors duration-200 ${bgPage}`}>
      {/* BARRA SUPERIOR COM SELETOR DE TEMA */}
      <div className="max-w-md w-full mx-auto flex justify-end">
        <button
          type="button"
          onClick={cycleTheme}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
            isDark
              ? 'bg-[#1f1f1e] border-[#3a3a37] text-[#C3C2C2] hover:border-[#B79148] hover:text-white'
              : 'bg-white border-[#C3C2C2] text-[#171716] hover:border-[#B79148]'
          }`}
          title="Alternar tema: Automático / Escuro / Claro"
        >
          {themeMode === 'auto' ? (
            <Monitor className="w-3.5 h-3.5 text-[#B79148]" />
          ) : themeMode === 'dark' ? (
            <Moon className="w-3.5 h-3.5 text-[#B79148]" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-[#B79148]" />
          )}
          Tema: {labelTema}
        </button>
      </div>

      <div className="my-auto py-4">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setModoLogin(true);
                setErro('');
                setSucessoMsg('');
              }}
              className={`w-16 h-16 border-2 border-[#B79148] rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                isDark ? 'bg-[#1f1f1e]' : 'bg-[#171716]'
              }`}
              title="Welcome Scenery"
            >
              <Truck className="w-8 h-8 text-[#B79148]" />
            </button>
          </div>
          <h2 className="mt-5 text-center text-3xl font-extrabold tracking-tight">
            Welcome Scenery
          </h2>
          <p className={`mt-1.5 text-center text-sm ${textMuted}`}>
            {modoLogin ? 'Aceda à sua conta de operação' : 'Registe-se para começar a conduzir'}
          </p>
        </div>

        <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
          <div className={`py-8 px-5 shadow-2xl sm:rounded-2xl sm:px-10 border ${bgCard}`}>
            <form className="space-y-5" onSubmit={handleSubmit}>
              {!modoLogin && (
                <>
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider ${textMuted}`}>
                      Nome e Sobrenome
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        required
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className={`appearance-none block w-full px-3 py-2.5 border rounded-lg shadow-sm focus:outline-none uppercase text-sm ${inputStyle}`}
                        placeholder="Ex: JOÃO SILVA"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider ${textMuted}`}>
                      Código Paack / Frota (Opcional)
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        value={codigoFrota}
                        onChange={(e) => setCodigoFrota(e.target.value)}
                        className={`appearance-none block w-full px-3 py-2.5 border rounded-lg shadow-sm focus:outline-none uppercase text-sm ${inputStyle}`}
                        placeholder="Ex: LIS WS M"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider ${textMuted}`}>
                  Email
                </label>
                <div className="mt-1">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`appearance-none block w-full px-3 py-2.5 border rounded-lg shadow-sm focus:outline-none text-sm ${inputStyle}`}
                    placeholder="exemplo@email.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${textMuted}`}>
                    Palavra-passe
                  </label>
                  {modoLogin && (
                    <button
                      type="button"
                      onClick={handleEsqueciSenha}
                      disabled={enviandoReset}
                      className="text-xs font-bold text-[#B79148] hover:underline inline-flex items-center gap-1"
                    >
                      <KeyRound className="w-3 h-3" />
                      {enviandoReset ? 'A enviar...' : 'Esqueci a palavra-passe'}
                    </button>
                  )}
                </div>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`appearance-none block w-full px-3 py-2.5 border rounded-lg shadow-sm focus:outline-none text-sm ${inputStyle}`}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              {erro && (
                <div className="text-red-400 text-xs bg-red-950/70 p-3 rounded-lg border border-red-800">
                  {erro}
                </div>
              )}

              {sucessoMsg && (
                <div className="text-emerald-400 text-xs bg-emerald-950/70 p-3 rounded-lg border border-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{sucessoMsg}</span>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-black text-[#171716] bg-[#B79148] hover:bg-[#a37f3b] focus:outline-none disabled:opacity-50 transition-colors"
                >
                  {carregando ? <Loader2 className="w-5 h-5 animate-spin" /> : modoLogin ? 'Entrar no Sistema' : 'Criar Conta'}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className={`w-full border-t ${isDark ? 'border-[#2e2e2c]' : 'border-gray-200'}`} />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className={`px-2 ${isDark ? 'bg-[#1f1f1e] text-[#C3C2C2]' : 'bg-white text-gray-500'}`}>
                    Ou
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setModoLogin(!modoLogin);
                    setErro('');
                    setSucessoMsg('');
                  }}
                  className={`w-full flex justify-center py-2.5 px-4 border rounded-xl text-xs font-bold transition-colors ${
                    isDark
                      ? 'border-[#3a3a37] text-[#C3C2C2] bg-[#171716] hover:border-[#B79148] hover:text-white'
                      : 'border-[#C3C2C2] text-[#171716] bg-gray-50 hover:border-[#B79148]'
                  }`}
                >
                  {modoLogin ? 'Não tem conta? Registe-se aqui' : 'Já tem conta? Faça Login'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RODAPÉ OFICIAL F&L LAB */}
      <footer className="mt-6 text-center">
        <div className={`inline-flex items-center justify-center gap-2.5 px-4 py-2 rounded-full border ${bgCard}`}>
          <img src="/FL-Lab-Avatar.png" alt="F&L Lab" className="w-5 h-5 rounded object-contain" />
          <span className={`text-xs font-medium ${textMuted}`}>
            Produzido por <strong className={isDark ? 'text-white' : 'text-[#171716]'}>F&L Lab</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}