# Connecter la Caisse à Google Sheets

Voici comment configurer le lien gratuit et sécurisé entre votre caisse enregistreuse sur iPad/PC et votre compte Google Sheets :

## Étape 1 : Créer le fichier Google Sheets
1. Allez sur Google Drive et créez un nouveau "Google Sheets".
2. Nommez-le "Caisse Pâtisserie" (ou le nom de votre choix).

## Étape 2 : Ajouter le script
1. Dans ce même fichier Google Sheets, cliquez dans le menu en haut sur **Extensions > Apps Script**.
2. Un nouvel onglet va s'ouvrir. Supprimez tout le code qui s'y trouve par défaut.
3. Allez dans le fichier **`Code.gs`** que je vous ai généré sur votre PC actuel, copiez tout le texte, et collez-le dans la fenêtre Apps Script.
4. Cliquez sur **Enregistrer** (l'icône de disquette en haut).

## Étape 3 : Rendre le script accessible par l'application
1. Toujours dans la fenêtre Apps Script, en haut à droite, cliquez sur le bouton bleu **Déployer > Nouvelle implémentation**.
2. Cliquez sur l'icône de roue crantée (Sélectionner un type) à côté de *Sélectionner un type* et choisissez **Application Web**.
3. Remplissez les champs comme suit :
   - Description : "API Caisse"
   - Exécuter en tant que : **Moi (votre_email@gmail.com)**
   - Qui a accès : **Tous** *(Ceci est obligatoire pour que l'application depuis votre iPad puisse envoyer les données sans vous demander un mot de passe Google)*.
4. Cliquez sur **Déployer**.
5. Google va vous demander d'autoriser les accès. Cliquez sur *Autoriser l'accès*, choisissez votre compte. Si un avertissement de sécurité apparaît (parce que l'application n'est pas vérifiée par Google), cliquez sur *Paramètres avancés* puis sur *Accéder à Projet sans titre (non sécurisé)*, et enfin sur *Autoriser*.
6. À la fin, Google vous donnera une **URL de l'application Web** (qui commence par `https://script.google.com/macros/s/...`). 
7. **Copiez cette URL !**

## Étape 4 : Lier à l'application
1. Ouvrez le fichier `src/components/sync/SyncManager.jsx` sur votre PC.
2. À la ligne 6, remplacez le faux lien :
   `const GOOGLE_SCRIPT_URL = 'VOTRE_LIEN_GOOGLE_APP_SCRIPT_ICI';`
   Par votre véritable lien (en gardant les guillemets).
3. Et c'est tout ! Votre caisse enverra les données directement à Google Sheets quand vous cliquerez sur le bouton Synchroniser.
