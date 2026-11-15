import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Truck, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  
  const [modoLogin, setModoLogin] = useState(true); 
  const [nome, setNome] = useState('');
  const [codigoFrota, setCodigoFrota] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const ADMIN_EMAILS = ['welcomescenery@gmail.com', 'fllab.oficial@gmail.com'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      let userCredential;
      if (modoLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (nome.trim().split(/\s+/).length < 2) {
          setErro("Por favor, indique o seu Nome e Sobrenome (ex: João Silva).");
          setCarregando(false);
          return;
        }
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
      
      if (userCredential.user) {
        const dadosPerfil: Record<string, any> = {
          email: email.toLowerCase(),
          ultimoAcesso: new Date().toISOString()
        };
        if (!modoLogin) {
          dadosPerfil.nome = nome.trim().toUpperCase();
          dadosPerfil.codigoFrota = codigoFrota.trim().toUpperCase() || 'LIS WS';
        }
        await setDoc(doc(db, 'motoristas', userCredential.user.uid), dadosPerfil, { merge: true });
      }
      
      if (ADMIN_EMAILS.includes(email.toLowerCase())) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
      
    } catch (error: any) {
      console.error(error);
      if (modoLogin) {
        setErro("Email ou palavra-passe incorretos.");
      } else {
        setErro("Erro ao criar conta. Verifique o email e use no mínimo 6 caracteres na password.");
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#171716] text-white flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      <div className="my-auto">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-[#1f1f1e] border-2 border-[#B79148] rounded-2xl flex items-center justify-center shadow-lg">
              <Truck className="w-8 h-8 text-[#B79148]" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white">
            Welcome Scenery
          </h2>
          <p className="mt-2 text-center text-sm text-[#C3C2C2]">
            {modoLogin ? 'Aceda à sua conta de motorista' : 'Registe-se para começar a conduzir'}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-[#1f1f1e] py-8 px-5 shadow-2xl sm:rounded-2xl sm:px-10 border border-[#2e2e2c]">
            <form className="space-y-5" onSubmit={handleSubmit}>
              
              {!modoLogin && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#C3C2C2]">Nome Completo</label>
                    <div className="mt-1">
                      <input
                        type="text"
                        required
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="appearance-none block w-full px-3 py-2.5 bg-[#171716] border border-[#3a3a37] text-white rounded-lg shadow-sm focus:outline-none focus:border-[#B79148] uppercase text-sm"
                        placeholder="Ex: FELIPE DAMASIO"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#C3C2C2]">Código Paack / Frota (Opcional)</label>
                    <div className="mt-1">
                      <input
                        type="text"
                        value={codigoFrota}
                        onChange={(e) => setCodigoFrota(e.target.value)}
                        className="appearance-none block w-full px-3 py-2.5 bg-[#171716] border border-[#3a3a37] text-white rounded-lg shadow-sm focus:outline-none focus:border-[#B79148] uppercase text-sm"
                        placeholder="Ex: LIS WS M"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#C3C2C2]">Email</label>
                <div className="mt-1">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2.5 bg-[#171716] border border-[#3a3a37] text-white rounded-lg shadow-sm focus:outline-none focus:border-[#B79148] text-sm"
                    placeholder="exemplo@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#C3C2C2]">Palavra-passe</label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2.5 bg-[#171716] border border-[#3a3a37] text-white rounded-lg shadow-sm focus:outline-none focus:border-[#B79148] text-sm"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              {erro && (
                <div className="text-red-300 text-xs bg-red-950/70 p-3 rounded-lg border border-red-800">
                  {erro}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-black text-[#171716] bg-[#B79148] hover:bg-[#a37f3b] focus:outline-none disabled:opacity-50 transition-colors"
                >
                  {carregando ? <Loader2 className="w-5 h-5 animate-spin" /> : (modoLogin ? 'Entrar no Sistema' : 'Criar Conta')}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#2e2e2c]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-[#1f1f1e] text-[#C3C2C2]">Ou</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setModoLogin(!modoLogin);
                    setErro('');
                  }}
                  className="w-full flex justify-center py-2.5 px-4 border border-[#3a3a37] rounded-xl text-xs font-bold text-[#C3C2C2] bg-[#171716] hover:border-[#B79148] hover:text-white transition-colors"
                >
                  {modoLogin ? 'Não tem conta? Registe-se aqui' : 'Já tem conta? Faça Login'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RODAPÉ OFICIAL F&L LAB */}
      <footer className="mt-10 text-center">
        <div className="inline-flex items-center justify-center gap-2.5 px-4 py-2 rounded-full bg-[#1f1f1e] border border-[#2e2e2c]">
          <img 
            src="/FL-Lab-Avatar.png" 
            alt="F&L Lab" 
            className="w-5 h-5 rounded object-contain"
          />
          <span className="text-xs text-[#C3C2C2] font-medium">
            Produzido por <strong className="text-white font-bold">F&L Lab</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}