# La Cigale Gestion : web app (Vercel + Supabase)

Deux personnes, chacune avec son email et son mot de passe, mêmes données en direct, installable sur téléphone, fonctionne aussi sans réseau (les saisies partent dès que la connexion revient).

## Mise en ligne (environ 20 minutes, une seule fois)

### 1. Supabase (la base de données)
1. Créer un compte sur supabase.com, puis « New project » (nom : cigale, région : Europe, choisir un mot de passe de base de données et le noter).
2. Menu « SQL Editor » > « New query » : coller le contenu de `supabase.sql` après avoir remplacé `EMAIL_DE_TON_ASSOCIE` par son adresse. Cliquer « Run ».
3. Menu « Authentication » > « Users » > « Add user » > « Create new user » : créer les 2 comptes (email + mot de passe, cocher « Auto Confirm User »).
4. « Authentication » > « Sign In / Providers » (ou « Providers » > Email) : désactiver « Allow new users to sign up » (personne d'autre ne doit pouvoir créer de compte).
5. « Project Settings » > « API » : copier « Project URL » et la clé publique (« anon » ou « publishable »). Ces 2 valeurs sont publiques par conception.

### 2. GitHub (pour héberger le code)
1. Créer un compte sur github.com, puis « New repository » (nom : cigale-gestion, privé).
2. Sur la page du dépôt : « uploading an existing file », glisser tout le contenu de ce dossier (dont le dossier `public`, `build.js`, `vercel.json`, `package.json`). « Commit changes ».

### 3. Vercel (la mise en ligne)
1. Créer un compte sur vercel.com avec « Continue with GitHub ».
2. « Add New » > « Project » > importer `cigale-gestion`.
3. Ouvrir « Environment Variables » et ajouter :
   - `SUPABASE_URL` = le Project URL
   - `SUPABASE_ANON_KEY` = la clé publique
4. « Deploy ». Tu obtiens une adresse en `.vercel.app`.

### 4. Premier lancement
1. Ouvrir l'adresse, se connecter. Sur téléphone : « Ajouter à l'écran d'accueil » (iPhone : Safari > Partager).
2. Reprendre les données de l'ancienne version : dans l'ancienne appli, Paramètres > Sauvegarde (fichier JSON), puis dans la nouvelle, Paramètres > Importer une sauvegarde.

## Bon à savoir
- Les 2 valeurs Supabase ne sont pas des mots de passe : elles sont visibles dans le navigateur. La sécurité vient de la connexion et des règles de la base (seuls les emails listés dans `members` accèdent aux données).
- Les photos et justificatifs sont dans un dossier public de Supabase avec des adresses non devinables. Ne pas les partager.
- L'offre gratuite de Supabase met un projet en pause après une période sans activité : utiliser l'appli chaque semaine l'évite. Vérifier les conditions actuelles des offres gratuites Supabase et Vercel.
- Mise à jour de l'appli : remplacer les fichiers dans GitHub, Vercel redéploie tout seul.

## Mise à jour 1 : photos privées, mot de passe oublié, notifications

1. **Supabase > SQL Editor** : exécuter `supabase-maj-1.sql` (photos privées + abonnements aux notifications). À faire une seule fois.
2. **Supabase > Authentication > URL Configuration** : mettre « Site URL » = l'adresse du site Vercel, et l'ajouter dans « Redirect URLs » (sinon le lien « mot de passe oublié » ne revient pas sur l'appli).
3. **Vercel > Settings > Environment Variables** (puis « Redeploy ») :
   - `SUPABASE_SERVICE_ROLE_KEY` : clé « service_role » (Supabase > Project Settings > API). Secrète : ne la partager nulle part ailleurs.
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` : fournies séparément.
   - `VAPID_SUBJECT` : `mailto:` suivi de l'email de l'entreprise.
   - `CRON_SECRET` : une longue suite de caractères au choix.
4. Sur l'iPhone : ouvrir l'appli depuis l'icône de l'écran d'accueil, Paramètres > Compte > « Activer les notifications ».
