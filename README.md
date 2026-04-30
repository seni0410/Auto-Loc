# Auto-Loc - Location de voitures

**ISI Project - Architecture Cloud & Vibe Programming**

## groupe
- **étudiant 1** : Bessam Ines Malika
- **étudiant 2** : Sadok Ikram
- **étudiant 3** : Khereddine Sonia

## Mapping du Thème
Pour ce projet "Auto-loc" voici comment nous avons structuré les données imposées :
- **Table A (Utilisateurs)** : Gérée par **Supabase Auth** via l'ID utilisateur (`auth.users`).
- **Table B (Ressources)** : Table `voitures` contenant le catalogue (marque, modèle, prix journalier).
- **Table C (Interactions)** : Table `reservation` reliant un client à une voiture avec un statut et une date.
- **Storage (Fichiers)** : Bucket sécurisé contenant les photos des permis, lié via la colonne `permis-url`.

---

## Analyse d'Architecture 

### 1. Pourquoi Vercel + Supabase (OPEX vs CAPEX) ?
L'utilisation de Vercel et Supabase permet de passer d'un modèle **CAPEX** (Capital Expenditure) à un modèle **OPEX** (Operating Expenditure). Au lieu d'investir massivement au départ dans l'achat de serveurs physiques et de maintenance (CAPEX),nous utilisons des services cloud où nous ne payons que la consommation réelle (OPEX). Cela permet de lancer le projet avec un coût intial de 0DZD.

### 2. Scaalabilité : Vercel vs Data Center Physique
Un Data Center physique est limité par sa capacité matérielle fixe. **Vercel** utilise une architecture **Serverless** et un réseau "Edge". Il répartit la charge automatiquement : si le trafic augmente, l'infrastructure s'adapte instantanément sans intervention manuelle sur le matériel. 


### 3. Données Structurées vs Non-structurées
* **Données Structurées :** Les informations des tables `voitures` et `reservation` (PostgreSQL), organisées de manière rigide.
* **Données Non-structurées :** Les fichiers binaires comme les **photos des permis**, stockés dans **Supabase Storage**. Nous conservons uniquement leur lien (URL) dans nos tables structurées.

---

## Stack Technique
- **Frontend** : Next.js
- **Backend/Database** : Supabase (PostgreSQL + RLS)
- **Hébergement** : Vercel (CI/CD)
