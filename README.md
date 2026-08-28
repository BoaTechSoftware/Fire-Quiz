# Fire Quiz

Application web de révision JSP, conçue pour commencer gratuitement puis évoluer vers un abonnement parent/section.

## Lancer localement

Ouvrir `index.html` dans un navigateur suffit pour la version de démonstration. Elle ne dépend d'aucune installation.

## Ce qui fonctionne déjà

- Site d'accueil et offre Premium
- Séances de six questions et feedback immédiat
- Sélection d'un thème
- Progression et série locale sauvegardées dans le navigateur
- Coach de démonstration, borné aux thèmes présentés
- Design responsive téléphone / ordinateur

## Ce qui doit être relié avant une commercialisation

1. **Authentification et données** : ajouter une base PostgreSQL et une authentification. Ne pas conserver plus de données personnelles que nécessaire.
2. **Contenu** : faire relire chaque question et explication par un animateur JSP. Conserver la source et la date de validation de chaque fiche.
3. **Coach IA** : remplacer la fonction de démonstration par une route serveur. La clé du fournisseur IA ne doit jamais être placée dans `app.js` ni visible dans le navigateur.
4. **Paiements** : relier un compte de paiement créé par un parent ou responsable légal. Les boutons actuels ne débitent personne.
5. **Pages légales** : politique de confidentialité, conditions d'utilisation, contact et procédure de suppression des données.

## Publication

Le projet est un site statique : il peut être déployé sur Vercel, Netlify, Cloudflare Pages ou GitHub Pages. Un compte sur l'hébergeur est nécessaire pour obtenir le lien public. Un domaine personnalisé est facultatif au lancement.

## Garde-fou produit

Fire Quiz est un outil de révision théorique indépendant. Il ne doit jamais servir de consigne opérationnelle réelle, remplacer un formateur, ni héberger des informations sur des interventions ou des personnes.
