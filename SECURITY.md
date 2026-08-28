# Audit de sécurité — Fire Quiz

Date : 27 août 2026

## État actuel

Le site est une démo statique : aucun compte n'est créé, aucun mot de passe n'est collecté, aucune base de données ni aucune API distante ne sont présentes. Les seules données conservées sont un thème d'affichage, un compteur de cartes et une série, dans le navigateur de l'utilisateur.

Cela signifie qu'il n'existe pas encore de données de connexion à chiffrer ou à hacher. Il serait trompeur d'affirmer que bcrypt est utilisé aujourd'hui.

## Corrections appliquées

- Politique de contenu restrictive dans la page : scripts locaux uniquement, pas de connexion externe applicative, pas d'objets intégrés.
- Politique de référent plus restrictive.
- Aucune clé, secret ou identifiant n'est stocké dans le code.
- Les messages du coach et les explications de quiz saisissent le texte sans l'interpréter comme du HTML.
- La fenêtre modale peut être fermée par son bouton, le bouton « Go ! », un clic en dehors, ou la touche Échap.

## Risques avant mise en ligne commerciale

| Risque | Niveau | Exigence avant lancement |
|---|---:|---|
| Authentification absente | Critique | Créer une API serveur et une base de données ; ne jamais simuler une connexion avec localStorage. |
| Paiement absent | Critique | Utiliser une page de paiement hébergée par un prestataire reconnu ; ne jamais manipuler de carte bancaire dans l'application. |
| Contenu JSP non validé | Élevé | Validation humaine, source et date de chaque fiche. |
| Mineurs | Élevé | Minimiser les données, prévoir l'accord parental adapté et une suppression simple des comptes. |
| API IA future | Élevé | Clé uniquement côté serveur, limites de requêtes, journalisation minimale, filtrage des réponses et sources validées. |

## Authentification à construire

Lorsqu'un vrai serveur sera ajouté, le flux obligatoire est :

1. Le navigateur envoie le mot de passe uniquement par HTTPS vers `/api/auth/register`.
2. Le serveur génère un sel unique par mot de passe et calcule un hash bcrypt avec un coût adapté et revu régulièrement.
3. Seul le hash bcrypt est conservé en base ; jamais le mot de passe, le sel séparé, ni un hash côté navigateur.
4. À la connexion, le serveur effectue `bcrypt.compare()`.
5. La session est un cookie `HttpOnly`, `Secure`, `SameSite=Lax` ou `Strict`, avec expiration et renouvellement contrôlés.
6. Limitation des tentatives, protection CSRF pour les écritures et vérification d'email sont obligatoires.

## Chiffrement réel

Une application web ne peut pas être « chiffrée » côté utilisateur : le navigateur doit recevoir son HTML, CSS et JavaScript pour les exécuter. La protection correcte est : HTTPS/TLS en transit, chiffrement au repos fourni par l'hébergeur de la base de données, secrets stockés dans le coffre de l'hébergeur, sauvegardes chiffrées et accès administrateur avec double authentification.

## Verdict

La démo locale ne présente pas de risque de mot de passe car elle ne collecte aucun compte. Elle n'est pas prête à collecter des identifiants ou des paiements tant que l'API d'authentification, la base de données, les pages légales et les protections listées ci-dessus ne sont pas en place.
