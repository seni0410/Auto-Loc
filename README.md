# Auto-Loc - Location de voitures
ISI project

## groupe
- **étudiant 1** : Bessam Ines Malika
- **étudiant 2** : Sadok Ikram
- **étudiant 3** : Khereddine Ikram

## Mapping du Thème
Pour ce projet "Auto-loc" voici comment nous avons structuré les données imposées :
- **Table A (Utilisateurs)** : Gérée par Supabase Auth via l'ID utilisateur (`auth.users`).
- **Table B (Ressources)** : Table `voitures` contenant le catalogue (marque, modèle, prix journalier).
- **Table C (Interactions)** : Table `reservation` reliant un client à une voiture avec un statut et une date.
- **Storage (Fichiers)** : Bucket sécurisé contenant les photos des permis, lié via la colonne `permis-url`.

---

## Analyse d'Architecture 

### 1. Pourquoi Vercel + Supabase (OPEX vs CAPEX) ?


### 2. Scaalabilité : Vercel vs Data Center Physique


### 3. Données Structurées vs Non-structurées


## Stack Technique
- **Frontend** : Next.js
- **Backend/Database** : Supabase (PostgreSQL + RLS)
- **Hébergement** : Vercel (CI/CD)
