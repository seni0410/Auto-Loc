import { supabase } from './lib/supabase';

export default async function Home() {
  // On récupère les voitures depuis Supabase
  const { data: voitures, error } = await supabase
    .from('voitures')
    .select('*');

  if (error) return <p>Erreur lors du chargement : {error.message}</p>;

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold mb-6">🚗 Nos Voitures à Louer</h1>
      
      <div className="grid gap-4">
        {voitures?.map((voiture) => (
          <div key={voiture.id} className="p-4 border rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold">{voiture.marque} {voiture.modele}</h2>
            <p className="text-gray-600">{voiture.prix_journalier} € / jour</p>
          </div>
        ))}
      </div>
    </main>
  );
}