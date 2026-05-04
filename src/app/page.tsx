"use client";
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

// --- DÉFINITION DES TYPES (Pour régler les erreurs TypeScript) ---
interface Voiture {
  id: string;
  marque: string;
  modele: string;
  prix_journalier: number;
  image_url: string;
  disponible: boolean;
}

interface SearchResult {
  statut: string;
  voitures: {
    marque: string;
    modele: string;
  } | null;
}

export default function Home() {
  // --- ÉTATS AVEC TYPES ---
  const [voitures, setVoitures] = useState<Voiture[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVoiture, setSelectedVoiture] = useState<Voiture | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  // --- ÉTATS AUTHENTIFICATION ---
  const [user, setUser] = useState<User | null>(null);
  const [authModal, setAuthModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [myReservations, setMyReservations] = useState<any[]>([]);

  // --- ÉTATS RÉSERVATION ---
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [orderCode, setOrderCode] = useState<string | null>(null);

  // --- NOUVEAUX ÉTATS SUIVI ---
  const [searchCode, setSearchCode] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null); // any ici pour simplifier la jointure Supabase
  const [searching, setSearching] = useState(false);

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const fetchVoitures = async () => {
      try {
        const { data, error } = await supabase.from('voitures').select('*');
        if (!error) setVoitures((data as Voiture[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchVoitures();

    return () => subscription.unsubscribe();
  }, []);

  const fetchReservations = async () => {
    if (user) {
      const { data } = await supabase.from('reservation').select('*, voitures(marque, modele)').eq('client_id', user.id);
      if (data) setMyReservations(data);
    } else {
      setMyReservations([]);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [user]);

  // --- FONCTIONS AUTH ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Inscription réussie ! Vous êtes maintenant connecté.");
        setAuthModal(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthModal(false);
      }
    } catch (err: any) {
      alert("Erreur: " + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleConfirm = async () => {
    if (!file || !selectedVoiture || !dateDebut || !dateFin) {
      return alert("Veuillez remplir les dates et ajouter votre document.");
    }

    setSending(true);
    const code = `AL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const fileName = `${Date.now()}-${cleanName}`;

      const { error: uploadError } = await supabase.storage.from('permis-bucket').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('permis-bucket').getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('reservation').insert([{
        voiture_id: selectedVoiture.id,
        client_id: user?.id,
        permis_url: urlData.publicUrl,
        date_debut: dateDebut,
        date_fin: dateFin,
        statut: 'en_attente',
        suivi_code: code
      }]);

      if (insertError) throw insertError;

      setOrderCode(code);
      fetchReservations();
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSearch = async () => {
    if (!searchCode) return;

    // --- ACCÈS SECRET ADMIN ---
    if (searchCode.trim().toUpperCase() === "AUTO2026") {
      window.location.href = "/admin";
      return;
    }

    setSearching(true);
    setSearchResult(null);

    const { data, error } = await supabase
      .from('reservation')
      .select('statut, voitures(modele, marque)')
      .eq('suivi_code', searchCode.trim().toUpperCase())
      .single();

    if (error) {
      alert("Code introuvable. Vérifiez l'orthographe.");
    } else {
      setSearchResult(data);
    }
    setSearching(false);
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-[#020202] text-white tracking-[0.5em] uppercase text-[10px]">
      Auto-Loc Premium...
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020202] text-white selection:bg-blue-500/30 overflow-x-hidden flex flex-col items-center">

      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 50, -50, 0], y: [0, 100, 50, 0], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-blue-600/20 rounded-full blur-[150px]"
        />
        <motion.div
          animate={{ x: [0, -70, 30, 0], y: [0, -50, 80, 0], opacity: [0.05, 0.15, 0.05] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-700/20 rounded-full blur-[150px]"
        />
      </div>

      <nav className="fixed top-0 w-full z-50 px-10 py-8 flex justify-between items-center bg-black/20 backdrop-blur-md border-b border-white/5">
        <h1 className="text-xl font-black tracking-tighter uppercase italic text-blue-500">Auto-Loc</h1>
        <div className="hidden md:flex gap-12 text-[9px] uppercase tracking-[0.3em] opacity-50 font-bold items-center">
          <a href="#collection" className="hover:text-blue-400 transition-colors">Collection</a>
          <a href="#vision" className="hover:text-blue-400 transition-colors">Vision</a>
          <a href="#suivi" className="hover:text-blue-400 transition-colors">Tableau de bord</a>
          {user ? (
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition-colors border border-red-500/20 px-4 py-2 rounded-full">Déconnexion</button>
          ) : (
            <button onClick={() => setAuthModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-white hover:text-black transition-colors">Espace Client</button>
          )}
        </div>
      </nav>

      <motion.section style={{ opacity: heroOpacity, scale: heroScale }} className="relative h-screen w-full flex flex-col justify-center items-center text-center px-6 z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2 }}>
          <span className="text-[10px] uppercase tracking-[0.6em] text-blue-500 font-bold mb-6 block">The Art of Driving</span>
          <h2 className="text-6xl md:text-8xl lg:text-[9vw] font-extralight tracking-tighter leading-none mb-10">
            L'élégance du <br /><span className="font-serif italic text-blue-400">mouvement.</span>
          </h2>
          <p className="max-w-xl text-sm text-white/30 leading-relaxed font-light mx-auto uppercase tracking-[0.2em]">
            Une expérience de location redéfinie pour l'Algérie.
          </p>
        </motion.div>
      </motion.section>

      <section id="vision" className="relative w-full py-40 max-w-6xl px-10 z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 bg-[linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6)),url('https://i.pinimg.com/736x/46/87/54/4687545a090f2392a7165a5715d9db8a.jpg')] bg-cover bg-center bg-blend-overlay bg-opacity-80 gap-20 items-center p-12 rounded-3xl border border-white/5">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h3 className="text-xs uppercase tracking-[0.4em] text-blue-500 mb-8 font-bold italic">Notre Vision —</h3>
            <p className="text-4xl font-extralight leading-tight tracking-tight">
              Nous ne louons pas seulement des voitures. Nous offrons une <span className="text-white/40 italic">liberté sans compromis</span>.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 gap-6 text-[10px] tracking-[0.4em] text-white/20 uppercase font-bold">
            <p className="border-l border-blue-500/50 pl-6 py-2 hover:text-white transition-all">01. Excellence Opérationnelle</p>
            <p className="border-l border-blue-500/50 pl-6 py-2 hover:text-white transition-all">02. Confidentialité Totale</p>
            <p className="border-l border-blue-500/50 pl-6 py-2 hover:text-white transition-all">03. Support Premium 24/7</p>
          </div>
        </div>
      </section>

      <section id="collection" className="w-full max-w-7xl px-8 pb-40 z-10">
        <div className="flex flex-col items-center mb-24 text-center">
          <h3 className="text-xs uppercase tracking-[0.6em] text-blue-500 mb-4 font-bold">La Collection</h3>
          <div className="w-20 h-[1px] bg-white/10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-20">
          {voitures.map((voiture, index) => (
            <motion.div
              key={voiture.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              whileHover={voiture.disponible ? { y: -12 } : {}}
              className={`flex flex-col ${voiture.disponible ? 'group cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
              onClick={() => {
                if (!voiture.disponible) return;
                if (!user) {
                  setAuthModal(true);
                  return;
                }
                setSelectedVoiture(voiture);
                setIsModalOpen(true);
                setOrderCode(null);
              }}
            >
              <div className="relative w-full aspect-[3/2] overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0a]">
                <img
                  src={voiture.image_url}
                  alt={voiture.modele}
                  className={`w-full h-full object-cover transition-all duration-[1.5s] ${voiture.disponible ? 'grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-110' : 'grayscale'}`}
                />
                {!voiture.disponible && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-[10px] font-black tracking-[0.5em] uppercase border border-white/20 px-4 py-2">Louée</span>
                  </div>
                )}
              </div>

              <div className="mt-8 space-y-4 px-2">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.4em] text-blue-400 font-black">{voiture.marque}</span>
                    <h4 className="text-3xl font-light tracking-tighter">{voiture.modele}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-medium">{voiture.prix_journalier?.toLocaleString()} DA</p>
                    <p className="text-[8px] uppercase opacity-30 tracking-widest">Par jour</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 grid grid-cols-3 gap-2 text-[8px] uppercase tracking-widest text-white/40">
                  <div className="flex flex-col gap-1">
                    <span className="text-blue-500/50">Moteur</span>
                    <span className="text-white/80">V8 Turbo</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-blue-500/50">Transmission</span>
                    <span className="text-white/80">Auto</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-blue-500/50">Places</span>
                    <span className="text-white/80">2-4</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="suivi" className="w-full max-w-5xl px-8 py-20 z-10">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-xl">
          <div className="text-center mb-10">
            <h3 className="text-[10px] uppercase tracking-[0.5em] text-blue-500 font-bold mb-4">Tableau de Bord</h3>
            <p className="text-2xl font-light italic">Votre historique et suivi</p>
          </div>

          {!user ? (
            <div className="text-center py-10">
              <p className="text-white/40 text-sm mb-6 uppercase tracking-widest">Connectez-vous pour voir vos réservations</p>
              <button onClick={() => setAuthModal(true)} className="px-10 py-5 bg-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">S'authentifier</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-6">
                <p className="text-[10px] uppercase tracking-widest text-white/40">Connecté en tant que: <span className="text-white">{user.email}</span></p>
                <div className="flex gap-2">
                  <input type="text" placeholder="CODE ADMIN" className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-[9px] tracking-widest outline-none uppercase w-32" value={searchCode} onChange={(e) => setSearchCode(e.target.value)} />
                  <button onClick={handleSearch} className="px-4 py-2 bg-zinc-800 rounded-lg text-[9px] font-bold uppercase hover:bg-zinc-700">Go</button>
                </div>
              </div>

              {myReservations.length === 0 ? (
                <div className="text-center py-10 border border-white/5 bg-black/20 rounded-2xl">
                  <p className="text-white/30 text-xs uppercase tracking-widest">Aucune réservation trouvée.</p>
                </div>
              ) : (
                myReservations.map((res: any) => (
                  <div key={res.id} className="p-6 border border-white/5 bg-black/20 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-center md:text-left">
                      <p className="font-bold text-blue-400 uppercase text-xs">{res.voitures?.marque} {res.voitures?.modele}</p>
                      <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Du {res.date_debut} au {res.date_fin}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest ${res.statut === 'accepte' || res.statut === 'confirme' ? 'bg-green-500/20 text-green-500' :
                      res.statut === 'refuse' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'
                      }`}>
                      {res.statut === 'en_attente' ? 'En cours d\'analyse' : res.statut}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="w-full py-32 bg-black z-10 flex flex-col items-center text-center px-10">
        <h2 className="text-5xl font-black tracking-tighter uppercase opacity-10 mb-10 italic">Auto-Loc</h2>
        <p className="text-[8px] opacity-20 tracking-[0.6em] uppercase">Algeria Premium Mobility © 2026</p>
      </footer>

      <AnimatePresence>
        {authModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#050505] border border-white/10 p-10 md:p-12 rounded-3xl max-w-md w-full relative">
              <button onClick={() => setAuthModal(false)} className="absolute top-8 right-8 text-xs opacity-30 hover:opacity-100">FERMER ×</button>
              <h3 className="text-3xl font-light italic mb-2">{authMode === 'login' ? 'Connexion' : 'Inscription'}</h3>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-8">{authMode === 'login' ? 'Accédez à votre espace' : 'Créez votre compte client'}</p>

              <form onSubmit={handleAuth} className="space-y-6">
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/40 mb-2 block">Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs outline-none focus:border-blue-500 text-white" />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/40 mb-2 block">Mot de passe</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs outline-none focus:border-blue-500 text-white" />
                </div>
                <button type="submit" disabled={authLoading} className="w-full py-4 bg-blue-600 text-white text-[10px] uppercase tracking-[0.5em] font-black rounded-xl hover:bg-white hover:text-black transition-all">
                  {authLoading ? 'CHARGEMENT...' : (authMode === 'login' ? 'SE CONNECTER' : "S'INSCRIRE")}
                </button>
              </form>

              <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-center mt-6 text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors">
                {authMode === 'login' ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#050505] border border-white/10 p-10 md:p-16 rounded-3xl max-w-xl w-full relative"
            >
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-xs opacity-30 hover:opacity-100">FERMER ×</button>

              {orderCode ? (
                <div className="text-center space-y-8 py-10">
                  <span className="text-blue-500 text-[10px] font-bold tracking-widest uppercase">Demande Confirmée</span>
                  <h3 className="text-4xl font-light italic">Merci pour votre confiance.</h3>
                  <div className="py-8 border-y border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-white/30 mb-4">Votre numéro de suivi unique :</p>
                    <span className="text-3xl font-mono text-blue-400 tracking-widest">{orderCode}</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">Veuillez conserver ce code. Un agent vous contactera sur WhatsApp sous peu.</p>
                </div>
              ) : (
                <>
                  <span className="text-blue-500 text-[10px] font-bold tracking-[0.5em] uppercase mb-4 block">Réservation</span>
                  <h3 className="text-5xl font-light tracking-tighter mb-12 italic">{selectedVoiture?.modele}</h3>

                  <div className="space-y-10">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col gap-3">
                        <label className="text-[9px] uppercase tracking-widest text-white/40">Début</label>
                        <input type="date" className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs outline-none focus:border-blue-500 transition-all text-white" onChange={(e) => setDateDebut(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="text-[9px] uppercase tracking-widest text-white/40">Fin</label>
                        <input type="date" className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs outline-none focus:border-blue-500 transition-all text-white" onChange={(e) => setDateFin(e.target.value)} />
                      </div>
                    </div>

                    <div className="relative border-b border-white/10 pb-6">
                      <label className="text-[9px] uppercase tracking-widest text-white/40 block mb-4">Pièce d'identité ou Permis</label>
                      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                      <div className="text-xs text-blue-400 tracking-widest">{file ? file.name : "CLIQUEZ POUR AJOUTER +"}</div>
                    </div>

                    <button
                      onClick={handleConfirm} disabled={sending}
                      className="w-full py-6 bg-blue-600 text-white text-[11px] uppercase tracking-[0.5em] font-black rounded-full hover:bg-white hover:text-black transition-all duration-500 disabled:opacity-20"
                    >
                      {sending ? "ENVOI EN COURS..." : "CONFIRMER LA DEMANDE"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}