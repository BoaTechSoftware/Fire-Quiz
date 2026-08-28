# IA locale de Fire Quiz

## Ce qui est activé aujourd’hui

Le coach récupère uniquement les questions et explications **publiées** dans la base Fire Quiz. Sans modèle local configuré, il produit une réponse déterministe fondée sur cette fiche. Si aucune fiche ne correspond, il refuse de répondre. C’est le mécanisme le plus fiable pour la règle « uniquement les données validées de l’application ».

## Ajouter un LLM léger local

Le serveur sait appeler un serveur local compatible avec l’API `/api/generate`, par exemple un runtime local hébergeant un modèle 8B quantifié. Ne l’expose pas directement à Internet.

1. Installer un runtime de modèle local sur une machine possédant assez de RAM/VRAM.
2. Télécharger un modèle instruct d’environ 8B **avec une licence compatible**.
3. Démarrer le runtime uniquement sur `127.0.0.1` ou un réseau privé.
4. Définir avant le démarrage de Fire Quiz :

```powershell
$env:FIREQUIZ_LLM_URL = 'http://127.0.0.1:11434/api/generate'
$env:FIREQUIZ_LLM_MODEL = 'llama3.1:8b-instruct-q4_K_M'
node server.js
```

Le serveur envoie au modèle seulement les deux fiches les plus pertinentes, accompagnées d’une règle stricte de refus hors source. Le retour contient toujours les sources retenues. Cette approche de recherche documentaire est préférable à un entraînement pour démarrer.

## Préparer un entraînement — seulement après validation

N’entraîne pas le modèle avec des fiches non relues. Une fois les contenus validés et suffisamment nombreux, exporte-les :

```powershell
node training/export-dataset.js
```

Le fichier produit est privé et ignoré par Git. Il sert à entraîner un adaptateur LoRA/QLoRA, pas à réentraîner totalement le modèle. Les méthodes PEFT/LoRA n’entraînent que des paramètres additionnels, et la quantification 4 bits est couramment utilisée avec QLoRA pour réduire le besoin mémoire. [Documentation Hugging Face PEFT](https://huggingface.co/docs/transformers/peft)

## Limite importante

Un LLM pré-entraîné connaît déjà des informations générales : aucun fine-tuning ne peut prouver qu’il « ne sait que » les données Fire Quiz. Pour appliquer cette règle au produit, conserve le filtrage par sources dans Fire Quiz, exige une réponse sourcée et refuse lorsqu’il n’y a aucune source. 
