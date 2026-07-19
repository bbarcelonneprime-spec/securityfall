# Plan — Alex IA : Codex éditeur + mobile + polish

Grosse mise à jour en plusieurs volets. Je te propose de la faire en **une seule passe** (le tout d'un coup), sauf si tu préfères la découper.

## 1. Codex — Éditeur de jeux façon Lovable
- **Nouveau moteur** : router les prompts Codex vers **OpenAI GPT-4o** (via la clé `sk-72b231...` que je stocke dans `OPENAI_API_KEY`) avec repli sur Groq GPT-OSS si OpenAI échoue. Gain net de qualité pour les jeux 2D.
- **Éditeur intégré** : après génération, ouverture automatique d'un écran éditeur avec :
  - **Aperçu live** du jeu (iframe rejouable, bouton "Rejouer").
  - **Panneau chat Codex** à gauche pour itérer ("ajoute un boss", "change les couleurs", "plus rapide"). Chaque message régénère le jeu en gardant le contexte.
  - **Éditeur de code HTML** (textarea monospace) modifiable à la main + bouton "Appliquer".
  - **Actions** : Télécharger .html, Ouvrir en plein écran, Dupliquer, Renommer, Supprimer.
- **Bibliothèque de projets Codex** (comme Lovable) : liste latérale de tous tes jeux, sauvegardés dans Supabase (`codex_projects` : id, user_id, name, prompt, html, created_at, updated_at). Cliquer sur un projet le rouvre dans l'éditeur.
- **Vue d'accueil Codex** = grille des projets récents + zone nouveau prompt (style dashboard Lovable).

## 2. Responsive mobile / tablette — tout le site
- **Sidebar** : devient un menu **drawer** (hamburger en haut à gauche) sous 1024 px, plein écran sur mobile, se ferme au clic sur un lien.
- **Header topbar mobile** : logo Alex IA + hamburger + avatar admin, sticky.
- **Hero accueil** : titre plus petit sur mobile (clamp), padding réduit, grille outils passe à 1 colonne < 640 px, 2 colonnes tablette.
- **Chatbot Alex IA** : composer collé en bas (safe-area iOS), messages en pleine largeur, boutons `+` / micro / envoyer en icônes seulement sur mobile.
- **Voix IA / Retirer arrière-plan / QR / Codex / Sécurité e-mail** : layouts refaits en colonnes empilées, boutons pleine largeur, texte responsive (`text-base sm:text-lg`).
- **Modales** (thème, voix, éditeur Codex) : plein écran sur mobile.
- **Voice overlay** : orbe et boutons redimensionnés pour mobile.

## 3. Chat vocal — anti-bug
Problèmes actuels : redémarrages en boucle, capture de la voix de l'IA, plantages sur erreur, arrêts silencieux.
Correctifs :
- Empêcher tout redémarrage tant que `speechSynthesis.speaking` est vrai (garde-fou avec `setInterval` de veille).
- Débounce anti double-`start` (SpeechRecognition throw `InvalidStateError` sinon).
- Gestion propre des erreurs `no-speech`, `aborted`, `audio-capture`, `not-allowed` avec feedback UI + auto-recovery.
- Détection **fin de phrase** via silence prolongé (analyser RMS) plutôt que `onend` seul, pour éviter de couper l'utilisateur.
- Barge-in fiable : coupure immédiate de la synthèse si niveau micro > seuil pendant que l'IA parle.
- Bouton **Stop** toujours visible, kill switch total.
- Fallback clair si le navigateur ne supporte pas (message + bascule sur transcription serveur ElevenLabs).

## 4. Boutons — tout doit servir
Audit et branchement de chaque bouton restant :
- Sidebar : "Nouvelle conversation" (déjà OK), items conversations (chargement), bouton collapse.
- Topbar Alex IA : partage conversation (copie lien/texte), effacer, régénérer dernière réponse, copier message.
- Composer : `+` (menu image/PDF/vidéo — déjà là, vérifier), micro dictée, envoi.
- Voix IA : lecture / pause / téléchargement / copier transcription.
- Codex : voir §1.
- Retirer arrière-plan : télécharger, réinitialiser, comparer avant/après.
- QR : copier image, télécharger PNG/SVG, taille configurable.
- Sécurité e-mail : effacer historique, exporter rapport.
- Thème : reset, aléatoire, sauvegarde.
- Chaque bouton sans handler → soit branché, soit retiré.

## Technique
- **Secret** : je stocke `OPENAI_API_KEY = sk-72b231...` via `set_secret`. Le second token `QeeY5...` ne matche aucun format connu (ni OpenAI, ni Groq, ni Anthropic) — je ne le stocke pas tant que tu ne me dis pas à quel service il appartient.
- **Migration Supabase** : table `codex_projects` + RLS + GRANT + policies par `auth.uid()`.
- **Nouveaux fichiers** : `src/routes/index.tsx` (refactor sections Codex + responsive), `src/lib/codex-store.functions.ts`, `src/components/CodexEditor.tsx`, `src/components/MobileNav.tsx`.
- **Édition** : `src/lib/ai-chat.server.ts` (ajout provider OpenAI), `src/lib/codex.functions.ts` (routing OpenAI + itération avec contexte), `src/hooks/useVocalChat.ts` (robustesse), `src/styles.css` (breakpoints, safe-area).

## Question rapide
1. Le token `QeeY5RuQwjuGCpMj5AohUXiIpuZoneMa` sert à quel service ? (sinon je l'ignore)
2. Je pars sur **tout d'un coup** (gros commit) ou je livre par étapes (1 → 2 → 3 → 4) ?
