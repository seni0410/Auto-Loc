"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// 1. TYPES
interface Voiture {
  id: string;
  marque: string;
  modele: string;
  prix_journalier: number;
  image_url: string;
  disponible: boolean;
}

interface Reservation {
  id: string;
  nom: string;
  statut: string;
  permis_url: string;
  voiture_id: string;
  voitures: Voiture;
}

export default function AdminDashboard() {
  // --- ÉTATS DE SÉCURITÉ ---
  const [authorized, setAuthorized] = useState(true);
  const [password, setPassword] = useState("");

  // --- ÉTATS DE DONNÉES ---
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [voitures, setVoitures] = useState<Voiture[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCar, setNewCar] = useState({ marque: '', modele: '', prix: '' });
  const [carFile, setCarFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('toutes');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const [email, setEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // --- LOGIQUE DE CONNEXION SUPABASE ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérification stricte du rôle (Technicien/Admin uniquement)
    const emailLower = email.toLowerCase();
    if (!emailLower.includes("technicien") && !emailLower.includes("admin")) {
      showToast("Accès refusé : Réservé aux techniciens", "error");
      return;
    }

    setAuthLoading(true);
    // Tentative de connexion via Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Fallback au cas où l'utilisateur n'est pas encore créé dans Supabase mais veut tester l'interface
      if (password === "AUTO2026") {
        setAuthorized(true);
        showToast("Mode démo activé");
      } else {
        showToast("Identifiants incorrects", "error");
      }
    } else {
      setAuthorized(true);
      showToast("Connexion réussie");
    }
    setAuthLoading(false);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: resData, error: resError } = await supabase
        .from('reservation')
        .select('*, voitures(*)');

      const { data: carData, error: carError } = await supabase
        .from('voitures')
        .select('*')
        .order('id', { ascending: false });

      if (resError) throw resError;
      if (carError) throw carError;

      setReservations(resData || []);
      setVoitures(carData || []);
    } catch (err: any) {
      showToast("Erreur de chargement", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (authorized) fetchData(); }, [authorized]);

  const updateStatus = async (id: string, statusLabel: string, voitureId?: string) => {
    const statusMapping: Record<string, string> = { 'Confirmé': 'confirme', 'Refusé': 'refuse' };
    const finalStatus = statusMapping[statusLabel];

    try {
      const { error: resError } = await supabase
        .from('reservation')
        .update({ statut: finalStatus })
        .eq('id', id);

      if (resError) throw resError;

      if (finalStatus === 'confirme' && voitureId) {
        const { error: carError } = await supabase
          .from('voitures')
          .update({ disponible: false })
          .eq('id', voitureId);
        if (carError) throw carError;
      }

      showToast(finalStatus === 'confirme' ? "Réservation confirmée" : "Statut mis à jour");
      await fetchData();
    } catch (err: any) {
      showToast("Erreur: " + err.message, "error");
    }
  };

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carFile || !newCar.marque || !newCar.modele || !newCar.prix) return showToast("Remplissez tout !", "error");
    setAdding(true);
    try {
      const cleanName = carFile.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const fileName = `${Date.now()}_${cleanName}`;
      const { error: uploadError } = await supabase.storage.from('voitures-bucket').upload(fileName, carFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('voitures-bucket').getPublicUrl(fileName);
      const { error: insertError } = await supabase.from('voitures').insert([{
        marque: newCar.marque, modele: newCar.modele, prix_journalier: parseInt(newCar.prix),
        image_url: urlData.publicUrl, disponible: true
      }]);
      if (insertError) throw insertError;
      showToast("Véhicule ajouté !");
      setNewCar({ marque: '', modele: '', prix: '' }); setCarFile(null);
      fetchData();
    } catch (err: any) { showToast(err.message, "error"); } finally { setAdding(false); }
  };

  const deleteCar = async (id: string) => {
    if (confirm("Supprimer ce véhicule ?")) {
      try {
        const { error } = await supabase.from('voitures').delete().eq('id', id);
        if (error) throw error;
        fetchData();
        showToast("Véhicule supprimé", "error");
      } catch (err: any) { showToast(err.message, "error"); }
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('voitures')
        .update({ disponible: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      fetchData();
      showToast(`Statut changé : ${!currentStatus ? 'Disponible' : 'Louée'}`);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const filteredReservations = reservations.filter(r => {
    if (filter === 'toutes') return true;
    if (filter === 'en_attente') return !r.statut || r.statut === 'en_attente';
    return r.statut === filter;
  });

  // --- CONTENU DU DASHBOARD (Accès autorisé) ---
  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="flex justify-between items-center border-b border-white/10 pb-8">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Auto-Loc Logo" className="h-16 w-auto opacity-80" />
            <h1 className="text-xl font-bold italic tracking-tighter">VIBE <span className="text-blue-500">CONSOLE</span></h1>
          </div>
          <button onClick={() => setAuthorized(false)} className="text-[10px] opacity-40 uppercase hover:opacity-100 transition">Déconnexion</button>
        </div>

        {/* Formulaire d'Ajout  */}
        <section className="bg-zinc-900/10 border border-white/5 p-8 rounded-[2rem]">
          <h2 className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 mb-6 font-bold">Nouveau Véhicule</h2>
          <form onSubmit={handleAddCar} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="text" placeholder="Marque" className="bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-white/5" value={newCar.marque} onChange={e => setNewCar({ ...newCar, marque: e.target.value })} />
            <input type="text" placeholder="Modèle" className="bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-white/5" value={newCar.modele} onChange={e => setNewCar({ ...newCar, modele: e.target.value })} />
            <input type="number" placeholder="Prix" className="bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-white/5" value={newCar.prix} onChange={e => setNewCar({ ...newCar, prix: e.target.value })} />
            <input type="file" className="text-[9px]" onChange={e => setCarFile(e.target.files?.[0] || null)} />
            <button className="md:col-span-4 bg-blue-600 py-3 rounded-xl text-[10px] font-bold uppercase">Ajouter au Parc</button>
          </form>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/30 border border-white/5 p-5 rounded-[2rem]">
            <p className="text-[9px] uppercase opacity-40 tracking-[0.2em] mb-2 font-bold">En attente</p>
            <p className="text-3xl font-bold text-orange-500">{reservations.filter(r => !r.statut || r.statut === 'en_attente').length}</p>
          </div>
          <div className="bg-zinc-900/30 border border-white/5 p-5 rounded-[2rem]">
            <p className="text-[9px] uppercase opacity-40 tracking-[0.2em] mb-2 font-bold">Confirmées</p>
            <p className="text-3xl font-bold text-green-500">{reservations.filter(r => r.statut === 'confirme').length}</p>
          </div>
        </div>

        {/* Liste Réservations */}
        <section>
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-bold italic">Demandes</h2>
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
              {(['toutes', 'en_attente', 'confirme'] as const).map((t) => (
                <button key={t} onClick={() => setFilter(t)} className={`px-4 py-2 rounded-lg text-[9px] font-bold uppercase transition-all ${filter === t ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {filteredReservations.map(res => (
              <div key={res.id} className="p-5 bg-zinc-900/40 rounded-3xl border border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                  <p className="font-bold text-blue-400 uppercase text-xs">{res.voitures?.marque} {res.voitures?.modele}</p>
                  <p className="text-[10px] opacity-50 uppercase">Client: {res.nom || 'Inconnu'} • {res.statut || 'en attente'}</p>
                </div>
                <div className="flex gap-2">
                  {(!res.statut || res.statut === 'en_attente') && (
                    <>
                      <button onClick={() => updateStatus(res.id, 'Confirmé', res.voiture_id)} className="bg-green-600 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase">Accepter</button>
                      <button onClick={() => updateStatus(res.id, 'Refusé')} className="bg-zinc-800 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase">Refuser</button>
                    </>
                  )}
                  <a href={res.permis_url} target="_blank" className="bg-blue-600/10 text-blue-400 px-5 py-2.5 rounded-xl text-[9px] font-black border border-blue-400/20">Permis</a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Parc Auto */}
        <section>
          <h2 className="text-lg font-bold mb-10 opacity-20 italic uppercase">Parc automobile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {voitures.map(v => (
              <div key={v.id} className="bg-zinc-900/20 rounded-[2.5rem] border border-white/5 overflow-hidden group">
                <div className="relative aspect-video">
                  <img src={v.image_url} className="w-full h-full object-cover opacity-80" alt="" />
                  <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${v.disponible ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <p className="text-[10px] font-black text-blue-400">{v.prix_journalier} DA</p>
                  </div>
                </div>
                <div className="p-6">
                  <p className="font-black uppercase text-lg mb-4">{v.marque} <span className="text-blue-500">{v.modele}</span></p>
                  <button onClick={() => toggleAvailability(v.id, v.disponible)} className={`w-full text-left text-[9px] uppercase font-bold mb-4 hover:opacity-70 transition-opacity ${v.disponible ? 'text-green-500' : 'text-red-500'}`}>
                    {v.disponible ? "● Disponible (cliquer pour changer)" : "○ Louée (cliquer pour rendre disponible)"}
                  </button>
                  <button onClick={() => deleteCar(v.id)} className="w-full text-[9px] font-black uppercase text-red-500 border border-red-500/10 py-3.5 rounded-2xl hover:bg-red-500 hover:text-white transition-all">Retirer</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {toast.show && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-bold text-[10px] uppercase border z-50 animate-bounce ${toast.type === 'success' ? 'bg-green-500 text-black' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}
    </main>
  );
}